/**
 * Transaction memo analysis — rule-based categorization, entity extraction,
 * memo-based semantic search, and historical template suggestions.
 *
 * Scope note: this is a deterministic, keyword/regex-based baseline, not a
 * trained NLP/ML model. Stellar memo text is capped at 28 characters
 * (see `src/lib/stellar.ts`), which makes a lightweight rule-based approach
 * a reasonable fit — there isn't enough text per memo for a statistical
 * classifier to meaningfully outperform explicit keyword rules. Accuracy
 * against real-world memo distributions has not been measured; there is no
 * labeled dataset in this repo to measure it against. Treat category output
 * as a best-effort hint, not a guarantee.
 */

import { globalSemanticSearch, type SearchResult } from './semanticSearch';

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

export type MemoCategory =
  | 'payment'
  | 'invoice'
  | 'refund'
  | 'subscription'
  | 'reference'
  | 'other';

export interface MemoCategorization {
  category: MemoCategory;
  /** Keywords in the memo that triggered this category, for transparency. */
  matchedKeywords: string[];
}

// Order matters: first matching category wins (object key order = check
// order). `refund` and `subscription` are checked before `invoice` so e.g.
// "refund for invoice 123" lands on `refund`, not `invoice`; `invoice` and
// `reference` are checked before the generic `payment` bucket.
const CATEGORY_KEYWORDS: Record<Exclude<MemoCategory, 'other'>, string[]> = {
  refund: ['refund', 'reversal', 'chargeback', 'return'],
  subscription: ['subscription', 'sub', 'renewal', 'recurring', 'membership'],
  invoice: ['invoice', 'inv', 'bill', 'billing'],
  reference: ['ref', 'reference', 'order', 'po', 'ticket', 'case'],
  payment: ['payment', 'pay', 'paid', 'salary', 'wage', 'invoice payment'],
};

/**
 * Categorizes a transaction memo using keyword matching.
 *
 * @param memo - Raw memo text (may be empty/undefined for memo-less transactions).
 * @returns The best-guess category and which keyword(s) matched, so callers
 *   (and reviewers) can see why a memo landed in a given bucket.
 */
export function categorizeMemo(memo: string | null | undefined): MemoCategorization {
  if (!memo || memo.trim().length === 0) {
    return { category: 'other', matchedKeywords: [] };
  }

  const lower = memo.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [Exclude<MemoCategory, 'other'>, string[]]
  >) {
    const matched = keywords.filter((kw) => lower.includes(kw));
    if (matched.length > 0) {
      return { category, matchedKeywords: matched };
    }
  }

  return { category: 'other', matchedKeywords: [] };
}

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

export interface MemoEntities {
  /** Alphanumeric identifiers that look like invoice/order/reference numbers (e.g. "INV-1234", "#5678"). */
  identifiers: string[];
  /** ISO-8601 dates found in the memo (e.g. "2026-07-25"). */
  dates: string[];
}

const IDENTIFIER_PATTERN = /(?:#|\b(?:inv|invoice|ord|order|ref|po|case)[-_]?)\s?\d[\w-]{1,15}/gi;
const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/g;

/**
 * Extracts identifiers and dates from a memo using regexes.
 *
 * This intentionally does not attempt free-form named-entity recognition;
 * it looks for the two entity shapes that actually fit in a 28-character
 * Stellar memo: a short reference/invoice/order code and an ISO date.
 */
export function extractMemoEntities(memo: string | null | undefined): MemoEntities {
  if (!memo) {
    return { identifiers: [], dates: [] };
  }

  const identifiers = Array.from(new Set(memo.match(IDENTIFIER_PATTERN) ?? [])).map((s) =>
    s.trim()
  );
  const dates = Array.from(new Set(memo.match(ISO_DATE_PATTERN) ?? []));

  return { identifiers, dates };
}

// ---------------------------------------------------------------------------
// Memo-based semantic search
// ---------------------------------------------------------------------------

export interface MemoTransaction {
  id: string;
  memo: string | null | undefined;
  [key: string]: unknown;
}

/**
 * Indexes a batch of transactions' memo text into the app's existing
 * `globalSemanticSearch` engine (TF-IDF + BM25 + Stellar-domain synonym
 * expansion — see `src/lib/semanticSearch.ts`), so memos become searchable
 * by meaning rather than exact substring match. Reuses existing,
 * already-tested infrastructure instead of introducing a second search
 * implementation.
 *
 * Transactions with an empty/missing memo are skipped — there is nothing
 * meaningful to index.
 */
export function indexTransactionMemos(transactions: MemoTransaction[]): number {
  const docs = transactions
    .filter((tx) => typeof tx.memo === 'string' && tx.memo.trim().length > 0)
    .map((tx) => ({
      id: tx.id,
      text: tx.memo as string,
      metadata: { ...tx, memo: tx.memo },
    }));

  if (docs.length > 0) {
    globalSemanticSearch.indexDocuments(docs);
  }

  return docs.length;
}

/** Searches previously-indexed transaction memos. Thin pass-through to keep call sites simple. */
export function searchTransactionMemos(query: string, topK = 10): SearchResult[] {
  return globalSemanticSearch.search(query, { topK });
}

// ---------------------------------------------------------------------------
// Template suggestions
// ---------------------------------------------------------------------------

/**
 * Suggests memo templates based on how often each exact memo string has
 * been used historically. This is frequency ranking, not generative
 * text — it surfaces memos the user (or their counterparties) already
 * reuses often, on the theory that past usage is the best available
 * signal for what they'll want to type next.
 *
 * @param pastMemos - Memo strings from prior transactions, most recent last.
 * @param limit - Maximum number of suggestions to return (default 5).
 */
export function suggestMemoTemplates(pastMemos: Array<string | null | undefined>, limit = 5): string[] {
  const counts = new Map<string, number>();

  for (const memo of pastMemos) {
    if (!memo || memo.trim().length === 0) continue;
    const trimmed = memo.trim();
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([memo]) => memo);
}
