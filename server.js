import express from 'express';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'pt-tracker.sqlite');
const STORES = new Set(['exercises', 'templates', 'workout_logs']);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workout_logs (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    date INTEGER,
    workout_kind TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_workout_logs_date ON workout_logs(date);
  CREATE INDEX IF NOT EXISTS idx_workout_logs_kind ON workout_logs(workout_kind);
`);

const app = express();
app.use(express.json({ limit: '10mb' }));

function assertStore(req, res, next) {
  if (!STORES.has(req.params.store)) {
    return res.status(404).json({ error: 'Unknown store' });
  }
  next();
}

function normalizeItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('Item must be an object');
  }
  if (!item.id || typeof item.id !== 'string') {
    throw new Error('Item.id must be a non-empty string');
  }
  return item;
}

function rowToItem(row) {
  return row ? JSON.parse(row.data) : null;
}

function putItem(store, item) {
  normalizeItem(item);
  const now = Date.now();
  if (store === 'workout_logs') {
    db.prepare(`
      INSERT INTO workout_logs (id, data, date, workout_kind, updated_at)
      VALUES (@id, @data, @date, @workout_kind, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        data=excluded.data,
        date=excluded.date,
        workout_kind=excluded.workout_kind,
        updated_at=excluded.updated_at
    `).run({
      id: item.id,
      data: JSON.stringify(item),
      date: Number.isFinite(item.date) ? item.date : null,
      workout_kind: item.workout_kind || null,
      updated_at: now
    });
  } else {
    db.prepare(`
      INSERT INTO ${store} (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at
    `).run(item.id, JSON.stringify(item), now);
  }
  return item.id;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/:store', assertStore, (req, res) => {
  const rows = db.prepare(`SELECT data FROM ${req.params.store}`).all();
  res.json(rows.map(rowToItem));
});

app.get('/api/:store/:id', assertStore, (req, res) => {
  const row = db.prepare(`SELECT data FROM ${req.params.store} WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(rowToItem(row));
});

app.put('/api/:store/:id', assertStore, (req, res) => {
  try {
    const item = normalizeItem({ ...req.body, id: req.params.id });
    putItem(req.params.store, item);
    res.json({ ok: true, id: item.id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/:store/bulk', assertStore, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Expected an array' });
  try {
    const tx = db.transaction(items => items.forEach(item => putItem(req.params.store, item)));
    tx(req.body);
    res.json({ ok: true, count: req.body.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/:store/:id', assertStore, (req, res) => {
  db.prepare(`DELETE FROM ${req.params.store} WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/save-exercise-and-templates', (req, res) => {
  const { exercise, templates } = req.body || {};
  if (!Array.isArray(templates)) return res.status(400).json({ error: 'templates must be an array' });
  try {
    const tx = db.transaction(() => {
      putItem('exercises', exercise);
      templates.forEach(template => putItem('templates', template));
    });
    tx();
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/migrate/import', (req, res) => {
  const payload = req.body || {};
  try {
    const tx = db.transaction(() => {
      for (const store of STORES) {
        const items = payload[store];
        if (items === undefined) continue;
        if (!Array.isArray(items)) throw new Error(`${store} must be an array`);
        items.forEach(item => putItem(store, item));
      }
    });
    tx();
    res.json({
      ok: true,
      counts: Object.fromEntries([...STORES].map(store => [store, Array.isArray(payload[store]) ? payload[store].length : 0]))
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/export', (_req, res) => {
  res.json(Object.fromEntries([...STORES].map(store => [store, db.prepare(`SELECT data FROM ${store}`).all().map(rowToItem)])));
});

app.use(express.static(__dirname, { extensions: ['html'] }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PT Tracker listening on http://0.0.0.0:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
