/**
 * Main Prompt Detection Engine Coordinator
 * Implements layered defense: Fast Rule Matcher + Second-Stage Classifier + Configurable Thresholds
 */

const { RuleEngine } = require('./ruleEngine');
const SecondStageClassifier = require('./secondStageClassifier');
const Member2DetectorAdapter = require('./member2Adapter');

const DETECTOR_VERSION = '2.1.0';

class PromptDetector {
  constructor(options = {}) {
    this.blockThreshold = options.blockThreshold ?? parseInt(process.env.DETECTOR_BLOCK_THRESHOLD || '70', 10);
    this.reviewThreshold = options.reviewThreshold ?? parseInt(process.env.DETECTOR_REVIEW_THRESHOLD || '40', 10);
    this.engineType = options.engineType || process.env.DETECTOR_ENGINE || 'builtin';

    this.ruleEngine = new RuleEngine();
    this.secondStage = new SecondStageClassifier();
    this.member2Adapter = new Member2DetectorAdapter();
  }

  /**
   * Run detection analysis on a user message
   * @param {string} message
   * @param {object} context
   * @returns {Promise<{
   *   decision: 'ALLOW' | 'BLOCK' | 'REVIEW',
   *   riskScore: number,
   *   reasons: string[],
   *   detectorVersion: string,
   *   timestamp: string,
   *   metadata: object
   * }>}
   */
  async detect(message, context = {}) {
    const timestamp = new Date().toISOString();

    // If Member 2 adapter is explicitly chosen as the primary engine
    if (this.engineType === 'member2_adapter') {
      return await this.member2Adapter.analyze(message, {
        ...context,
        blockThreshold: this.blockThreshold,
        reviewThreshold: this.reviewThreshold
      });
    }

    // Built-in Layered Detection Pipeline
    // Stage 1: Fast Rule-based Pattern Matcher
    const layer1 = this.ruleEngine.evaluate(message);

    // Stage 2: Second-stage structural & heuristic classifier
    const layer2 = this.secondStage.analyze(message);

    // Combine risk scores from Layer 1 and Layer 2
    let combinedScore = Math.max(layer1.score, layer2.heuristicScore);
    if (layer1.score > 0 && layer2.heuristicScore > 0) {
      combinedScore = Math.min(100, Math.round(combinedScore + (layer2.heuristicScore * 0.25)));
    }

    // Collect distinct explanation reasons
    const combinedReasons = [];
    if (layer1.matches.length > 0) {
      layer1.matches.forEach(m => combinedReasons.push(m.description));
    }
    if (layer2.findings.length > 0) {
      layer2.findings.forEach(f => combinedReasons.push(f));
    }
    if (combinedReasons.length === 0) {
      combinedReasons.push('Message passed all security filters');
    }

    // Decision policy enforcement based on configurable thresholds
    let decision;
    if (combinedScore >= this.blockThreshold) {
      decision = 'BLOCK';
    } else if (combinedScore >= this.reviewThreshold) {
      decision = 'REVIEW';
    } else {
      decision = 'ALLOW';
    }

    return {
      decision,
      riskScore: combinedScore,
      reasons: combinedReasons,
      detectorVersion: DETECTOR_VERSION,
      timestamp,
      metadata: {
        engine: 'builtin-layered',
        layer1Score: layer1.score,
        layer2Score: layer2.heuristicScore,
        matchesCount: layer1.matches.length,
        blockThreshold: this.blockThreshold,
        reviewThreshold: this.reviewThreshold
      }
    };
  }
}

// Singleton default instance
const defaultDetector = new PromptDetector();

module.exports = {
  PromptDetector,
  detect: (msg, ctx) => defaultDetector.detect(msg, ctx),
  DETECTOR_VERSION
};
