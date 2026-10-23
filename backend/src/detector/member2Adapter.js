/**
 * Member 2 Prompt Detector Adapter
 *
 * Provides a standardized adapter interface to integrate Member 2's
 * detection engine (e.g., Python FastAPI service, fine-tuned transformer,
 * or custom rule engine).
 *
 * =========================================================================
 * INTEGRATION SPECIFICATION & CONTRACT FOR MEMBER 2:
 *
 * Expected Input Schema:
 * {
 *   "message": "string (1-5000 chars)",
 *   "context": { "requestId": "uuid", "clientIp": "optional string" },
 *   "options": { "sensitivity": "normal" | "high" }
 * }
 *
 * Expected Output Schema:
 * {
 *   "decision": "ALLOW" | "BLOCK" | "REVIEW",
 *   "riskScore": number (0 to 100),
 *   "reasons": string[],
 *   "detectorVersion": string,
 *   "timestamp": string (ISO 8601)
 * }
 * =========================================================================
 */

const DetectorAdapter = require('./detectorAdapter');
const logger = require('../utils/logger');

class Member2DetectorAdapter extends DetectorAdapter {
  constructor(options = {}) {
    super('Member2DetectorAdapter', '2.0.0-adapter');
    this.endpoint = options.endpoint || process.env.MEMBER2_DETECTOR_URL || null;
    this.timeoutMs = options.timeoutMs || parseInt(process.env.MEMBER2_TIMEOUT_MS || '3000', 10);
    this.fallbackEnabled = options.fallbackEnabled !== false;
  }

  /**
   * Check if external Member 2 service is actively configured
   */
  isConfigured() {
    return Boolean(this.endpoint);
  }

  /**
   * Analyze message via Member 2's engine or documented placeholder
   */
  async analyze(message, options = {}) {
    const timestamp = new Date().toISOString();

    // If an external Member 2 microservice endpoint is provided, call it
    if (this.endpoint) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.MEMBER2_API_KEY ? { 'Authorization': `Bearer ${process.env.MEMBER2_API_KEY}` } : {})
          },
          body: JSON.stringify({
            message,
            context: { requestId: options.requestId },
            options: { sensitivity: options.sensitivity || 'normal' }
          }),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Member 2 detector returned status ${response.status}`);
        }

        const data = await response.json();
        return {
          decision: data.decision || 'REVIEW',
          riskScore: typeof data.riskScore === 'number' ? data.riskScore : 50,
          reasons: Array.isArray(data.reasons) ? data.reasons : ['Flagged by Member 2 engine'],
          detectorVersion: data.detectorVersion || this.version,
          timestamp,
          metadata: { provider: 'member2_external', raw: data }
        };
      } catch (err) {
        logger.warn(`Member 2 service error (${err.message}). Using safe adapter fallback.`);
        if (!this.fallbackEnabled) {
          throw err;
        }
      }
    }

    // Working placeholder implementation complying with Member 2's specification
    // Checks standard Member 2 baseline patterns
    const isInjection = /ignore\s+(?:all\s+)?previous\s+instructions/i.test(message) ||
                        /reveal\s+(?:your\s+)?system\s+prompt/i.test(message) ||
                        /show\s+(?:me\s+)?your\s+hidden\s+instructions/i.test(message) ||
                        /bypass\s+(?:the\s+)?security/i.test(message);

    const isSuspicious = /act\s+as\s+dan|developer\s+mode|unfiltered|jailbreak/i.test(message);

    let decision = 'ALLOW';
    let riskScore = 10;
    const reasons = [];

    if (isInjection) {
      decision = 'BLOCK';
      riskScore = 90;
      reasons.push('Member 2 Engine: Critical prompt injection signature detected');
    } else if (isSuspicious) {
      decision = 'REVIEW';
      riskScore = 55;
      reasons.push('Member 2 Engine: Persona manipulation requiring human review');
    } else {
      reasons.push('Member 2 Engine: Input passed baseline safety filters');
    }

    return {
      decision,
      riskScore,
      reasons,
      detectorVersion: this.version,
      timestamp,
      metadata: {
        provider: 'member2_adapter_placeholder',
        note: 'Live Member 2 microservice endpoint not configured in .env (MEMBER2_DETECTOR_URL). Operating in adapter compliance mode.'
      }
    };
  }
}

module.exports = Member2DetectorAdapter;
