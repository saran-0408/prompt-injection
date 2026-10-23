/**
 * Prompt Detector Adapter Interface
 * All detector implementations (Built-in, Second-stage, Member 2 adapter)
 * must implement this contract.
 */

class DetectorAdapter {
  constructor(name = 'BaseDetector', version = '1.0.0') {
    this.name = name;
    this.version = version;
  }

  /**
   * Analyze input message for security threats
   * @param {string} message - Raw user input string
   * @param {object} options - Optional config (thresholds, context)
   * @returns {Promise<{
   *   decision: 'ALLOW' | 'BLOCK' | 'REVIEW',
   *   riskScore: number,
   *   reasons: string[],
   *   detectorVersion: string,
   *   timestamp: string,
   *   metadata?: object
   * }>}
   */
  async analyze(message, options = {}) {
    throw new Error(`analyze() method not implemented in ${this.name}`);
  }
}

module.exports = DetectorAdapter;
