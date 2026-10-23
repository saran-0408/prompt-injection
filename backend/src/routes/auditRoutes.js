const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { queryAuditLogs, getStats } = require('../database/auditRepository');

// Protected: Get paginated audit logs with search & filters
router.get('/audit-logs', authMiddleware, (req, res, next) => {
  try {
    const {
      decision,
      outcome,
      provider,
      startDate,
      endDate,
      search,
      limit,
      offset
    } = req.query;

    const result = queryAuditLogs({
      decision,
      outcome,
      provider,
      startDate,
      endDate,
      search,
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Protected: Get aggregated security statistics
router.get('/stats', authMiddleware, (req, res, next) => {
  try {
    const stats = getStats();
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
