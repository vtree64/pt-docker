const DB_NAME = 'pt_tracker_db';
const DB_VERSION = 1;
const STORES = ['exercises', 'templates', 'workout_logs'];
const statusEl = document.getElementById('migration-status');

function status(message) {
  statusEl.textContent = message;
}

function openLegacyDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error('Could not open IndexedDB'));
    req.onsuccess = () => resolve(req.result);
  });
}

function readAll(db, storeName) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) return resolve([]);
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function exportIndexedDB() {
  const db = await openLegacyDB();
  const data = Object.fromEntries(await Promise.all(STORES.map(async store => [store, await readAll(db, store)])));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pt-tracker-indexeddb-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  status(`Exported ${STORES.map(store => `${data[store].length} ${store}`).join(', ')}.`);
}

async function importJson() {
  const file = document.getElementById('import-file').files[0];
  if (!file) throw new Error('Choose a JSON export file first.');
  const payload = JSON.parse(await file.text());
  const res = await fetch('./api/migrate/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Import failed');
  status(`Import complete: ${JSON.stringify(result.counts, null, 2)}`);
}

document.getElementById('btn-export-idb').addEventListener('click', () => {
  exportIndexedDB().catch(error => status(`Export failed: ${error.message}`));
});

document.getElementById('btn-import-json').addEventListener('click', () => {
  importJson().catch(error => status(`Import failed: ${error.message}`));
});
