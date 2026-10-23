const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const createApp = require('../src/app');
const { getDatabase, closeDatabase } = require('../src/database/connection');
const { initSchema } = require('../src/database/schema');

describe('Health Check Endpoint', () => {
  let app;

  before(() => {
    process.env.DATABASE_PATH = ':memory:';
    const db = getDatabase(':memory:');
    initSchema(db);
    app = createApp();
  });

  after(() => {
    closeDatabase();
  });

  it('GET /api/health should return 200 with status ok and service name', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.service, 'Prompt Firewall Backend');
    assert.ok(typeof res.body.uptimeSeconds === 'number');
    assert.ok(res.body.timestamp);
    // Ensure no secrets are leaked
    assert.strictEqual(res.body.GEMINI_API_KEY, undefined);
    assert.strictEqual(res.body.ADMIN_API_KEY, undefined);
  });
});
