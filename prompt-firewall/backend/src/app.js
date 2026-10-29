const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const requestIdMiddleware = require('./middleware/requestIdMiddleware');
const errorHandler = require('./middleware/errorHandler');

const healthRoutes = require('./routes/healthRoutes');
const chatRoutes = require('./routes/chatRoutes');
const auditRoutes = require('./routes/auditRoutes');
const configRoutes = require('./routes/configRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const authRoutes = require('./routes/authRoutes');

function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Trust proxy for rate limiting if behind reverse proxy
  app.set('trust proxy', 1);

  // 2. Strict Security Headers via Helmet
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    noSniff: true,
    xssFilter: true
  }));

  // 3. CORS Configuration with strict origin controls
  const configuredOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, same-origin, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (isProduction) {
        // In production: strictly match explicitly configured origins
        if (configuredOrigins.includes(origin)) {
          return callback(null, true);
        }
        const corsErr = new Error('Not allowed by CORS policy');
        corsErr.status = 403;
        return callback(corsErr);
      } else {
        // In development/test: allow configured origins or localhost dev servers
        if (
          configuredOrigins.includes('*') ||
          configuredOrigins.includes(origin) ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          return callback(null, true);
        }
        const corsErr = new Error('Not allowed by CORS policy');
        corsErr.status = 403;
        return callback(corsErr);
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400 // Cache preflight for 24 hours
  }));

  // 4. HTTP Method Guard (Reject unsupported HTTP verbs)
  app.use((req, res, next) => {
    const allowedMethods = ['GET', 'POST', 'OPTIONS'];
    if (!allowedMethods.includes(req.method)) {
      return res.status(405).json({
        requestId: req.id || 'unknown',
        error: `HTTP Method ${req.method} is not allowed on this server`
      });
    }
    next();
  });

  // 5. Request ID Assignment
  app.use(requestIdMiddleware);

  // 6. Body Parsing with strict size limit (10kb)
  app.use(express.json({ limit: '10kb' }));

  // 7. Mount API Route Modules
  app.use('/api', healthRoutes);
  app.use('/api', chatRoutes);
  app.use('/api', auditRoutes);
  app.use('/api', configRoutes);
  app.use('/api', reviewRoutes);
  app.use('/api', authRoutes);

  // 8. 404 Route Not Found Handler
  app.use((req, res) => {
    res.status(404).json({
      requestId: req.id,
      error: `Resource not found: ${req.method} ${req.originalUrl}`
    });
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
