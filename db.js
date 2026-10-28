const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL;
const DB_PATH = isVercel ? path.join("/tmp", "skar.db") : path.join(__dirname, "skar.db");
const db = new sqlite3.Database(DB_PATH);

// ─── Initialize Database Tables ───────────────────────────────────────────────
db.serialize(() => {
  // Table: sessions
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table: messages
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      image_data TEXT,
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
    )
  `);

  // Index for fast query by session
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id)`);
});

// ─── DB Helper Functions (Promises) ──────────────────────────────────────────

// Create or update a session
function ensureSession(sessionId, firstMessageText = "New Conversation") {
  return new Promise((resolve, reject) => {
    const title = firstMessageText.slice(0, 40) + (firstMessageText.length > 40 ? "..." : "");
    const query = `
      INSERT INTO sessions (id, title, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    `;
    db.run(query, [sessionId, title], function (err) {
      if (err) reject(err);
      else resolve({ id: sessionId, title });
    });
  });
}

// Save a single message
function saveMessage({ sessionId, role, content, type = "text", imageData = null, model = null }) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO messages (session_id, role, content, type, image_data, model)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.run(query, [sessionId, role, content, type, imageData, model], function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  });
}

// Get message history for LLM context (last N messages)
function getSessionMessages(sessionId, limit = 20) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT role, content, type, image_data, model, created_at 
      FROM messages 
      WHERE session_id = ? 
      ORDER BY id ASC 
      LIMIT ?
    `;
    db.all(query, [sessionId, limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// Get all sessions (for sidebar/history)
function getAllSessions() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT id, title, created_at, updated_at 
      FROM sessions 
      ORDER BY updated_at DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// Delete a session and its messages
function deleteSession(sessionId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM messages WHERE session_id = ?`, [sessionId], (err) => {
      if (err) return reject(err);
      db.run(`DELETE FROM sessions WHERE id = ?`, [sessionId], (err2) => {
        if (err2) reject(err2);
        else resolve({ success: true });
      });
    });
  });
}

module.exports = {
  db,
  ensureSession,
  saveMessage,
  getSessionMessages,
  getAllSessions,
  deleteSession,
};
