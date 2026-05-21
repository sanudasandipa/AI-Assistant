let getHistory, addMessage, clearHistory;

try {
  const Database = require('better-sqlite3');
  const path = require('path');

  const dbPath = path.join(__dirname, 'whatsappbot.db');
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phoneNumber TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const insertMessage = db.prepare(`
    INSERT INTO messages (phoneNumber, role, content)
    VALUES (@phoneNumber, @role, @content)
  `);

  const selectHistory = db.prepare(`
    SELECT role, content
    FROM messages
    WHERE phoneNumber = ?
    ORDER BY id ASC
    LIMIT 20
  `);

  const deleteOldMessages = db.prepare(`
    DELETE FROM messages
    WHERE id IN (
      SELECT id
      FROM messages
      WHERE phoneNumber = ?
      ORDER BY id DESC
      LIMIT -1 OFFSET 20
    )
  `);

  getHistory = function (phoneNumber) {
    return selectHistory.all(phoneNumber).map((row) => ({ role: row.role, content: row.content }));
  };

  addMessage = function (phoneNumber, role, content) {
    const trimmedContent = String(content || '').trim();
    if (!trimmedContent) return;
    insertMessage.run({ phoneNumber, role, content: trimmedContent });
    deleteOldMessages.run(phoneNumber);
  };

  clearHistory = function (phoneNumber) {
    db.prepare('DELETE FROM messages WHERE phoneNumber = ?').run(phoneNumber);
  };
} catch (e) {
  // Fallback in-memory storage for environments without better-sqlite3
  const store = new Map();

  getHistory = function (phoneNumber) {
    const arr = store.get(phoneNumber) || [];
    return arr.slice(-20).map((m) => ({ role: m.role, content: m.content }));
  };

  addMessage = function (phoneNumber, role, content) {
    const trimmedContent = String(content || '').trim();
    if (!trimmedContent) return;
    const arr = store.get(phoneNumber) || [];
    arr.push({ role, content: trimmedContent });
    // keep last 20
    store.set(phoneNumber, arr.slice(-20));
  };

  clearHistory = function (phoneNumber) {
    store.delete(phoneNumber);
  };
}

module.exports = { getHistory, addMessage, clearHistory };
