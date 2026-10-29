const express = require('express');
const router = express.Router();
const validateChatRequest = require('../middleware/validateChatRequest');
const { chatRateLimiter } = require('../middleware/rateLimiter');
const enforcementService = require('../services/enforcementService');

router.post('/chat', chatRateLimiter, validateChatRequest, async (req, res, next) => {
  try {
    const clientIp = req.ip || req.connection?.remoteAddress;
    const result = await enforcementService.processChatMessage(req.validatedMessage, {
      requestId: req.id,
      clientIp
    });

    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
