require('dotenv').config();

const createApp = require('./app');
const { validateEnvironment } = require('./utils/envValidator');
const { initSchema } = require('./database/schema');
const { getDatabase, closeDatabase } = require('./database/connection');
const { getAIProvider } = require('./services/aiProvider');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  try {
    // 1. Environment & Configuration Security Validation
    validateEnvironment();

    // 2. Initialize Database Schema
    const db = getDatabase();
    initSchema(db);

    // 3. Validate & Initialize AI Provider
    const aiProvider = getAIProvider();

    // 4. Create Express Application
    const app = createApp();

    // 5. Start HTTP Server
    const server = app.listen(PORT, () => {
      logger.info('====================================================');
      logger.info(` Prompt Firewall Server active on port ${PORT}`);
      logger.info(` Active AI Provider: ${aiProvider.name.toUpperCase()} (Model: ${aiProvider.model})`);
      logger.info(` Detector: Block Threshold >= ${process.env.DETECTOR_BLOCK_THRESHOLD || 70}, Review Threshold >= ${process.env.DETECTOR_REVIEW_THRESHOLD || 40}`);
      logger.info(` Database: SQLite initialized with WAL mode`);
      logger.info(` Health endpoint: http://localhost:${PORT}/api/health`);
      logger.info('====================================================');
    });

    // Graceful Shutdown Handlers
    const shutdown = (signal) => {
      logger.info(`Received ${signal}. Gracefully terminating firewall server...`);
      server.close(() => {
        closeDatabase();
        logger.info('Firewall server stopped.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    logger.error(`Fatal startup failure: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
