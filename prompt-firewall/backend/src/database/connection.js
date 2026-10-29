const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const logger = require('../utils/logger');

let dbInstance = null;

function getDatabase(customPath = null) {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = customPath || process.env.DATABASE_PATH || path.join(__dirname, '../../data/firewall.db');

  // Ensure target directory exists
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  try {
    dbInstance = new Database(dbPath);
    // Performance and safety pragmas
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('busy_timeout = 5000');
    dbInstance.pragma('synchronous = NORMAL');
    logger.info(`SQLite Database connected successfully at ${dbPath}`);
    return dbInstance;
  } catch (err) {
    logger.error(`Failed to connect to SQLite at ${dbPath}: ${err.message}`);
    throw err;
  }
}

function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close();
      logger.info('SQLite Database connection closed');
    } catch (err) {
      logger.warn(`Error closing SQLite: ${err.message}`);
    } finally {
      dbInstance = null;
    }
  }
}

module.exports = {
  getDatabase,
  closeDatabase
};
