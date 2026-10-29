const { getDatabase } = require('./connection');

function insertReviewItem({ requestId, timestamp, message, riskScore, reasons }) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO review_queue (
      request_id, timestamp, message, risk_score, reasons_json, status
    ) VALUES (
      @request_id, @timestamp, @message, @risk_score, @reasons_json, 'PENDING'
    )
  `);

  return stmt.run({
    request_id: requestId,
    timestamp: timestamp || new Date().toISOString(),
    message,
    risk_score: Math.round(riskScore || 0),
    reasons_json: JSON.stringify(reasons || [])
  });
}

function findReviewByRequestId(requestId) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT
      id, request_id as requestId, timestamp, message,
      risk_score as riskScore, reasons_json as reasonsJson,
      status, reviewed_at as reviewedAt, reviewed_by as reviewedBy, ai_reply as aiReply
    FROM review_queue
    WHERE request_id = ?
  `);
  const row = stmt.get(requestId);
  if (!row) return null;

  try {
    row.reasons = JSON.parse(row.reasonsJson);
  } catch {
    row.reasons = [row.reasonsJson];
  }
  return row;
}

function updateReviewStatus(requestId, status, reviewedBy, aiReply = null) {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE review_queue
    SET status = ?, reviewed_by = ?, reviewed_at = ?, ai_reply = ?
    WHERE request_id = ?
  `);
  return stmt.run(status, reviewedBy, new Date().toISOString(), aiReply, requestId);
}

function listPendingReviews(limit = 20, offset = 0) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT
      id, request_id as requestId, timestamp, message,
      risk_score as riskScore, reasons_json as reasonsJson,
      status
    FROM review_queue
    WHERE status = 'PENDING'
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(limit, offset);
  return rows.map(row => {
    try {
      row.reasons = JSON.parse(row.reasonsJson);
    } catch {
      row.reasons = [row.reasonsJson];
    }
    return row;
  });
}

module.exports = {
  insertReviewItem,
  findReviewByRequestId,
  updateReviewStatus,
  listPendingReviews
};
