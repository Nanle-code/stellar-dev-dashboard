/**
 * Tests for SemanticSearchEngine and RelevanceFeedbackStore
 */

import { SemanticSearchEngine } from '../semanticSearch';
import { RelevanceFeedbackStore } from '../relevanceFeedback';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEngine(): SemanticSearchEngine {
  return new SemanticSearchEngine();
}

function makeDocs() {
  return [
    { id: 'doc1', text: 'XLM payment transaction sent to testnet account' },
    { id: 'doc2', text: 'Soroban smart contract invoke failed on mainnet' },
    { id: 'doc3', text: 'Account balance query for USDC trustline' },
    { id: 'doc4', text: 'Stellar transaction successful operation payment' },
    { id: 'doc5', text: 'DEX trade offer sell buy liquidity pool' },
    { id: 'doc6', text: 'Failed transaction error rejected by network' },
  ];
}

// ---------------------------------------------------------------------------
// SemanticSearchEngine — indexing
// ---------------------------------------------------------------------------

describe('SemanticSearchEngine', () => {
  describe('indexing', () => {
    it('indexes documents and reports correct size', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      expect(engine.getIndexSize()).toBe(6);
    });

    it('clearIndex resets size to 0', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      engine.clearIndex();
      expect(engine.getIndexSize()).toBe(0);
    });

    it('indexDocument adds a single doc', () => {
      const engine = makeEngine();
      engine.indexDocument({ id: 'x', text: 'stellar xlm payment' });
      expect(engine.getIndexSize()).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------
  describe('search', () => {
    it('returns empty array when no documents indexed', () => {
      const engine = makeEngine();
      expect(engine.search('payment')).toEqual([]);
    });

    it('returns results for a relevant query', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      const results = engine.search('payment');
      expect(results.length).toBeGreaterThan(0);
    });

    it('ranks more relevant documents higher', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      const results = engine.search('payment transaction');
      // doc1 and doc4 both mention payment
      const ids = results.map((r) => r.document.id);
      expect(ids.some((id) => ['doc1', 'doc4'].includes(id))).toBe(true);
      // First result should have a higher score than last
      if (results.length > 1) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[results.length - 1].score);
      }
    });

    it('respects topK option', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      const results = engine.search('transaction', { topK: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('filters out results below minScore', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      const results = engine.search('payment', { minScore: 0.99 });
      results.forEach((r) => expect(r.score).toBeGreaterThanOrEqual(0.99));
    });

    it('returns scores in [0, 1]', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      const results = engine.search('xlm account');
      results.forEach((r) => {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
      });
    });

    it('provides explanation on each result', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      const results = engine.search('payment');
      results.forEach((r) => {
        expect(typeof r.explanation).toBe('string');
        expect(r.explanation.length).toBeGreaterThan(0);
      });
    });

    it('provides matchedTerms on each result', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      const results = engine.search('payment');
      const withMatches = results.filter((r) => r.matchedTerms.length > 0);
      expect(withMatches.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Synonym expansion
  // -------------------------------------------------------------------------
  describe('query expansion', () => {
    it('expands known synonyms', () => {
      const engine = makeEngine();
      const expansion = engine.expandQuery('send xlm');
      // 'send' → should expand to include 'payment'
      expect(expansion.expandedTerms).toContain('payment');
    });

    it('expands from reverse synonyms', () => {
      const engine = makeEngine();
      const expansion = engine.expandQuery('lumen');
      // 'lumen' → 'xlm' canonical
      expect(expansion.expandedTerms).toContain('xlm');
    });

    it('records synonymsUsed for original terms', () => {
      const engine = makeEngine();
      const expansion = engine.expandQuery('wallet');
      expect(Object.keys(expansion.synonymsUsed)).toContain('wallet');
    });

    it('improves recall via synonyms — send finds payment docs', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      // Query uses 'send' which is a synonym for 'payment'
      const withExpansion = engine.search('send', { expandQuery: true });
      const withoutExpansion = engine.search('send', { expandQuery: false });
      // With expansion should find at least as many results
      expect(withExpansion.length).toBeGreaterThanOrEqual(withoutExpansion.length);
    });
  });

  // -------------------------------------------------------------------------
  // Typo correction
  // -------------------------------------------------------------------------
  describe('typo correction', () => {
    it('corrects a single-character typo to a known vocab term', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      // 'paiment' has edit distance 1 from 'payment'
      const correction = engine.correctTypo('paiment');
      expect(correction.corrected).toBe('payment');
      expect(correction.wasCorreected).toBe(true);
    });

    it('does not correct a word already in vocab', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      const correction = engine.correctTypo('payment');
      expect(correction.wasCorreected).toBe(false);
      expect(correction.corrected).toBe('payment');
    });

    it('does not correct short words (< 4 chars)', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      const correction = engine.correctTypo('txn');
      expect(correction.wasCorreected).toBe(false);
    });

    it('correctQueryTerms corrects an array of terms', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      const { corrected, corrections } = engine.correctQueryTerms(['paiment', 'xlm']);
      expect(corrected[0]).toBe('payment');
      expect(corrections[0].wasCorreected).toBe(true);
      expect(corrections[1].wasCorreected).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Relevance feedback boosts
  // -------------------------------------------------------------------------
  describe('feedback boosts', () => {
    it('boosts a result when feedbackBoosts is positive', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());

      const baseResults = engine.search('payment', { feedbackBoosts: {} });
      const boostedResults = engine.search('payment', {
        feedbackBoosts: { doc4: 0.5 },
      });

      const baseDoc4 = baseResults.find((r) => r.document.id === 'doc4');
      const boostedDoc4 = boostedResults.find((r) => r.document.id === 'doc4');

      if (baseDoc4 && boostedDoc4) {
        expect(boostedDoc4.score).toBeGreaterThan(baseDoc4.score);
        expect(boostedDoc4.feedbackBoosted).toBe(true);
      }
    });

    it('demotes a result when feedbackBoosts is negative', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());

      const baseResults = engine.search('payment', { feedbackBoosts: {} });
      const demotedResults = engine.search('payment', {
        feedbackBoosts: { doc1: -0.5 },
      });

      const baseDoc1 = baseResults.find((r) => r.document.id === 'doc1');
      const demotedDoc1 = demotedResults.find((r) => r.document.id === 'doc1');

      if (baseDoc1 && demotedDoc1) {
        expect(demotedDoc1.score).toBeLessThan(baseDoc1.score);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Suggestions
  // -------------------------------------------------------------------------
  describe('getSuggestions', () => {
    it('returns vocab completions for partial input', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      const sug = engine.getSuggestions('pay');
      expect(sug.some((s) => s.startsWith('pay'))).toBe(true);
    });

    it('returns empty array for short input', () => {
      const engine = makeEngine();
      engine.indexDocuments(makeDocs());
      expect(engine.getSuggestions('x')).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Relevance improvement (semantic > keyword)
  // -------------------------------------------------------------------------
  describe('relevance improvement', () => {
    it('finds results for synonym query that keyword search would miss', () => {
      const engine = makeEngine();
      engine.indexDocuments([
        { id: 'a', text: 'payment made to GABCDE account' },
        { id: 'b', text: 'contract invocation on soroban' },
      ]);
      // 'send' is not literally in the documents, but synonym expansion → 'payment'
      const results = engine.search('send', { expandQuery: true });
      expect(results.some((r) => r.document.id === 'a')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// RelevanceFeedbackStore
// ---------------------------------------------------------------------------

describe('RelevanceFeedbackStore', () => {
  let store: RelevanceFeedbackStore;

  beforeEach(() => {
    // Use a fresh store backed by an in-memory mock (no real localStorage)
    store = new RelevanceFeedbackStore();
    store.clearAll();
  });

  describe('record and getRelevanceBoost', () => {
    it('starts at 0 boost for unknown pair', () => {
      expect(store.getRelevanceBoost('q1', 'doc1')).toBe(0);
    });

    it('click gives positive boost', () => {
      store.record('q1', 'doc1', 'click');
      expect(store.getRelevanceBoost('q1', 'doc1')).toBeGreaterThan(0);
    });

    it('thumbsUp gives stronger boost than click alone', () => {
      const storeA = new RelevanceFeedbackStore();
      storeA.clearAll();
      storeA.record('q', 'd', 'click');
      const clickBoost = storeA.getRelevanceBoost('q', 'd');

      const storeB = new RelevanceFeedbackStore();
      storeB.clearAll();
      storeB.record('q', 'd', 'thumbsUp');
      const thumbsBoost = storeB.getRelevanceBoost('q', 'd');

      expect(thumbsBoost).toBeGreaterThan(clickBoost);
    });

    it('thumbsDown gives negative boost', () => {
      store.record('q1', 'doc1', 'thumbsDown');
      expect(store.getRelevanceBoost('q1', 'doc1')).toBeLessThan(0);
    });

    it('thumbsUp cancels out a thumbsDown', () => {
      store.record('q1', 'doc1', 'thumbsDown');
      store.record('q1', 'doc1', 'thumbsUp');
      // After cancellation the entry should have no thumbsDown left
      const entry = store.getEntry('q1', 'doc1')!;
      expect(entry.thumbsDown).toBe(0);
      expect(store.getRelevanceBoost('q1', 'doc1')).toBeGreaterThan(0);
    });

    it('boost is bounded to (-1, 1)', () => {
      for (let i = 0; i < 20; i++) store.record('q1', 'doc1', 'thumbsUp');
      const boost = store.getRelevanceBoost('q1', 'doc1');
      expect(boost).toBeLessThan(1);
      expect(boost).toBeGreaterThan(0);
    });
  });

  describe('getBoostsForQuery', () => {
    it('returns all doc boosts for a given query', () => {
      store.record('q2', 'docA', 'thumbsUp');
      store.record('q2', 'docB', 'thumbsDown');
      store.record('q3', 'docA', 'click'); // different query — should not appear

      const boosts = store.getBoostsForQuery('q2');
      expect(Object.keys(boosts)).toContain('docA');
      expect(Object.keys(boosts)).toContain('docB');
      expect(Object.keys(boosts)).not.toContain('q3docA');
      expect(boosts['docA']).toBeGreaterThan(0);
      expect(boosts['docB']).toBeLessThan(0);
    });

    it('returns empty object when query has no feedback', () => {
      expect(store.getBoostsForQuery('unknown-query')).toEqual({});
    });
  });

  describe('clearAll / clearQuery / clearDocument', () => {
    it('clearAll removes all entries', () => {
      store.record('q1', 'doc1', 'click');
      store.record('q2', 'doc2', 'thumbsUp');
      store.clearAll();
      expect(store.getStats().totalEntries).toBe(0);
    });

    it('clearQuery removes only entries for that query', () => {
      store.record('q1', 'doc1', 'click');
      store.record('q2', 'doc1', 'click');
      store.clearQuery('q1');
      expect(store.getRelevanceBoost('q1', 'doc1')).toBe(0);
      expect(store.getRelevanceBoost('q2', 'doc1')).toBeGreaterThan(0);
    });

    it('clearDocument removes entries for that doc across all queries', () => {
      store.record('q1', 'doc1', 'thumbsUp');
      store.record('q2', 'doc1', 'thumbsUp');
      store.clearDocument('doc1');
      expect(store.getRelevanceBoost('q1', 'doc1')).toBe(0);
      expect(store.getRelevanceBoost('q2', 'doc1')).toBe(0);
    });
  });

  describe('getStats', () => {
    it('returns accurate counts', () => {
      store.record('q1', 'doc1', 'click');
      store.record('q1', 'doc2', 'thumbsUp');
      store.record('q1', 'doc3', 'thumbsDown');
      const stats = store.getStats();
      expect(stats.totalClicks).toBe(1);
      expect(stats.totalThumbsUp).toBe(1);
      expect(stats.totalThumbsDown).toBe(1);
      expect(stats.totalEntries).toBe(3);
    });

    it('topDocuments are sorted by boost descending', () => {
      store.record('q1', 'docHigh', 'thumbsUp');
      store.record('q1', 'docLow', 'thumbsDown');
      const stats = store.getStats();
      const boosts = stats.topDocuments.map((d) => d.boost);
      for (let i = 1; i < boosts.length; i++) {
        expect(boosts[i - 1]).toBeGreaterThanOrEqual(boosts[i]);
      }
    });
  });

  describe('pruneOld', () => {
    it('prunes entries older than maxAgeDays', () => {
      // Manually inject an old entry
      store.record('q1', 'doc1', 'click');
      const entry = store.getEntry('q1', 'doc1')!;
      // Hack: access private store to back-date entry
      (store as any).store.get('q1::doc1').lastUpdated = Date.now() - 100 * 86_400_000;

      const pruned = store.pruneOld(90);
      expect(pruned).toBe(1);
      expect(store.getRelevanceBoost('q1', 'doc1')).toBe(0);
    });

    it('does not prune recent entries', () => {
      store.record('q1', 'doc1', 'click');
      const pruned = store.pruneOld(90);
      expect(pruned).toBe(0);
      expect(store.getRelevanceBoost('q1', 'doc1')).toBeGreaterThan(0);
    });
  });
});
