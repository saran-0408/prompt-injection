const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const createApp = require('../src/app');
const { getDatabase, closeDatabase } = require('../src/database/connection');
const { initSchema } = require('../src/database/schema');

describe('Input Validation Suite', () => {
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

  it('POST /api/chat should reject missing message with 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({});

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.requestId);
    assert.ok(res.body.error.toLowerCase().includes('required'));
  });

  it('POST /api/chat should reject empty message with 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: '    ' });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.requestId);
    assert.ok(res.body.error.toLowerCase().includes('empty'));
  });

  it('POST /api/chat should reject non-string message with 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 12345 });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.requestId);
    assert.ok(res.body.error.toLowerCase().includes('string'));
  });

  it('POST /api/chat should reject oversized message (> 5000 chars) with 400', async () => {
    const longMessage = 'A'.repeat(5001);
    const res = await request(app)
      .post('/api/chat')
      .send({ message: longMessage });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.requestId);
    assert.ok(res.body.error.toLowerCase().includes('5000'));
  });

  it('POST /api/chat should reject malformed JSON body with 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Content-Type', 'application/json')
      .send('{"message": malformed JSON here}');

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.requestId);
    assert.ok(res.body.error.toLowerCase().includes('json'));
  });
});
