/**
 * templateFeedbackStore.ts — Issue #563
 *
 * Records which template a user actually chose for a given requirement, so the
 * recommendation engine can boost templates that proved useful for similar
 * needs. This is the "recommendations improve with usage" mechanism.
 *
 * Persistence uses IndexedDB, mirroring the pattern in templateLibrary.ts, with
 * an in-memory fallback so the store works in tests and SSR without IndexedDB.
 * The boost lookup exposed here is synchronous by design: the engine's scoring
 * is pure and synchronous, so the store keeps a warmed in-memory index that the
 * engine reads, and persists changes to IndexedDB in the background.
 */

const FEEDBACK_DB_NAME = 'stellar-dev-dashboard-template-feedback';
const FEEDBACK_DB_VERSION = 1;
const STORE = 'choices';

/** One recorded choice: for requirement `signature`, the user picked `templateId`. */
export interface FeedbackRecord {
  /** `${signature}::${templateId}` — the primary key. */
  key: string;
  signature: string;
  templateId: string;
  count: number;
  updatedAt: string;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

export class TemplateFeedbackStore {
  private db: IDBDatabase | null = null;
  /** Warmed in-memory index: key -> count. Read synchronously by the engine. */
  private readonly counts = new Map<string, number>();
  private ready = false;

  /** Open IndexedDB (if available) and warm the in-memory index. Idempotent. */
  async initialize(): Promise<void> {
    if (this.ready) return;
    if (hasIndexedDb()) {
      await this.openDb();
      await this.warmFromDb();
    }
    this.ready = true;
  }

  private openDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(FEEDBACK_DB_NAME, FEEDBACK_DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'key' });
          store.createIndex('signature', 'signature', { unique: false });
        }
      };
    });
  }

  private warmFromDb(): Promise<void> {
    if (!this.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE], 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        for (const rec of req.result as FeedbackRecord[]) {
          this.counts.set(rec.key, rec.count);
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  private static composeKey(signature: string, templateId: string): string {
    return `${signature}::${templateId}`;
  }

  /**
   * Record that `templateId` was chosen for the requirement `signature`.
   * Updates the in-memory index immediately and persists in the background.
   */
  async recordChoice(signature: string, templateId: string): Promise<void> {
    if (!this.ready) await this.initialize();
    const key = TemplateFeedbackStore.composeKey(signature, templateId);
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);

    if (!this.db) return;
    const record: FeedbackRecord = {
      key,
      signature,
      templateId,
      count: next,
      updatedAt: new Date().toISOString(),
    };
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE], 'readwrite');
      const req = tx.objectStore(STORE).put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Synchronous boost lookup for the recommendation engine: how many times
   * `templateId` was chosen for this exact requirement signature.
   */
  getBoost = (signature: string, templateId: string): number => {
    return this.counts.get(TemplateFeedbackStore.composeKey(signature, templateId)) ?? 0;
  };

  /** Clear all feedback (both memory and IndexedDB). Mainly for tests/settings. */
  async clear(): Promise<void> {
    this.counts.clear();
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE], 'readwrite');
      const req = tx.objectStore(STORE).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

/** Shared singleton used by the UI. Tests can construct their own instance. */
export const templateFeedbackStore = new TemplateFeedbackStore();