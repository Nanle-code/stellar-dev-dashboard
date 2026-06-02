import { openDB } from 'idb'; // Using idb for simpler IndexedDB interactions

const DB_NAME = 'stellar-dev-dashboard';
const DB_VERSION = 1;
const STORE_NAME = 'alert-rules';

let dbPromise;

function initDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Saves an alert rule to IndexedDB.
 * @param {AlertRule} rule - The alert rule object to save.
 * @returns {Promise<string>} The ID of the saved rule.
 */
export async function saveAlertRule(rule) {
  const db = await initDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.put(rule);
  await tx.done;
  return rule.id;
}

/**
 * Reads all alert rules from IndexedDB.
 * @returns {Promise<AlertRule[]>} An array of alert rule objects.
 */
export async function getAlertRules() {
  const db = await initDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const rules = await tx.store.getAll();
  await tx.done;
  return rules;
}

/**
 * Deletes an alert rule from IndexedDB by its ID.
 * @param {string} ruleId - The ID of the rule to delete.
 * @returns {Promise<void>}
 */
export async function deleteAlertRule(ruleId) {
  const db = await initDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.delete(ruleId);
  await tx.done;
}

// Initialize the database on module load
initDb();