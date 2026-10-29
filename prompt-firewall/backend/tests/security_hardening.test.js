const { describe, it } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const createApp = require('../src/app');
const { validateEnvironment } = require('../src/utils/envValidator');

describe('Task 2: Security Hardening & Environment Validation', () => {
  it('should fail environment validation in production if default demo keys are used', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevKey = process.env.ADMIN_API_KEY;

    try {
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_API_KEY = 'prompt-firewall-admin-key-2026';
      process.env.ADMIN_PASSWORD = 'Admin@Firewall2026!';
      process.env.CORS_ORIGIN = 'http://localhost:5173';

      assert.throws(() => validateEnvironment(), /Environment validation failed/);
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.ADMIN_API_KEY = prevKey;
    }
  });

  it('should pass environment validation in production with strong credentials', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevKey = process.env.ADMIN_API_KEY;
    const prevPass = process.env.ADMIN_PASSWORD;
    const prevCors = process.env.CORS_ORIGIN;
    const prevProvider = process.env.AI_PROVIDER;

    try {
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_API_KEY = 'a-very-strong-production-admin-key-9876543210';
      process.env.ADMIN_PASSWORD = 'A-Strong-Prod-Password-2026!';
      process.env.CORS_ORIGIN = 'https://firewall.example.com';
      process.env.AI_PROVIDER = 'mock';

      const result = validateEnvironment();
      assert.strictEqual(result.isValid, true);
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.ADMIN_API_KEY = prevKey;
      process.env.ADMIN_PASSWORD = prevPass;
      process.env.CORS_ORIGIN = prevCors;
      process.env.AI_PROVIDER = prevProvider;
    }
  });

  it('should reject unsupported HTTP methods like TRACE with 405 Method Not Allowed', async () => {
    const app = createApp();
    const res = await request(app).trace('/api/health');
    assert.strictEqual(res.status, 405);
    assert.ok(res.body.error.includes('not allowed'));
  });

  it('should reject unapproved origins via CORS in production mode', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevCors = process.env.CORS_ORIGIN;

    try {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = 'https://trusted.example.com';
      const app = createApp();

      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-attacker.com');

      assert.strictEqual(res.status, 403);
      assert.ok(res.body.error.includes('CORS'));
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.CORS_ORIGIN = prevCors;
    }
  });
});
