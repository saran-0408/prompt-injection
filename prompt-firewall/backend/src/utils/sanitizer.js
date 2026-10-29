/**
 * Input & Preview Sanitizer
 * Redacts PII, credentials, passwords, and tokens from audit logs and previews.
 */

const PII_PATTERNS = [
  // Emails
  { regex: /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, replacement: '[EMAIL_REDACTED]' },
  // OpenAI & Google API Keys
  { regex: /(?:sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35})/g, replacement: '[KEY_REDACTED]' },
  // Bearer tokens
  { regex: /bearer\s+[a-zA-Z0-9_\-\.]+/gi, replacement: 'Bearer [TOKEN_REDACTED]' },
  // Passwords / Secrets in key-value form
  { regex: /\b(password|passwd|secret|api[_-]?key)\s*[:=]\s*["']?[^\s"';,]+["']?/gi, replacement: '$1=[REDACTED]' },
  // Credit card PANs (13-16 digits with optional spaces or dashes)
  { regex: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[CARD_REDACTED]' },
  // Social Security Numbers (SSN)
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  // Phone numbers
  { regex: /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g, replacement: '[PHONE_REDACTED]' }
];

function sanitizePreview(text, maxLength = 160) {
  if (!text || typeof text !== 'string') return null;

  let sanitized = text;
  for (const { regex, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }

  // Normalize excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  if (sanitized.length > maxLength) {
    return sanitized.slice(0, maxLength) + '...';
  }
  return sanitized;
}

function sanitizeForReview(text) {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text;
  for (const { regex, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized.trim();
}

module.exports = {
  sanitizePreview,
  sanitizeForReview,
  PII_PATTERNS
};
