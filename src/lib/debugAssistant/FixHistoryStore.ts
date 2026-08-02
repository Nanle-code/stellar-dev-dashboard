import { openDB, type IDBPDatabase } from 'idb';

export interface FixRecord {
  id: string;
  errorMessage: string;
  errorCategory: string;
  errorFingerprint: string;
  context: string;
  solution: string;
  solutionSource: 'ml' | 'pattern' | 'manual' | 'historical';
  wasHelpful: boolean | null;
  appliedAt: string;
  resolvedAt: string | null;
  duration: number;
  network: string;
  activeTab: string;
  metadata: Record<string, unknown>;
}

interface FixHistoryDB {
  fixes: FixRecord;
  errorPatterns: {
    id: string;
    fingerprint: string;
    errorMessage: string;
    category: string;
    frequency: number;
    firstSeen: string;
    lastSeen: string;
    commonSolutions: string[];
    resolvedRate: number;
  };
}

const DB_NAME = 'debug-assistant-store';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FixHistoryDB>> | null = null;

function getDb(): Promise<IDBPDatabase<FixHistoryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FixHistoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('fixes')) {
          const fixStore = db.createObjectStore('fixes', { keyPath: 'id' });
          fixStore.createIndex('by-category', 'errorCategory');
          fixStore.createIndex('by-fingerprint', 'errorFingerprint');
          fixStore.createIndex('by-helpful', 'wasHelpful');
          fixStore.createIndex('by-applied', 'appliedAt');
        }
        if (!db.objectStoreNames.contains('errorPatterns')) {
          const patternStore = db.createObjectStore('errorPatterns', { keyPath: 'id' });
          patternStore.createIndex('by-fingerprint', 'fingerprint', { unique: true });
          patternStore.createIndex('by-frequency', 'frequency');
        }
      },
    });
  }
  return dbPromise;
}

function generateFingerprint(errorMessage: string, category: string): string {
  const normalized = errorMessage.toLowerCase().replace(/[^a-z0-9]/g, '');
  const parts = normalized.slice(0, 80);
  return `${category}:${parts}`;
}

export async function recordFix(fix: Omit<FixRecord, 'id' | 'appliedAt'>): Promise<string> {
  const db = await getDb();
  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const record: FixRecord = { ...fix, id, appliedAt: new Date().toISOString() };
  await db.add('fixes', record);

  const fingerprint = fix.errorFingerprint;
  const tx = db.transaction('errorPatterns', 'readwrite');
  const patternStore = tx.objectStore('errorPatterns');
  const index = patternStore.index('by-fingerprint');
  let existing = await index.get(fingerprint);

  if (existing) {
    existing.frequency += 1;
    existing.lastSeen = record.appliedAt;
    if (!existing.commonSolutions.includes(fix.solution)) {
      existing.commonSolutions.push(fix.solution);
    }
    await patternStore.put(existing);
  } else {
    await patternStore.add({
      id: fingerprint,
      fingerprint,
      errorMessage: fix.errorMessage,
      category: fix.errorCategory,
      frequency: 1,
      firstSeen: record.appliedAt,
      lastSeen: record.appliedAt,
      commonSolutions: [fix.solution],
      resolvedRate: 0,
    });
  }

  return id;
}

export async function updateFixHelpful(id: string, wasHelpful: boolean): Promise<void> {
  const db = await getDb();
  const record = await db.get('fixes', id);
  if (!record) return;
  record.wasHelpful = wasHelpful;
  record.resolvedAt = new Date().toISOString();
  await db.put('fixes', record);

  const fingerprint = record.errorFingerprint;
  const tx = db.transaction('errorPatterns', 'readwrite');
  const patternStore = tx.objectStore('errorPatterns');
  const index = patternStore.index('by-fingerprint');
  const pattern = await index.get(fingerprint);
  if (pattern) {
    const allFixes = await db.getAllFromIndex('fixes', 'by-fingerprint', fingerprint);
    const resolved = allFixes.filter((f) => f.wasHelpful === true).length;
    const total = allFixes.filter((f) => f.wasHelpful !== null).length;
    pattern.resolvedRate = total > 0 ? resolved / total : 0;
    await patternStore.put(pattern);
  }
}

export async function getRecentFixes(limit = 20): Promise<FixRecord[]> {
  const db = await getDb();
  const fixes = await db.getAllFromIndex('fixes', 'by-applied');
  return fixes.reverse().slice(0, limit);
}

export async function getFixesByFingerprint(fingerprint: string): Promise<FixRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex('fixes', 'by-fingerprint', fingerprint);
}

export async function getPatternsByCategory(category: string) {
  const db = await getDb();
  const index = db.transaction('errorPatterns').store.index('by-frequency');
  const patterns = await index.getAll();
  return patterns.filter((p) => p.category === category).sort((a, b) => b.frequency - a.frequency);
}

export async function getSimilarFixes(
  errorMessage: string,
  category: string,
  limit = 5,
): Promise<FixRecord[]> {
  const fingerprint = generateFingerprint(errorMessage, category);
  const exact = await getFixesByFingerprint(fingerprint);
  if (exact.length >= limit) return exact.slice(0, limit);

  const db = await getDb();
  const allCategory = await db.getAllFromIndex('fixes', 'by-category', category);
  const similarity = allCategory.map((fix) => {
    const fp = generateFingerprint(fix.errorMessage, fix.errorCategory);
    const score = similarScore(fingerprint, fp);
    return { fix, score };
  });
  similarity.sort((a, b) => b.score - a.score);
  return similarity.slice(0, limit).map((s) => s.fix);
}

function similarScore(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  await db.clear('fixes');
  await db.clear('errorPatterns');
}

export { generateFingerprint };
