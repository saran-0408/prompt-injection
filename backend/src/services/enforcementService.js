/**
 * Security Enforcement Service
 * Orchestrates prompt detection, strict ALLOW/BLOCK/REVIEW policy enforcement,
 * AI provider routing, and persistent audit logging.
 */

const { detect } = require('../detector');
const { getAIProvider } = require('./aiProvider');
const { insertAuditLog } = require('../database/auditRepository');
const { insertReviewItem } = require('../database/reviewRepository');
const { sanitizePreview, sanitizeForReview } = require('../utils/sanitizer');
const logger = require('../utils/logger');

class EnforcementService {
  /**
   * Process a chat message through the security firewall
   * @param {string} message - Validated user message
   * @param {object} context - { requestId, clientIp }
   */
  async processChatMessage(message, context = {}) {
    const { requestId, clientIp } = context;
    const startTime = Date.now();
    const shouldStoreContent = process.env.AUDIT_STORE_MESSAGE_CONTENT === 'true';
    const messagePreview = shouldStoreContent ? sanitizePreview(message) : null;

    // 1. Run detection engine
    const detection = await detect(message, { requestId, clientIp });
    const decision = detection.decision;

    logger.security(`Firewall evaluated request ${requestId}: Decision=${decision}, Score=${detection.riskScore}`);

    // 2. ENFORCEMENT: BLOCK
    if (decision === 'BLOCK') {
      const latencyMs = Date.now() - startTime;
      const primaryReason = detection.reasons[0] || 'Potential prompt injection detected';

      // Persist audit record - AI provider is NEVER invoked
      insertAuditLog({
        requestId,
        timestamp: detection.timestamp,
        decision: 'BLOCK',
        riskScore: detection.riskScore,
        reasons: detection.reasons,
        provider: 'none',
        outcome: 'BLOCKED',
        latencyMs,
        errorCategory: null,
        clientIp,
        messagePreview
      });

      return {
        statusCode: 403,
        body: {
          requestId,
          decision: 'BLOCK',
          blocked: true,
          reason: primaryReason,
          riskScore: detection.riskScore,
          reasons: detection.reasons
        }
      };
    }

    // 3. ENFORCEMENT: REVIEW
    if (decision === 'REVIEW') {
      const latencyMs = Date.now() - startTime;
      const reviewReason = 'Additional security review required';

      // Add to review queue for administrative moderation with sanitized credentials
      insertReviewItem({
        requestId,
        timestamp: detection.timestamp,
        message: sanitizeForReview(message),
        riskScore: detection.riskScore,
        reasons: detection.reasons
      });

      // Persist audit record - AI provider is NOT invoked until approval
      insertAuditLog({
        requestId,
        timestamp: detection.timestamp,
        decision: 'REVIEW',
        riskScore: detection.riskScore,
        reasons: detection.reasons,
        provider: 'none',
        outcome: 'REVIEW_REQUIRED',
        latencyMs,
        errorCategory: null,
        clientIp,
        messagePreview
      });

      return {
        statusCode: 200,
        body: {
          requestId,
          decision: 'REVIEW',
          blocked: true,
          reason: reviewReason,
          riskScore: detection.riskScore,
          reasons: detection.reasons
        }
      };
    }

    // 4. ENFORCEMENT: ALLOW -> Route to configured AI Provider
    const aiProvider = getAIProvider();

    try {
      const aiResponse = await aiProvider.generate(message, { requestId });
      const latencyMs = Date.now() - startTime;

      // Persist successful audit record
      insertAuditLog({
        requestId,
        timestamp: detection.timestamp,
        decision: 'ALLOW',
        riskScore: detection.riskScore,
        reasons: detection.reasons,
        provider: aiProvider.name,
        outcome: 'ALLOWED',
        latencyMs,
        errorCategory: null,
        clientIp,
        messagePreview
      });

      return {
        statusCode: 200,
        body: {
          requestId,
          decision: 'ALLOW',
          blocked: false,
          reply: aiResponse.text,
          model: aiResponse.model,
          provider: aiResponse.provider,
          riskScore: detection.riskScore
        }
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      logger.error(`AI Provider failed for request ${requestId}: ${err.message}`);

      // Persist provider failure audit event
      insertAuditLog({
        requestId,
        timestamp: detection.timestamp,
        decision: 'ALLOW',
        riskScore: detection.riskScore,
        reasons: detection.reasons,
        provider: aiProvider.name,
        outcome: 'PROVIDER_ERROR',
        latencyMs,
        errorCategory: err.code || 'AI_PROVIDER_ERROR',
        clientIp,
        messagePreview
      });

      return {
        statusCode: 502,
        body: {
          requestId,
          decision: 'ALLOW',
          error: 'AI service is temporarily unavailable',
          code: 'PROVIDER_ERROR'
        }
      };
    }
  }
}

module.exports = new EnforcementService();
