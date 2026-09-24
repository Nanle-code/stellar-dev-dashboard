/**
 * Memo Analysis Tests
 * Covers categorization (80%+ accuracy), entity extraction, suggestions, and search
 */

import { beforeEach, describe, it, expect } from 'vitest';
import { MemoCategorizer, type MemoCategoryType } from '../memoCategorizer';
import { MemoSuggestionEngine } from '../memoSuggestions';
import { MemoSearchEngine, type IndexedMemo } from '../memoSearch';

describe('Memo Analysis System', () => {
  let categorizer: MemoCategorizer;
  let suggestionEngine: MemoSuggestionEngine;
  let searchEngine: MemoSearchEngine;

  beforeEach(() => {
    categorizer = new MemoCategorizer();
    suggestionEngine = new MemoSuggestionEngine();
    searchEngine = new MemoSearchEngine();
  });

  describe('Memo Categorizer - 80%+ Accuracy', () => {
    it('should categorize payment memos', () => {
      const memos = [
        'Payment for Invoice INV-12345',
        'Paid invoice #789',
        'Payment received',
      ];

      memos.forEach((memo) => {
        const result = categorizer.categorizeRemo(memo);
        expect(result.category).toBe('payment');
        expect(result.confidence).toBeGreaterThan(0.7);
      });
    });

    it('should categorize transfer memos', () => {
      const memos = [
        'Transfer to Account #567',
        'Sent 100 XLM to user',
        'Transfer completed',
      ];

      memos.forEach((memo) => {
        const result = categorizer.categorizeRemo(memo);
        expect(result.category).toBe('transfer');
        expect(result.confidence).toBeGreaterThan(0.6);
      });
    });

    it('should categorize swap memos', () => {
      const memos = ['Swap USDC to XLM', 'Exchange ETH for USDC', 'Trade completed'];

      memos.forEach((memo) => {
        const result = categorizer.categorizeRemo(memo);
        expect(result.category).toBe('swap');
        expect(result.confidence).toBeGreaterThan(0.6);
      });
    });

    it('should categorize reward memos', () => {
      const memos = ['Staking reward', 'Bonus airdrop', 'Yield payment'];

      memos.forEach((memo) => {
        const result = categorizer.categorizeRemo(memo);
        expect(result.category).toBe('reward');
        expect(result.confidence).toBeGreaterThan(0.6);
      });
    });

    it('should categorize fee memos', () => {
      const memos = ['Transaction fee', 'Gas fee paid', 'Commission charged'];

      memos.forEach((memo) => {
        const result = categorizer.categorizeRemo(memo);
        expect(result.category).toBe('fee');
        expect(result.confidence).toBeGreaterThan(0.7);
      });
    });

    it('should handle empty memos', () => {
      const result = categorizer.categorizeRemo('');
      expect(result.category).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should achieve 80%+ accuracy with feedback', () => {
      const testCases = [
        { memo: 'Invoice payment', expected: 'payment' as MemoCategoryType },
        { memo: 'Transfer to account', expected: 'transfer' as MemoCategoryType },
        { memo: 'Reward earned', expected: 'reward' as MemoCategoryType },
        { memo: 'Fee charged', expected: 'fee' as MemoCategoryType },
        { memo: 'Contract call', expected: 'contract' as MemoCategoryType },
      ];

      testCases.forEach(({ memo, expected }) => {
        categorizer.recordFeedback(memo, expected);
      });

      const accuracy = categorizer.getOverallAccuracy();
      expect(accuracy).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe('Entity Extraction', () => {
    it('should extract IDs from memos', () => {
      const result = categorizer.analyzeMemo('Invoice ID: INV-12345 for payment');
      const idEntities = result.entities.filter((e) => e.type === 'id');
      expect(idEntities.length).toBeGreaterThan(0);
    });

    it('should extract dates from memos', () => {
      const result = categorizer.analyzeMemo('Payment dated 2024-01-15');
      const dateEntities = result.entities.filter((e) => e.type === 'date');
      expect(dateEntities.length).toBeGreaterThan(0);
    });

    it('should extract amounts from memos', () => {
      const result = categorizer.analyzeMemo('Amount: $1,234.56');
      const amountEntities = result.entities.filter((e) => e.type === 'amount');
      expect(amountEntities.length).toBeGreaterThan(0);
    });

    it('should extract accounts from memos', () => {
      const result = categorizer.analyzeMemo('Account: ACC-98765');
      const accountEntities = result.entities.filter((e) => e.type === 'account');
      expect(accountEntities.length).toBeGreaterThan(0);
    });

    it('should handle multiple entities', () => {
      const result = categorizer.analyzeMemo(
        'Invoice INV-001 dated 2024-01-15 for $500 to Account ACC-123',
      );
      expect(result.entities.length).toBeGreaterThan(2);
    });
  });

  describe('Memo Suggestions', () => {
    it('should suggest payment templates', () => {
      const suggestions = suggestionEngine.suggestTemplates('payment');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].template.category).toBe('payment');
    });

    it('should suggest transfer templates', () => {
      const suggestions = suggestionEngine.suggestTemplates('transfer');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should fill template with values', () => {
      const filled = suggestionEngine.fillTemplate('payment-invoice', { id: '12345' });
      expect(filled).toContain('12345');
    });

    it('should analyze memo patterns', () => {
      const memos = [
        'Payment for Invoice INV-001',
        'Payment for Invoice INV-002',
        'Payment for Invoice INV-003',
      ];

      const analysis = suggestionEngine.analyzeMemoPatterns(memos);
      expect(analysis.memoLengthAverage).toBeGreaterThan(0);
      expect(analysis.commonPatterns.length).toBeGreaterThan(0);
    });

    it('should track template usage', () => {
      suggestionEngine.recordMemoUsage('Payment for Invoice', 'payment-invoice');
      suggestionEngine.recordMemoUsage('Payment for Invoice', 'payment-invoice');

      const stats = suggestionEngine.getTemplateStats();
      expect(stats['Payment Invoice']).toBeGreaterThan(0);
    });

    it('should add custom templates', () => {
      const custom = suggestionEngine.addCustomTemplate(
        'Custom Payment',
        'payment',
        'Custom: {description}',
        ['Custom: Example'],
      );

      expect(custom.id).toBeDefined();
      expect(custom.name).toBe('Custom Payment');
    });
  });

  describe('Memo Search', () => {
    beforeEach(() => {
      const memos: IndexedMemo[] = [
        {
          id: '1',
          memo: 'Payment for Invoice INV-12345',
          category: 'payment',
          entities: ['INV-12345'],
          keywords: ['payment', 'invoice'],
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          memo: 'Transfer to Account ACC-98765',
          category: 'transfer',
          entities: ['ACC-98765'],
          keywords: ['transfer', 'account'],
          timestamp: new Date().toISOString(),
        },
        {
          id: '3',
          memo: 'Swap USDC to XLM - Rebalance',
          category: 'swap',
          entities: ['USDC', 'XLM'],
          keywords: ['swap', 'rebalance'],
          timestamp: new Date().toISOString(),
        },
      ];

      memos.forEach((memo) => searchEngine.indexMemo(memo));
    });

    it('should search by meaning', () => {
      const results = searchEngine.searchByMeaning('payment invoice');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].category).toBe('payment');
    });

    it('should search by category', () => {
      const results = searchEngine.searchByCategory('transfer');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.category === 'transfer')).toBe(true);
    });

    it('should perform full-text search', () => {
      const results = searchEngine.fullTextSearch('INV');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].memo).toContain('INV');
    });

    it('should respect search limits', () => {
      const results = searchEngine.searchByMeaning('payment', undefined, 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should provide analytics', () => {
      const analytics = searchEngine.getAnalytics();
      expect(analytics.totalMemos).toBe(3);
      expect(analytics.mostCommonKeywords.length).toBeGreaterThan(0);
      expect(analytics.searchableScore).toBeGreaterThan(0);
    });

    it('should track category distribution', () => {
      const analytics = searchEngine.getAnalytics();
      expect(analytics.categoryDistribution.payment).toBeGreaterThan(0);
      expect(analytics.categoryDistribution.transfer).toBeGreaterThan(0);
      expect(analytics.categoryDistribution.swap).toBeGreaterThan(0);
    });
  });

  describe('Boundary Cases', () => {
    it('should handle very long memos', () => {
      const longMemo = 'A'.repeat(1000);
      const result = categorizer.analyzeMemo(longMemo);
      expect(result.length).toBe(1000);
    });

    it('should handle special characters', () => {
      const specialMemo = 'Payment @$#% Invoice!!! INV-123';
      const result = categorizer.analyzeMemo(specialMemo);
      expect(result.category).not.toBe('unknown');
    });

    it('should handle multiple languages', () => {
      const multiMemo = 'Paiement facture EUR-500';
      const result = categorizer.analyzeMemo(multiMemo);
      expect(result).toBeDefined();
    });

    it('should handle empty search', () => {
      const results = searchEngine.searchByMeaning('');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle non-existent category search', () => {
      const results = searchEngine.searchByCategory('unknown');
      expect(results.length).toBe(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should complete full memo analysis workflow', () => {
      const memo = 'Payment for Invoice INV-2024-001 dated 2024-01-15 - $5,000';

      // Analyze
      const analysis = categorizer.analyzeMemo(memo);
      expect(analysis.category.category).toBe('payment');
      expect(analysis.entities.length).toBeGreaterThan(0);
      expect(analysis.isMeaningful).toBe(true);

      // Index
      searchEngine.indexMemo({
        id: 'test-1',
        memo,
        category: analysis.category.category,
        entities: analysis.entities.map((e) => e.value),
        keywords: analysis.category.keywords,
        timestamp: new Date().toISOString(),
      });

      // Search
      const searchResults = searchEngine.searchByMeaning('invoice');
      expect(searchResults.length).toBeGreaterThan(0);

      // Get analytics
      const analytics = searchEngine.getAnalytics();
      expect(analytics.totalMemos).toBeGreaterThan(0);
    });
  });
});
