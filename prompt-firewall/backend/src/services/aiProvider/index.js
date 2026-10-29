/**
 * AI Provider Factory & Manager
 */

const MockProvider = require('./mockProvider');
const GeminiProvider = require('./geminiProvider');
const DeepSeekProvider = require('./deepseekProvider');
const logger = require('../../utils/logger');

let cachedProvider = null;

function getAIProvider(forceNew = false) {
  if (cachedProvider && !forceNew) {
    return cachedProvider;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const providerType = (process.env.AI_PROVIDER || 'mock').toLowerCase().trim();
  const configuredModel = process.env.AI_MODEL;

  switch (providerType) {
    case 'gemini': {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || !apiKey.trim()) {
        if (isProduction) {
          throw new Error('FATAL: AI_PROVIDER is set to "gemini" in production, but GEMINI_API_KEY is missing.');
        }
        logger.warn('AI_PROVIDER is set to "gemini" but GEMINI_API_KEY is missing. Falling back to MockProvider for local offline testing.');
        cachedProvider = new MockProvider('mock-fallback');
      } else {
        cachedProvider = new GeminiProvider(apiKey, configuredModel || 'gemini-3.8-flash');
        logger.info(`Initialized Google Gemini AI Provider (Model: ${cachedProvider.model})`);
      }
      break;
    }

    case 'deepseek': {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey || !apiKey.trim()) {
        if (isProduction) {
          throw new Error('FATAL: AI_PROVIDER is set to "deepseek" in production, but DEEPSEEK_API_KEY is missing.');
        }
        logger.warn('AI_PROVIDER is set to "deepseek" but DEEPSEEK_API_KEY is missing. Falling back to MockProvider for local offline testing.');
        cachedProvider = new MockProvider('mock-fallback');
      } else {
        cachedProvider = new DeepSeekProvider(apiKey, configuredModel || 'deepseek-chat');
        logger.info(`Initialized DeepSeek AI Provider (Model: ${cachedProvider.model})`);
      }
      break;
    }

    case 'mock':
    default: {
      cachedProvider = new MockProvider(configuredModel || 'mock-llm-v1');
      logger.info(`Initialized Mock AI Provider (Model: ${cachedProvider.model})`);
      break;
    }
  }

  return cachedProvider;
}

function getSafeProviderInfo() {
  const provider = getAIProvider();
  return {
    providerName: provider.name,
    model: provider.model,
    hasApiKey: provider.name === 'gemini'
      ? Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim())
      : provider.name === 'deepseek'
        ? Boolean(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.trim())
        : true
  };
}

module.exports = {
  getAIProvider,
  getSafeProviderInfo
};
