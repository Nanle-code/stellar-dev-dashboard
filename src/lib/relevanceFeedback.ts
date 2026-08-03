/**
 * Relevance Feedback Store
 *
 * Captures three types of user signal for a (queryId, documentId) pair:
 *   - click          : user clicked a result (weak positive)
 *   - thumbsUp       : user explicitly marked a result as relevant
 *   - thumbsDown     : user explicitly marked a result as not relevant
 *
 * Signals are accumulated over sessions using localStorage.  A boost value
 * between -1 and +1 is derived from the net signal strength and exposed via
 * getRelevanceBoost(), which the SemanticSearchEngine uses during ranking.
 *
 * Boost derivation:
 *   rawScore = (thumbsUp * 2 + clicks) - (thumbsDown * 2)
 *   boost    = tanh(rawScore / 5)   → smoothly bounded to (-1, +1)
 *
 * The tanh function ensures that a few strong signals produce a meaningful
 * boost, while noisy or contradictory signals average out gracefully.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeedbackSignal = 'click' | 'thumbsUp' | 'thumbsDown';

export interface FeedbackEntry {
  queryId: string;
  documentId: string;
  clicks: number;
  thumbsUp: number;
  thumbsDown: number;
  lastUpdated: number; // Unix ms
}

export interface FeedbackStats {
  totalEntries: number;
  totalClicks: number;
  totalThumbsUp: number;
  totalThumbsDown: number;
  topDocuments: Array<{ documentId: string; boost: number }>;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'stellar-relevance-feedback-v1';

function loadFromStorage(): Map<string, FeedbackEntry> {
  try {
    if (typeof localStorage === 'undefined') return new Map();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const entries: FeedbackEntry[] = JSON.parse(raw);
    return new Map(entries.map((e) => [`${e.queryId}::${e.documentId}`, e]));
  } catch {
    return new Map();
  }
}

function saveToStorage(store: Map<string, FeedbackEntry>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const entries = Array.from(store.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage can throw in private browsing or when storage is full
  }
}

function composeKey(queryId: string, documentId: string): string {
  return `${queryId}::${documentId}`;
}

// ---------------------------------------------------------------------------
// Boost maths
// ---------------------------------------------------------------------------

function computeBoost(entry: FeedbackEntry): number {
  const rawScore = entry.thumbsUp * 2 + entry.clicks - entry.thumbsDown * 2;
  // tanh smoothly maps (-∞,+∞) → (-1,+1) with unit-scale around 0
  return Math.tanh(rawScore / 5);
}

// ---------------------------------------------------------------------------
// RelevanceFeedbackStore
// ---------------------------------------------------------------------------

export class RelevanceFeedbackStore {
  private store: Map<string, FeedbackEntry>;

  constructor() {
    this.store = loadFromStorage();
  }

  // ---------------------------------------------------------------------------
  // Record signals
  // ---------------------------------------------------------------------------

  /**
   * Record a user signal for a (queryId, documentId) pair.
   *
   * @param queryId   - A stable identifier for the current query (e.g. normalised query string)
   * @param documentId - The document's unique identifier
   * @param signal    - The type of user interaction
   */
  record(queryId: string, documentId: string, signal: FeedbackSignal): void {
    const key = composeKey(queryId, documentId);
    const existing = this.store.get(key) ?? {
      queryId,
      documentId,
      clicks: 0,
      thumbsUp: 0,
      thumbsDown: 0,
      lastUpdated: 0,
    };

    switch (signal) {
      case 'click':
        existing.clicks += 1;
        break;
      case 'thumbsUp':
        existing.thumbsUp += 1;
        // Remove any thumbsDown to avoid contradictions accumulating
        existing.thumbsDown = Math.max(0, existing.thumbsDown - 1);
        break;
      case 'thumbsDown':
        existing.thumbsDown += 1;
        existing.thumbsUp = Math.max(0, existing.thumbsUp - 1);
        break;
    }

    existing.lastUpdated = Date.now();
    this.store.set(key, existing);
    saveToStorage(this.store);
  }

  // ---------------------------------------------------------------------------
  // Retrieve boosts
  // ---------------------------------------------------------------------------

  /**
   * Get the relevance boost for a specific (queryId, documentId) pair.
   * Returns a value in (-1, +1).  Positive = boost; negative = demotion.
   */
  getRelevanceBoost(queryId: string, documentId: string): number {
    const key = composeKey(queryId, documentId);
    const entry = this.store.get(key);
    if (!entry) return 0;
    return computeBoost(entry);
  }

  /**
   * Get a map of { documentId → boost } for all documents associated with a
   * given query.  Pass the result directly to SemanticSearchEngine.search()
   * as the `feedbackBoosts` option.
   */
  getBoostsForQuery(queryId: string): Record<string, number> {
    const boosts: Record<string, number> = {};
    for (const entry of this.store.values()) {
      if (entry.queryId === queryId) {
        const boost = computeBoost(entry);
        if (boost !== 0) boosts[entry.documentId] = boost;
      }
    }
    return boosts;
  }

  /**
   * Return raw feedback entry for a (queryId, documentId) pair, or null if
   * no feedback has been recorded.
   */
  getEntry(queryId: string, documentId: string): FeedbackEntry | null {
    return this.store.get(composeKey(queryId, documentId)) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Introspection / management
  // ---------------------------------------------------------------------------

  getStats(): FeedbackStats {
    let totalClicks = 0;
    let totalThumbsUp = 0;
    let totalThumbsDown = 0;
    const boostMap: Map<string, number> = new Map();

    for (const entry of this.store.values()) {
      totalClicks += entry.clicks;
      totalThumbsUp += entry.thumbsUp;
      totalThumbsDown += entry.thumbsDown;

      const boost = computeBoost(entry);
      const prev = boostMap.get(entry.documentId) ?? 0;
      boostMap.set(entry.documentId, Math.max(prev, boost));
    }

    const topDocuments = Array.from(boostMap.entries())
      .map(([documentId, boost]) => ({ documentId, boost }))
      .sort((a, b) => b.boost - a.boost)
      .slice(0, 10);

    return {
      totalEntries: this.store.size,
      totalClicks,
      totalThumbsUp,
      totalThumbsDown,
      topDocuments,
    };
  }

  /** Remove feedback for a specific document across all queries. */
  clearDocument(documentId: string): void {
    for (const key of Array.from(this.store.keys())) {
      if (key.endsWith(`::${documentId}`)) this.store.delete(key);
    }
    saveToStorage(this.store);
  }

  /** Remove all feedback for a specific query. */
  clearQuery(queryId: string): void {
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(`${queryId}::`)) this.store.delete(key);
    }
    saveToStorage(this.store);
  }

  /** Wipe all stored feedback. */
  clearAll(): void {
    this.store.clear();
    saveToStorage(this.store);
  }

  /**
   * Prune entries older than `maxAgeDays` days.
   * Useful to call periodically to prevent unbounded storage growth.
   */
  pruneOld(maxAgeDays = 90): number {
    const cutoff = Date.now() - maxAgeDays * 86_400_000;
    let pruned = 0;
    for (const [key, entry] of Array.from(this.store.entries())) {
      if (entry.lastUpdated < cutoff) {
        this.store.delete(key);
        pruned++;
      }
    }
    if (pruned > 0) saveToStorage(this.store);
    return pruned;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
export const globalRelevanceFeedback = new RelevanceFeedbackStore();
