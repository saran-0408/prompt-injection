const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const reviewService = require('../services/reviewService');

// Get list of requests waiting for moderation review
router.get('/reviews/pending', authMiddleware, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const items = await reviewService.getPendingReviews(limit, offset);
    res.status(200).json({ pendingReviews: items });
  } catch (err) {
    next(err);
  }
});

// Admin approves a flagged review message -> invokes AI provider
router.post('/reviews/:requestId/approve', authMiddleware, async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const reviewedBy = req.user?.username || 'admin';
    const result = await reviewService.approveReview(requestId, reviewedBy);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Admin rejects a flagged review message
router.post('/reviews/:requestId/reject', authMiddleware, async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const reviewedBy = req.user?.username || 'admin';
    const result = await reviewService.rejectReview(requestId, reviewedBy);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
