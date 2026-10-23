const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getSafeProviderInfo } = require('../services/aiProvider');
const { DETECTOR_VERSION } = require('../detector');

router.get('/config/status', authMiddleware, (req, res) => {
  const providerInfo = getSafeProviderInfo();

  res.status(200).json({
    status: 'operational',
    service: 'Prompt Firewall Security Enforcement System',
    timestamp: new Date().toISOString(),
    aiProvider: {
      provider: providerInfo.providerName,
      model: providerInfo.model,
      credentialsConfigured: providerInfo.hasApiKey
    },
    detector: {
      version: DETECTOR_VERSION,
      blockThreshold: parseInt(process.env.DETECTOR_BLOCK_THRESHOLD || '70', 10),
      reviewThreshold: parseInt(process.env.DETECTOR_REVIEW_THRESHOLD || '40', 10),
      engine: process.env.DETECTOR_ENGINE || 'builtin'
    },
    security: {
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
      corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
    },
    storage: {
      engine: 'SQLite3 (WAL mode)',
      persistent: true,
      storeMessageContent: process.env.AUDIT_STORE_MESSAGE_CONTENT === 'true'
    }
  });
});

module.exports = router;
