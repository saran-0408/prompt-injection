const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const createApp = require('../src/app');
const { getDatabase, closeDatabase } = require('../src/database/connection');
const { initSchema } = require('../src/database/schema');

describe('AI Provider Failure Handling', () => {
  let app;

  before(() => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.AI_PROVIDER = 'mock';
    const db = getDatabase(':memory:');
    initSchema(db);
    app = createApp();
  });

  after(() => {
    closeDatabase();
  });

  it('should handle AI provider failure with 502 and safe error message', async () => {
    // The mock provider is designed to throw when "test:provider_error" is in the prompt
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'Can you process this? test:provider_error' });

    assert.strictEqual(res.status, 502);
    assert.strictEqual(res.body.decision, 'ALLOW');
    assert.ok(res.body.requestId);
    assert.strictEqual(res.body.error, 'AI service is temporarily unavailable');
    // Ensure no stack traces or raw errors are exposed to the client
    assert.strictEqual(res.body.stack, undefined);
    assert.strictEqual(res.body.originalMessage, undefined);
  });
});
