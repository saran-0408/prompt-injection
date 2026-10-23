/**
 * Environment Configuration Validator
 * Validates critical environment variables and enforces production security requirements.
 */

const logger = require('./logger');

const DEFAULT_DEMO_KEYS = [
  'prompt-firewall-admin-key-2026',
  'admin-super-secret-token',
  'admin',
  'Admin@Firewall2026!'
];

function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  const adminApiKey = process.env.ADMIN_API_KEY;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const corsOrigin = process.env.CORS_ORIGIN;
  const aiProvider = (process.env.AI_PROVIDER || 'mock').toLowerCase().trim();

  // 1. Administrative Credentials Check
  if (isProduction) {
    if (!adminApiKey || DEFAULT_DEMO_KEYS.includes(adminApiKey)) {
      errors.push('CRITICAL: ADMIN_API_KEY must be set to a secure, non-default value in production.');
    }
    if (!adminPassword || DEFAULT_DEMO_KEYS.includes(adminPassword) || adminPassword.length < 12) {
      errors.push('CRITICAL: ADMIN_PASSWORD must be configured with a strong password (at least 12 characters) in production.');
    }
    if (!corsOrigin || corsOrigin === '*' || corsOrigin.includes('localhost')) {
      errors.push('CRITICAL: CORS_ORIGIN must be explicitly set to trusted production domain(s) and cannot be "*" or "localhost" in production.');
    }
  } else {
    // Non-production warnings
    if (!adminApiKey || DEFAULT_DEMO_KEYS.includes(adminApiKey)) {
      warnings.push('ADMIN_API_KEY is using a development default key. Replace with a random secret before production deployment.');
    }
    if (!adminPassword || DEFAULT_DEMO_KEYS.includes(adminPassword)) {
      warnings.push('ADMIN_PASSWORD is using the default demo password. Ensure this is updated before deployment.');
    }
  }

  // 2. AI Provider Configuration Check
  if (aiProvider === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    if (!key || !key.trim()) {
      if (isProduction) {
        errors.push('CRITICAL: AI_PROVIDER is set to "gemini" in production, but GEMINI_API_KEY is not provided.');
      } else {
        warnings.push('AI_PROVIDER is set to "gemini" but GEMINI_API_KEY is missing. Mock fallback will be used.');
      }
    }
  } else if (aiProvider === 'deepseek') {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key || !key.trim()) {
      if (isProduction) {
        errors.push('CRITICAL: AI_PROVIDER is set to "deepseek" in production, but DEEPSEEK_API_KEY is not provided.');
      } else {
        warnings.push('AI_PROVIDER is set to "deepseek" but DEEPSEEK_API_KEY is missing. Mock fallback will be used.');
      }
    }
  }

  // 3. Log warnings
  warnings.forEach(w => logger.warn(`[Config Check] ${w}`));

  // 4. Fail fast if production errors exist
  if (errors.length > 0) {
    errors.forEach(e => logger.error(`[Config Validation Failure] ${e}`));
    throw new Error(`Environment validation failed with ${errors.length} error(s). See log output for remediation.`);
  }

  return { isValid: true, warningsCount: warnings.length };
}

module.exports = {
  validateEnvironment,
  DEFAULT_DEMO_KEYS
};
