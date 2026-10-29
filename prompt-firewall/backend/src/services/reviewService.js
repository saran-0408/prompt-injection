/**
 * Administrative Review & Moderation Service
 * Handles manual approval / rejection workflows for messages flagged as REVIEW.
 */

const { findReviewByRequestId, updateReviewStatus, listPendingReviews } = require('../database/reviewRepository');
const { updateAuditOutcome } = require('../database/auditRepository');
const { getAIProvider } = require('./aiProvider');
const logger = require('../utils/logger');

class ReviewService {
  async getPendingReviews(limit = 20, offset = 0) {
    return listPendingReviews(limit, offset);
  }

  async approveReview(requestId, reviewedBy = 'admin') {
    const item = findReviewByRequestId(requestId);
    if (!item) {
      const err = new Error(`Review item for request ${requestId} not found`);
      err.status = 404;
      throw err;
    }

    if (item.status !== 'PENDING') {
      const err = new Error(`Request ${requestId} has already been reviewed (${item.status})`);
      err.status = 400;
      throw err;
    }

    logger.info(`Admin '${reviewedBy}' approved request ${requestId}. Dispatching to AI provider...`);

    const aiProvider = getAIProvider();
    const aiResponse = await aiProvider.generate(item.message, { requestId });

    // Update review item state
    updateReviewStatus(requestId, 'APPROVED', reviewedBy, aiResponse.text);

    // Update audit outcome
    updateAuditOutcome(requestId, 'APPROVED_AFTER_REVIEW');

    return {
      success: true,
      requestId,
      status: 'APPROVED',
      reviewedBy,
      reply: aiResponse.text,
      model: aiResponse.model
    };
  }

  async rejectReview(requestId, reviewedBy = 'admin') {
    const item = findReviewByRequestId(requestId);
    if (!item) {
      const err = new Error(`Review item for request ${requestId} not found`);
      err.status = 404;
      throw err;
    }

    if (item.status !== 'PENDING') {
      const err = new Error(`Request ${requestId} has already been reviewed (${item.status})`);
      err.status = 400;
      throw err;
    }

    logger.info(`Admin '${reviewedBy}' rejected request ${requestId}.`);

    updateReviewStatus(requestId, 'REJECTED', reviewedBy, null);
    updateAuditOutcome(requestId, 'REJECTED_AFTER_REVIEW');

    return {
      success: true,
      requestId,
      status: 'REJECTED',
      reviewedBy
    };
  }
}

module.exports = new ReviewService();
