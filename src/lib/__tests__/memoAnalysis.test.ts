/**
 * Tests for memo categorization, entity extraction, memo-based semantic
 * search, and template suggestions in ../memoAnalysis.
 */

import {
  categorizeMemo,
  extractMemoEntities,
  indexTransactionMemos,
  searchTransactionMemos,
  suggestMemoTemplates,
} from '../memoAnalysis';
import { globalSemanticSearch } from '../semanticSearch';

describe('categorizeMemo', () => {
  it('categorizes an invoice memo', () => {
    expect(categorizeMemo('Invoice #1234 payment').category).toBe('invoice');
  });

  it('categorizes a refund memo', () => {
    expect(categorizeMemo('Refund for order 55').category).toBe('refund');
  });

  it('categorizes a subscription memo', () => {
    expect(categorizeMemo('Monthly subscription renewal').category).toBe('subscription');
  });

  it('categorizes a reference/order memo', () => {
    expect(categorizeMemo('Order PO-9981').category).toBe('reference');
  });

  it('categorizes a generic payment memo', () => {
    expect(categorizeMemo('Salary payment July').category).toBe('payment');
  });

  it('falls back to "other" when nothing matches', () => {
    expect(categorizeMemo('xyz random text').category).toBe('other');
  });

  it('returns "other" with no keywords for empty/undefined/null memos', () => {
    expect(categorizeMemo('')).toEqual({ category: 'other', matchedKeywords: [] });
    expect(categorizeMemo(undefined)).toEqual({ category: 'other', matchedKeywords: [] });
    expect(categorizeMemo(null)).toEqual({ category: 'other', matchedKeywords: [] });
  });

  it('is case-insensitive', () => {
    expect(categorizeMemo('INVOICE 42').category).toBe('invoice');
  });

  it('reports which keyword(s) matched', () => {
    const result = categorizeMemo('invoice payment due');
    expect(result.matchedKeywords).toContain('invoice');
  });

  it('prefers the more specific "refund" category over generic "payment"', () => {
    expect(categorizeMemo('refund payment for invoice 12').category).toBe('refund');
  });
});

describe('extractMemoEntities', () => {
  it('extracts a hash-prefixed identifier', () => {
    const { identifiers } = extractMemoEntities('Order #5678 shipped');
    expect(identifiers).toContain('#5678');
  });

  it('extracts an invoice-style identifier', () => {
    const { identifiers } = extractMemoEntities('INV-1234 due soon');
    expect(identifiers.some((id) => id.toUpperCase().includes('INV-1234'))).toBe(true);
  });

  it('extracts an ISO date', () => {
    const { dates } = extractMemoEntities('Due 2026-07-25 final notice');
    expect(dates).toContain('2026-07-25');
  });

  it('extracts both identifiers and dates from the same memo', () => {
    const result = extractMemoEntities('INV-42 due 2026-01-05');
    expect(result.identifiers.length).toBeGreaterThan(0);
    expect(result.dates).toEqual(['2026-01-05']);
  });

  it('returns empty arrays for a memo with no recognizable entities', () => {
    expect(extractMemoEntities('thanks for lunch')).toEqual({ identifiers: [], dates: [] });
  });

  it('returns empty arrays for null/undefined memos', () => {
    expect(extractMemoEntities(null)).toEqual({ identifiers: [], dates: [] });
    expect(extractMemoEntities(undefined)).toEqual({ identifiers: [], dates: [] });
  });

  it('deduplicates repeated identifiers', () => {
    const { identifiers } = extractMemoEntities('ref-1 ref-1 ref-1');
    expect(identifiers).toHaveLength(1);
  });
});

describe('indexTransactionMemos / searchTransactionMemos', () => {
  beforeEach(() => {
    globalSemanticSearch.clearIndex();
  });

  it('indexes only transactions with a non-empty memo and returns the indexed count', () => {
    const indexed = indexTransactionMemos([
      { id: 'tx1', memo: 'Invoice payment for services' },
      { id: 'tx2', memo: '' },
      { id: 'tx3', memo: null },
      { id: 'tx4', memo: 'Refund for order 99' },
    ]);

    expect(indexed).toBe(2);
    expect(globalSemanticSearch.getIndexSize()).toBe(2);
  });

  it('makes indexed memos findable by meaning via the shared semantic search engine', () => {
    indexTransactionMemos([
      { id: 'tx1', memo: 'XLM payment sent to vendor' },
      { id: 'tx2', memo: 'Soroban contract invoke failed' },
    ]);

    const results = searchTransactionMemos('payment');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].document.id).toBe('tx1');
  });
});

describe('suggestMemoTemplates', () => {
  it('ranks memos by how often they were used historically', () => {
    const history = ['Invoice payment', 'Invoice payment', 'Refund', 'Invoice payment', 'Refund'];
    expect(suggestMemoTemplates(history)).toEqual(['Invoice payment', 'Refund']);
  });

  it('respects the limit parameter', () => {
    const history = ['a', 'a', 'b', 'b', 'c'];
    expect(suggestMemoTemplates(history, 2)).toEqual(['a', 'b']);
  });

  it('ignores empty/null/undefined memos', () => {
    expect(suggestMemoTemplates(['', null, undefined, 'real memo'])).toEqual(['real memo']);
  });

  it('returns an empty array when there is no history', () => {
    expect(suggestMemoTemplates([])).toEqual([]);
  });
});
