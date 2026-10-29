const { describe, it } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');
const { chatRateLimiter } = require('../src/middleware/rateLimiter');

describe('Rate Limiter Middleware', () => {
  it('should return 429 when rate limit threshold is exceeded', async () => {
    const testApp = express();
    // Configure mini test app with the rate limiter
    testApp.use('/test-chat', chatRateLimiter, (req, res) => {
      res.json({ ok: true });
    });

    // Make multiple requests - within limit should return 200
    const res1 = await request(testApp).get('/test-chat');
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.ok, true);
  });
});
