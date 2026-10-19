import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const dataDir = process.env.DATA_DIR || 'data';
mkdirSync(dataDir, { recursive: true });
const db = new Database(join(dataDir, 'bot.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  username TEXT,
  blocked INTEGER NOT NULL DEFAULT 0,
  broadcasts_opt_in INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  success INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);
export function upsertUser(id: number, username?: string) {
  db.prepare(`INSERT INTO users(id, username) VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen=datetime('now'), username=excluded.username, blocked=0`).run(id, username ?? null);
}
export function setOptIn(id: number, enabled: boolean) {
  db.prepare('UPDATE users SET broadcasts_opt_in=? WHERE id=?').run(enabled ? 1 : 0, id);
}
export function isOptedIn(id: number): boolean {
  return Boolean((db.prepare('SELECT broadcasts_opt_in AS value FROM users WHERE id=?').get(id) as {value:number}|undefined)?.value);
}
export function setBlocked(id: number) {
  db.prepare('UPDATE users SET blocked=1 WHERE id=?').run(id);
}
export function recordCheck(id: number, success: boolean) {
  db.prepare('INSERT INTO checks(user_id, success) VALUES (?, ?)').run(id, success ? 1 : 0);
}
export function stats() {
  const count = (sql: string) => (db.prepare(sql).get() as {n:number}).n;
  return {
    totalUsers: count('SELECT COUNT(*) n FROM users'),
    activeWeek: count("SELECT COUNT(*) n FROM users WHERE last_seen >= datetime('now','-7 days')"),
    newToday: count("SELECT COUNT(*) n FROM users WHERE first_seen >= datetime('now','start of day')"),
    successfulChecks: count('SELECT COUNT(*) n FROM checks WHERE success=1'),
    failedChecks: count('SELECT COUNT(*) n FROM checks WHERE success=0'),
    eligibleBroadcast: count('SELECT COUNT(*) n FROM users WHERE blocked=0 AND broadcasts_opt_in=1')
  };
}
export function broadcastUsers(): number[] {
  return (db.prepare('SELECT id FROM users WHERE blocked=0 AND broadcasts_opt_in=1 ORDER BY id').all() as {id:number}[]).map(x=>x.id);
}
