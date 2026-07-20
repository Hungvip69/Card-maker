import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'cards.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id          TEXT PRIMARY KEY,
    manage_token TEXT NOT NULL UNIQUE,
    payload     TEXT NOT NULL,
    views       INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    open_at     INTEGER NOT NULL DEFAULT 0,
    allow_reactions INTEGER NOT NULL DEFAULT 1,
    allow_replies   INTEGER NOT NULL DEFAULT 1,
    guestbook       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id    TEXT NOT NULL,
    sender     TEXT,
    body       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id    TEXT NOT NULL,
    emoji      TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_cards_expires ON cards(expires_at);
  CREATE INDEX IF NOT EXISTS idx_messages_card ON messages(card_id);
  CREATE INDEX IF NOT EXISTS idx_reactions_card ON reactions(card_id);
`);

try {
  // Migration nhẹ: thêm cột meta cho DB đã tồn tại (bỏ qua nếu đã có).
  db.exec(`ALTER TABLE cards ADD COLUMN open_at INTEGER NOT NULL DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE cards ADD COLUMN allow_reactions INTEGER NOT NULL DEFAULT 1`);
} catch {}
try {
  db.exec(`ALTER TABLE cards ADD COLUMN allow_replies INTEGER NOT NULL DEFAULT 1`);
} catch {}
try {
  db.exec(`ALTER TABLE cards ADD COLUMN guestbook INTEGER NOT NULL DEFAULT 0`);
} catch {}

/** Xóa các thiệp đã quá hạn (và lời nhắn liên quan qua ON DELETE CASCADE). */
export function purgeExpired() {
  const now = Date.now();
  const info = db.prepare('DELETE FROM cards WHERE expires_at <= ?').run(now);
  return info.changes;
}

export default db;
