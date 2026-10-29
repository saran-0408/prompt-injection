const crypto = require('crypto');
const logger = require('../utils/logger');

function getExpectedAdminToken() {
  const token = process.env.ADMIN_API_KEY;
  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: ADMIN_API_KEY must be set in production environment.');
    }
    return 'prompt-firewall-admin-key-2026';
  }
  return token;
}

function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'];

  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  const expectedToken = getExpectedAdminToken();

  if (!token || !timingSafeCompare(token, expectedToken)) {
    logger.warn(`Unauthorized administrative access attempt from IP: ${req.ip} to ${req.originalUrl}`);
    return res.status(401).json({
      requestId: req.id,
      error: 'Unauthorized: valid administrative authentication token required'
    });
  }

  req.user = { role: 'admin' };
  next();
}

module.exports = {
  authMiddleware,
  getExpectedAdminToken,
  timingSafeCompare
};
