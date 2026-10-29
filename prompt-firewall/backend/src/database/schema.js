const { getDatabase } = require('./connection');
const logger = require('../utils/logger');

function initSchema(db = null) {
  const database = db || getDatabase();

  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL UNIQUE,
      timestamp TEXT NOT NULL,
      decision TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      reasons_json TEXT NOT NULL,
      provider TEXT NOT NULL,
      outcome TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      error_category TEXT,
      client_ip TEXT,
      message_preview TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_decision ON audit_logs(decision);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_provider ON audit_logs(provider);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON audit_logs(outcome);

    CREATE TABLE IF NOT EXISTS review_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL UNIQUE,
      timestamp TEXT NOT NULL,
      message TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      reasons_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_at TEXT,
      reviewed_by TEXT,
      ai_reply TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(status);
    CREATE INDEX IF NOT EXISTS idx_review_queue_request_id ON review_queue(request_id);
  `);

  logger.info('Database schema and indexes initialized');
}

module.exports = { initSchema };
