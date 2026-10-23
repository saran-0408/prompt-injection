const express = require('express');
const router = express.Router();
const { authMiddleware, getExpectedAdminToken, timingSafeCompare } = require('../middleware/authMiddleware');
const { authRateLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

router.post('/auth/login', authRateLimiter, (req, res) => {
  const { username, password, apiKey } = req.body || {};
  const expectedToken = getExpectedAdminToken();
  const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
  const expectedPassword = process.env.ADMIN_PASSWORD || 'Admin@Firewall2026!';

  // Direct API key login
  if (apiKey && timingSafeCompare(apiKey, expectedToken)) {
    return res.status(200).json({
      success: true,
      token: expectedToken,
      role: 'admin',
      message: 'Authentication successful'
    });
  }

  // Username and password login
  if (
    username &&
    password &&
    timingSafeCompare(username, expectedUsername) &&
    timingSafeCompare(password, expectedPassword)
  ) {
    logger.info(`Admin user '${username}' logged in successfully`);
    return res.status(200).json({
      success: true,
      token: expectedToken,
      role: 'admin',
      message: 'Authentication successful'
    });
  }

  logger.warn(`Failed administrative login attempt from IP ${req.ip}`);
  return res.status(401).json({
    requestId: req.id,
    error: 'Invalid administrative credentials'
  });
});

router.get('/auth/verify', authMiddleware, (req, res) => {
  res.status(200).json({
    authenticated: true,
    role: req.user?.role || 'admin'
  });
});

module.exports = router;
