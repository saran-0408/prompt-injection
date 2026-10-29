/**
 * Abstract AI Provider Interface
 * All model integrations (Gemini, DeepSeek, Mock) inherit from this class.
 */

class AIProviderInterface {
  constructor(name, model) {
    this.name = name;
    this.model = model;
  }

  /**
   * Generate content from the AI provider
   * @param {string} message - User prompt
   * @param {object} options - Optional generation params
   * @returns {Promise<{
   *   text: string,
   *   model: string,
   *   provider: string,
   *   latencyMs: number
   * }>}
   */
  async generate(message, options = {}) {
    throw new Error(`generate() method not implemented in ${this.name}`);
  }
}

module.exports = AIProviderInterface;
