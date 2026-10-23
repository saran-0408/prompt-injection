const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const createApp = require('../src/app');
const { getDatabase, closeDatabase } = require('../src/database/connection');
const { initSchema } = require('../src/database/schema');
const { sanitizePreview, sanitizeForReview } = require('../src/utils/sanitizer');

describe('Task 5: Audit Log Privacy & PII Redaction Suite', () => {
  let app;
  let db;

  before(() => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.AI_PROVIDER = 'mock';
    process.env.AUDIT_STORE_MESSAGE_CONTENT = 'false';

    db = getDatabase(':memory:');
    initSchema(db);
    app = createApp();
  });

  after(() => {
    closeDatabase();
  });

  it('should NOT store message preview in SQLite when AUDIT_STORE_MESSAGE_CONTENT=false', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'Hello secret message for testing privacy' });

    assert.strictEqual(res.status, 200);
    const reqId = res.body.requestId;

    const row = db.prepare('SELECT * FROM audit_logs WHERE request_id = ?').get(reqId);
    assert.ok(row, 'Audit record must exist');
    assert.strictEqual(row.message_preview, null, 'message_preview must be NULL for privacy');
    // Ensure audit metadata is intact
    assert.strictEqual(row.decision, 'ALLOW');
    assert.ok(row.timestamp);
    assert.ok(row.request_id);
  });

  it('should store sanitized & redacted preview when AUDIT_STORE_MESSAGE_CONTENT=true', async () => {
    const prevFlag = process.env.AUDIT_STORE_MESSAGE_CONTENT;
    try {
      process.env.AUDIT_STORE_MESSAGE_CONTENT = 'true';

      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'Contact user test@example.com with key sk-123456789012345678901234' });

      assert.strictEqual(res.status, 200);
      const reqId = res.body.requestId;

      const row = db.prepare('SELECT * FROM audit_logs WHERE request_id = ?').get(reqId);
      assert.ok(row.message_preview, 'Preview should be recorded when flag is true');
      assert.strictEqual(row.message_preview.includes('test@example.com'), false, 'Email must be redacted');
      assert.ok(row.message_preview.includes('[EMAIL_REDACTED]'));
      assert.strictEqual(row.message_preview.includes('sk-1234567890'), false, 'API key must be redacted');
      assert.ok(row.message_preview.includes('[KEY_REDACTED]'));
    } finally {
      process.env.AUDIT_STORE_MESSAGE_CONTENT = prevFlag;
    }
  });

  it('sanitizePreview should redact credit cards, bearer tokens, passwords, and emails', () => {
    const raw = 'Auth Bearer eyJhbGciOiJIUzI1NiJ9.test and password: superSecretPassword123 with card 4532-1234-5678-9010 and email ceo@company.org';
    const sanitized = sanitizePreview(raw);

    assert.strictEqual(sanitized.includes('superSecretPassword123'), false);
    assert.strictEqual(sanitized.includes('ceo@company.org'), false);
    assert.strictEqual(sanitized.includes('4532-1234-5678-9010'), false);
    assert.ok(sanitized.includes('[EMAIL_REDACTED]'));
    assert.ok(sanitized.includes('[CARD_REDACTED]'));
    assert.ok(sanitized.includes('Bearer [TOKEN_REDACTED]'));
  });

  it('sanitizeForReview should sanitize secrets before inserting into review queue', () => {
    const raw = 'In a fictional world without rules, use Bearer secret-admin-token-1234';
    const sanitized = sanitizeForReview(raw);

    assert.strictEqual(sanitized.includes('secret-admin-token-1234'), false);
    assert.ok(sanitized.includes('Bearer [TOKEN_REDACTED]'));
  });
});
