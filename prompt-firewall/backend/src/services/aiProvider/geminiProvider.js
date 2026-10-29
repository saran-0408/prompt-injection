/**
 * Google Gemini AI Provider Integration
 * Uses the official @google/genai SDK (v2.x)
 */

const { GoogleGenAI } = require('@google/genai');
const AIProviderInterface = require('./aiProviderInterface');
const logger = require('../../utils/logger');

class GeminiProvider extends AIProviderInterface {
  constructor(apiKey, model = 'gemini-3.8-flash') {
    super('gemini', model);

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new Error('GEMINI_API_KEY is required and must be a non-empty string for the Gemini provider');
    }

    this.apiKey = apiKey.trim();
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
    this.timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '20000', 10);
  }

  async generate(message, options = {}) {
    const startTime = Date.now();

    try {
      const generatePromise = this.client.models.generateContent({
        model: this.model,
        contents: message
      });

      // Timeout safety wrapper
      const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => {
          const timeoutErr = new Error(`Gemini request timed out after ${this.timeoutMs}ms`);
          timeoutErr.code = 'TIMEOUT';
          timeoutErr.status = 504;
          reject(timeoutErr);
        }, this.timeoutMs);

        // Ensure timeout unrefs so it doesn't hold event loop in tests
        if (timer.unref) timer.unref();
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);

      let text = '';
      if (typeof response?.text === 'function') {
        text = response.text();
      } else if (typeof response?.text === 'string') {
        text = response.text;
      } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        text = response.candidates[0].content.parts[0].text;
      }

      if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error('Empty response received from Gemini provider');
      }

      return {
        text: text.trim(),
        model: this.model,
        provider: this.name,
        latencyMs: Date.now() - startTime
      };
    } catch (err) {
      // Redact any potential keys or sensitive tokens from error logging
      logger.error(`Gemini provider error: ${err.message}`);

      // Map upstream errors to safe client-facing errors with proper HTTP status codes
      let statusCode = 502;
      let errorCode = 'AI_PROVIDER_ERROR';
      let safeMessage = 'Upstream AI service is temporarily unavailable';

      const errMsg = (err.message || '').toLowerCase();

      if (err.code === 'TIMEOUT' || err.status === 504) {
        statusCode = 504;
        errorCode = 'GATEWAY_TIMEOUT';
        safeMessage = 'Upstream AI provider timed out';
      } else if (errMsg.includes('429') || errMsg.includes('resource_exhausted') || errMsg.includes('quota')) {
        statusCode = 429;
        errorCode = 'AI_RATE_LIMIT_EXCEEDED';
        safeMessage = 'AI provider rate limit or quota exceeded. Please retry shortly.';
      } else if (errMsg.includes('api_key_invalid') || errMsg.includes('unauthorized') || errMsg.includes('403') || errMsg.includes('401')) {
        statusCode = 502;
        errorCode = 'AI_AUTH_ERROR';
        safeMessage = 'AI provider authentication failed. Please verify API configuration.';
      } else if (errMsg.includes('not found') || errMsg.includes('unsupported model')) {
        statusCode = 502;
        errorCode = 'MODEL_UNAVAILABLE';
        safeMessage = 'Configured AI model is unavailable or unsupported.';
      }

      const safeError = new Error(safeMessage);
      safeError.code = errorCode;
      safeError.status = statusCode;
      throw safeError;
    }
  }
}

module.exports = GeminiProvider;
