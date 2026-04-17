const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'learningdog.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Beijing time (UTC+8) helpers
function beijingNow() {
  const offset = 8 * 60 * 60 * 1000;
  return new Date(Date.now() + offset).toISOString().replace('T', ' ').slice(0, 19);
}

function beijingToMs(timeStr) {
  if (!timeStr) return 0;
  return new Date(timeStr.replace(' ', 'T') + '+08:00').getTime();
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', '+8 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    max_users INTEGER NOT NULL CHECK(max_users IN (2, 4, 9)),
    created_at TEXT DEFAULT (datetime('now', '+8 hours'))
  );

  CREATE TABLE IF NOT EXISTS room_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    user_uuid TEXT NOT NULL,
    joined_at TEXT DEFAULT (datetime('now', '+8 hours')),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE,
    UNIQUE(room_id, user_uuid)
  );

  CREATE TABLE IF NOT EXISTS focus_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_uuid TEXT NOT NULL,
    room_id TEXT,
    start_time TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
    end_time TEXT,
    duration_seconds INTEGER,
    FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_uuid TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    created_at TEXT DEFAULT (datetime('now', '+8 hours')),
    FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS room_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_uuid TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', '+8 hours')),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_uuid) REFERENCES users(uuid) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS message_acks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    user_uuid TEXT NOT NULL,
    username TEXT NOT NULL,
    acked_at TEXT DEFAULT (datetime('now', '+8 hours')),
    FOREIGN KEY (message_id) REFERENCES room_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE,
    UNIQUE(message_id, user_uuid)
  );

  CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`);

// Migrate existing UTC timestamps to Beijing time (UTC+8)
const migrated = db.prepare("SELECT 1 FROM migrations WHERE name = 'utc_to_beijing'").get();
if (!migrated) {
  const migrate = db.transaction(() => {
    db.exec(`
      UPDATE users SET
        created_at = datetime(created_at, '+8 hours'),
        updated_at = datetime(updated_at, '+8 hours')
      WHERE created_at IS NOT NULL;

      UPDATE rooms SET
        created_at = datetime(created_at, '+8 hours')
      WHERE created_at IS NOT NULL;

      UPDATE room_members SET
        joined_at = datetime(joined_at, '+8 hours')
      WHERE joined_at IS NOT NULL;

      UPDATE focus_records SET
        start_time = datetime(start_time, '+8 hours')
      WHERE start_time IS NOT NULL;

      UPDATE focus_records SET
        end_time = datetime(end_time, '+8 hours')
      WHERE end_time IS NOT NULL;
    `);
    db.prepare("INSERT INTO migrations (name, applied_at) VALUES ('utc_to_beijing', ?)").run(beijingNow());
  });
  migrate();
  console.log('Migration utc_to_beijing applied successfully');
}

db.beijingNow = beijingNow;
db.beijingToMs = beijingToMs;

module.exports = db;
