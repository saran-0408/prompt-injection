/**
 * SQLite Database Point-in-Time Online Backup Utility
 * Performs a safe, non-blocking online snapshot of the WAL database.
 */

const path = require('path');
const fs = require('fs');
const { getDatabase, closeDatabase } = require('./connection');
const logger = require('../utils/logger');

async function performBackup(targetDir = null) {
  const db = getDatabase();
  const backupFolder = targetDir || path.join(__dirname, '../../data/backups');

  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupFolder, `firewall-backup-${timestamp}.db`);

  try {
    logger.info(`Starting online backup to ${backupFile}...`);
    await db.backup(backupFile);
    logger.info(`Backup completed successfully: ${backupFile}`);
    return { success: true, backupFile };
  } catch (err) {
    logger.error(`Backup failed: ${err.message}`);
    throw err;
  }
}

if (require.main === module) {
  performBackup()
    .then(() => {
      closeDatabase();
      process.exit(0);
    })
    .catch(() => {
      closeDatabase();
      process.exit(1);
    });
}

module.exports = { performBackup };
