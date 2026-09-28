/**
 * Translation Memory (TM) — AI-Powered Multi-Language Support
 *
 * Stores previously translated segments so they can be reused for consistency.
 * Persisted in localStorage with an in-memory LRU-style Map as the hot layer.
 */

export interface TMEntry {
  source: string;
  target: string;
  lang: string;
  score: number;       // 0–1 quality score
  source_lang: string;
  context?: string;
  contributed?: boolean; // true when user submitted a correction
  updatedAt: number;
}

const STORAGE_KEY = 'stellar-tm-v1';
const MAX_ENTRIES = 2000;

/** Normalise text for TM lookup (trim + collapse whitespace). */
function normalise(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function buildKey(sourceLang: string, targetLang: string, source: string): string {
  return `${sourceLang}|${targetLang}|${normalise(source)}`;
}

class TranslationMemoryStore {
  private store = new Map<string, TMEntry>();
  private loaded = false;

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const entries: TMEntry[] = JSON.parse(raw);
      for (const e of entries) {
        const key = buildKey(e.source_lang, e.lang, e.source);
        this.store.set(key, e);
      }
    } catch {
      // ignore corrupt data
    }
  }

  private persist(): void {
    try {
      const entries = Array.from(this.store.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // storage may be full — silently skip
    }
  }

  /** Look up an exact match. Returns null on miss. */
  get(sourceLang: string, targetLang: string, source: string): TMEntry | null {
    this.ensureLoaded();
    return this.store.get(buildKey(sourceLang, targetLang, source)) ?? null;
  }

  /** Store or update a translation. User corrections get score 1. */
  set(entry: TMEntry): void {
    this.ensureLoaded();
    const key = buildKey(entry.source_lang, entry.lang, entry.source);
    const existing = this.store.get(key);
    // Keep higher-quality entry unless user is contributing a correction
    if (existing && existing.score >= entry.score && !entry.contributed) return;
    this.store.set(key, { ...entry, updatedAt: Date.now() });
    this.persist();
  }

  /** All entries for a given target language (for export / review). */
  getByLanguage(lang: string): TMEntry[] {
    this.ensureLoaded();
    return Array.from(this.store.values()).filter((e) => e.lang === lang);
  }

  /** Clear the TM (dev / testing). */
  clear(): void {
    this.store.clear();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  get size(): number {
    this.ensureLoaded();
    return this.store.size;
  }
}

export const translationMemory = new TranslationMemoryStore();
export default translationMemory;
