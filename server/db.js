'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH, IS_TEST } = require('./config');

const MIGRATIONS_DIR = path.join(__dirname, 'db', 'migrations');

let _db = null;

function open(pathOverride) {
  const file = pathOverride || DB_PATH;
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  return db;
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map(r => r.name)
  );

  const insertMigration = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      insertMigration.run(file);
    })();
    if (!IS_TEST) console.log(`✅ Migration applied: ${file}`);
  }
}

function init(pathOverride) {
  if (_db) return _db;
  _db = open(pathOverride);
  runMigrations(_db);
  return _db;
}

function getDb() {
  if (!_db) throw new Error('DB not initialized — call init() first');
  return _db;
}

function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function reset() {
  close();
}

module.exports = {
  init,
  getDb,
  close,
  reset,
  open,
  runMigrations,
};
