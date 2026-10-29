const express = require('express');
const router = express.Router();

const startTime = Date.now();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Prompt Firewall Backend',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
