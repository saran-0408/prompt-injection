const rateLimit = require('express-rate-limit');

const chatRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX || '60', 10), // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      requestId: req.id,
      error: 'Too many requests from this IP address. Please slow down and try again shortly.',
      retryAfterSeconds: Math.ceil((req.rateLimit?.resetTime?.getTime() - Date.now()) / 1000) || 60
    });
  }
});

const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      requestId: req.id,
      error: 'Rate limit exceeded for administrative operations.'
    });
  }
});

// Stricter rate limiter for authentication endpoints to prevent brute-force attacks
const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      requestId: req.id,
      error: 'Too many authentication attempts. Please try again after 1 minute.',
      retryAfterSeconds: Math.ceil((req.rateLimit?.resetTime?.getTime() - Date.now()) / 1000) || 60
    });
  }
});

module.exports = {
  chatRateLimiter,
  adminRateLimiter,
  authRateLimiter
};
