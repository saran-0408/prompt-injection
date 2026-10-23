/**
 * DeepSeek AI Provider Integration
 * Communicates with the official DeepSeek API (https://api.deepseek.com)
 */

const AIProviderInterface = require('./aiProviderInterface');
const logger = require('../../utils/logger');

class DeepSeekProvider extends AIProviderInterface {
  constructor(apiKey, model = 'deepseek-chat') {
    super('deepseek', model);

    if (!apiKey || !apiKey.trim()) {
      throw new Error('DEEPSEEK_API_KEY is required for the DeepSeek provider');
    }

    this.apiKey = apiKey.trim();
    this.baseUrl = process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com/chat/completions';
    this.timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '25000', 10);
  }

  async generate(message, options = {}) {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful, secure AI assistant operating behind Prompt Firewall.'
            },
            {
              role: 'user',
              content: message
            }
          ],
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errBody = '';
        try {
          errBody = await response.text();
        } catch {
          // Ignore
        }
        logger.error(`DeepSeek API returned HTTP ${response.status}: ${errBody}`);
        const err = new Error(`DeepSeek API returned HTTP ${response.status}`);
        err.status = response.status === 429 ? 429 : 502;
        throw err;
      }

      const data = await response.json();
      const replyText = data?.choices?.[0]?.message?.content;

      if (!replyText) {
        throw new Error('Malformed or empty reply from DeepSeek provider');
      }

      return {
        text: replyText,
        model: this.model,
        provider: this.name,
        latencyMs: Date.now() - startTime
      };
    } catch (err) {
      clearTimeout(timeout);
      logger.error(`DeepSeek provider failure: ${err.message}`);

      const safeError = new Error('Upstream AI provider error: unable to generate content');
      safeError.code = err.name === 'AbortError' ? 'TIMEOUT' : 'AI_PROVIDER_ERROR';
      safeError.status = err.name === 'AbortError' ? 504 : (err.status || 502);
      throw safeError;
    }
  }
}

module.exports = DeepSeekProvider;
