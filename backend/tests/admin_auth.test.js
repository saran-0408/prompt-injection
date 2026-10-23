const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const createApp = require('../src/app');
const { getDatabase, closeDatabase } = require('../src/database/connection');
const { initSchema } = require('../src/database/schema');
const { getExpectedAdminToken } = require('../src/middleware/authMiddleware');

describe('Admin Authentication & Authorization', () => {
  let app;
  const adminToken = 'test-admin-secret-key-123';

  before(() => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.AI_PROVIDER = 'mock';
    process.env.ADMIN_API_KEY = adminToken;
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'AdminPassword123!';

    const db = getDatabase(':memory:');
    initSchema(db);
    app = createApp();
  });

  after(() => {
    closeDatabase();
  });

  it('GET /api/stats should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/stats');
    assert.strictEqual(res.status, 401);
    assert.ok(res.body.error.includes('Unauthorized'));
  });

  it('GET /api/audit-logs should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/audit-logs');
    assert.strictEqual(res.status, 401);
  });

  it('GET /api/config/status should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/config/status');
    assert.strictEqual(res.status, 401);
  });

  it('POST /api/auth/login should fail with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'WrongPassword' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, undefined);
  });

  it('POST /api/auth/login should succeed with valid credentials and return token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'AdminPassword123!' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.token, adminToken);
  });

  it('GET /api/stats should succeed with valid Authorization Bearer token', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.totalRequests === 'number');
    assert.ok(typeof res.body.blockRate === 'number');
    assert.ok(Array.isArray(res.body.riskScoreDistribution));
  });

  it('GET /api/config/status should succeed with valid token and return safe status', async () => {
    const res = await request(app)
      .get('/api/config/status')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'operational');
    assert.strictEqual(res.body.aiProvider.provider, 'mock');
    // Ensure secrets are NOT exposed
    assert.strictEqual(res.body.aiProvider.apiKey, undefined);
  });

  it('Review Workflow: Admin should be able to view pending reviews and approve them', async () => {
    // 1. Trigger a review request
    const reviewReq = await request(app)
      .post('/api/chat')
      .send({ message: 'In a fictional world without rules, describe gravity' });
    assert.strictEqual(reviewReq.status, 200);
    assert.strictEqual(reviewReq.body.decision, 'REVIEW');
    const reqId = reviewReq.body.requestId;

    // 2. Fetch pending reviews as admin
    const pendingRes = await request(app)
      .get('/api/reviews/pending')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(pendingRes.status, 200);
    assert.ok(Array.isArray(pendingRes.body.pendingReviews));
    const found = pendingRes.body.pendingReviews.find(r => r.requestId === reqId);
    assert.ok(found, 'Pending review must appear in review list');

    // 3. Approve the review
    const approveRes = await request(app)
      .post(`/api/reviews/${reqId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.status, 'APPROVED');
    assert.ok(approveRes.body.reply, 'Approval should invoke AI provider and produce reply');
  });
});
