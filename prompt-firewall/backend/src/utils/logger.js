/**
 * Centralized, safe logger utility
 * Redacts secrets, auth headers, and sensitive tokens from log messages
 */

const SENSITIVE_PATTERNS = [
  /api[_-]?key["']?\s*[:=]\s*["']?([^"'\s]+)/gi,
  /bearer\s+([a-zA-Z0-9_\-\.]+)/gi,
  /password["']?\s*[:=]\s*["']?([^"'\s]+)/gi,
  /secret["']?\s*[:=]\s*["']?([^"'\s]+)/gi
];

function redactSensitiveData(str) {
  if (typeof str !== 'string') {
    try {
      str = JSON.stringify(str);
    } catch {
      return String(str);
    }
  }
  let sanitized = str;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      return match.split(/[:= ]/)[0] + '=[REDACTED]';
    });
  }
  return sanitized;
}

const logger = {
  info: (msg, meta) => {
    const time = new Date().toISOString();
    const metaStr = meta ? ` | ${redactSensitiveData(meta)}` : '';
    console.log(`[${time}] [INFO] ${redactSensitiveData(msg)}${metaStr}`);
  },
  warn: (msg, meta) => {
    const time = new Date().toISOString();
    const metaStr = meta ? ` | ${redactSensitiveData(meta)}` : '';
    console.warn(`[${time}] [WARN] ${redactSensitiveData(msg)}${metaStr}`);
  },
  error: (msg, meta) => {
    const time = new Date().toISOString();
    const metaStr = meta ? ` | ${redactSensitiveData(meta)}` : '';
    console.error(`[${time}] [ERROR] ${redactSensitiveData(msg)}${metaStr}`);
  },
  security: (msg, meta) => {
    const time = new Date().toISOString();
    const metaStr = meta ? ` | ${redactSensitiveData(meta)}` : '';
    console.log(`[${time}] [SECURITY_EVENT] ${redactSensitiveData(msg)}${metaStr}`);
  }
};

module.exports = logger;
