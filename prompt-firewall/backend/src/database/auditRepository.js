const { getDatabase } = require('./connection');

function insertAuditLog(log) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO audit_logs (
      request_id, timestamp, decision, risk_score, reasons_json,
      provider, outcome, latency_ms, error_category, client_ip, message_preview
    ) VALUES (
      @request_id, @timestamp, @decision, @risk_score, @reasons_json,
      @provider, @outcome, @latency_ms, @error_category, @client_ip, @message_preview
    )
  `);

  return stmt.run({
    request_id: log.requestId,
    timestamp: log.timestamp || new Date().toISOString(),
    decision: log.decision,
    risk_score: Math.round(log.riskScore || 0),
    reasons_json: JSON.stringify(log.reasons || []),
    provider: log.provider || 'none',
    outcome: log.outcome,
    latency_ms: Math.round(log.latencyMs || 0),
    error_category: log.errorCategory || null,
    client_ip: log.clientIp || null,
    message_preview: log.messagePreview || null
  });
}

function updateAuditOutcome(requestId, newOutcome) {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE audit_logs
    SET outcome = ?
    WHERE request_id = ?
  `);
  return stmt.run(newOutcome, requestId);
}

function queryAuditLogs({
  decision,
  outcome,
  provider,
  startDate,
  endDate,
  search,
  limit = 20,
  offset = 0
} = {}) {
  const db = getDatabase();
  const conditions = [];
  const params = {};

  if (decision && decision !== 'ALL') {
    conditions.push('decision = @decision');
    params.decision = decision;
  }
  if (outcome && outcome !== 'ALL') {
    conditions.push('outcome = @outcome');
    params.outcome = outcome;
  }
  if (provider && provider !== 'ALL') {
    conditions.push('provider = @provider');
    params.provider = provider;
  }
  if (startDate) {
    conditions.push('timestamp >= @startDate');
    params.startDate = startDate;
  }
  if (endDate) {
    conditions.push('timestamp <= @endDate');
    params.endDate = endDate;
  }
  if (search && search.trim()) {
    conditions.push('(request_id LIKE @searchPattern OR reasons_json LIKE @searchPattern)');
    params.searchPattern = `%${search.trim()}%`;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`);
  const { total } = countStmt.get(params);

  // Get paginated rows
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const queryStmt = db.prepare(`
    SELECT
      id, request_id as requestId, timestamp, decision, risk_score as riskScore,
      reasons_json as reasonsJson, provider, outcome, latency_ms as latencyMs,
      error_category as errorCategory, client_ip as clientIp, message_preview as messagePreview
    FROM audit_logs
    ${whereClause}
    ORDER BY id DESC
    LIMIT @limit OFFSET @offset
  `);

  const rows = queryStmt.all({ ...params, limit: safeLimit, offset: safeOffset });

  const parsedRows = rows.map(row => {
    let reasons = [];
    try {
      reasons = JSON.parse(row.reasonsJson);
    } catch {
      reasons = [row.reasonsJson];
    }
    return {
      ...row,
      reasons
    };
  });

  return {
    total,
    page: Math.floor(safeOffset / safeLimit) + 1,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
    data: parsedRows
  };
}

function getStats() {
  const db = getDatabase();

  const counts = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN decision = 'ALLOW' THEN 1 ELSE 0 END) as allowed,
      SUM(CASE WHEN decision = 'BLOCK' THEN 1 ELSE 0 END) as blocked,
      SUM(CASE WHEN decision = 'REVIEW' THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN outcome = 'PROVIDER_ERROR' THEN 1 ELSE 0 END) as providerFailures
    FROM audit_logs
  `).get();

  const total = counts.total || 0;
  const allowed = counts.allowed || 0;
  const blocked = counts.blocked || 0;
  const review = counts.review || 0;
  const providerFailures = counts.providerFailures || 0;
  const blockRate = total > 0 ? Number(((blocked / total) * 100).toFixed(1)) : 0;

  // Risk score distribution: 0-20, 21-40, 41-60, 61-80, 81-100
  const riskDist = db.prepare(`
    SELECT
      SUM(CASE WHEN risk_score BETWEEN 0 AND 20 THEN 1 ELSE 0 END) as bucket_0_20,
      SUM(CASE WHEN risk_score BETWEEN 21 AND 40 THEN 1 ELSE 0 END) as bucket_21_40,
      SUM(CASE WHEN risk_score BETWEEN 41 AND 60 THEN 1 ELSE 0 END) as bucket_41_60,
      SUM(CASE WHEN risk_score BETWEEN 61 AND 80 THEN 1 ELSE 0 END) as bucket_61_80,
      SUM(CASE WHEN risk_score BETWEEN 81 AND 100 THEN 1 ELSE 0 END) as bucket_81_100
    FROM audit_logs
  `).get();

  // Recent 10 events
  const recentRows = db.prepare(`
    SELECT
      id, request_id as requestId, timestamp, decision, risk_score as riskScore,
      reasons_json as reasonsJson, provider, outcome, latency_ms as latencyMs,
      message_preview as messagePreview
    FROM audit_logs
    ORDER BY id DESC
    LIMIT 10
  `).all();

  const recentEvents = recentRows.map(row => {
    let reasons = [];
    try {
      reasons = JSON.parse(row.reasonsJson);
    } catch {
      reasons = [row.reasonsJson];
    }
    return { ...row, reasons };
  });

  return {
    totalRequests: total,
    allowedRequests: allowed,
    blockedRequests: blocked,
    reviewRequests: review,
    providerFailures,
    blockRate,
    decisionBreakdown: {
      ALLOW: allowed,
      BLOCK: blocked,
      REVIEW: review
    },
    riskScoreDistribution: [
      { range: '0-20 (Safe)', count: riskDist.bucket_0_20 || 0 },
      { range: '21-40 (Low)', count: riskDist.bucket_21_40 || 0 },
      { range: '41-60 (Moderate/Review)', count: riskDist.bucket_41_60 || 0 },
      { range: '61-80 (High Risk)', count: riskDist.bucket_61_80 || 0 },
      { range: '81-100 (Critical/Jailbreak)', count: riskDist.bucket_81_100 || 0 }
    ],
    recentEvents
  };
}

module.exports = {
  insertAuditLog,
  updateAuditOutcome,
  queryAuditLogs,
  getStats
};
