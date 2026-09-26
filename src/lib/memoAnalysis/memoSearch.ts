/**
 * Semantic Memo Search and Analytics
 * Search transactions by memo meaning and view usage patterns
 */

import type { MemoCategoryType } from './memoCategorizer';

export interface IndexedMemo {
  id: string;
  memo: string;
  category: MemoCategoryType;
  entities: string[];
  keywords: string[];
  timestamp: string;
  txnHash?: string;
}

export interface SearchResult {
  memoId: string;
  memo: string;
  category: MemoCategoryType;
  relevanceScore: number;
  matchedTerms: string[];
  entities: string[];
}

export interface MemoAnalytics {
  totalMemos: number;
  categoryDistribution: Record<MemoCategoryType, number>;
  averageMemoLength: number;
  mostCommonKeywords: Array<{ keyword: string; count: number }>;
  mostCommonCategories: Array<{ category: MemoCategoryType; count: number }>;
  uniqueEntities: number;
  searchableScore: number;
}

export class MemoSearchEngine {
  private memoIndex: Map<string, IndexedMemo> = new Map();
  private keywordIndex: Map<string, Set<string>> = new Map();
  private categoryIndex: Map<MemoCategoryType, Set<string>> = new Map();
  private entityIndex: Map<string, Set<string>> = new Map();

  /**
   * Index a memo for fast searching
   */
  indexMemo(memo: IndexedMemo): void {
    this.memoIndex.set(memo.id, memo);

    // Index keywords
    memo.keywords.forEach((keyword) => {
      const memoIds = this.keywordIndex.get(keyword) || new Set();
      memoIds.add(memo.id);
      this.keywordIndex.set(keyword, memoIds);
    });

    // Index category
    const categoryMemos = this.categoryIndex.get(memo.category) || new Set();
    categoryMemos.add(memo.id);
    this.categoryIndex.set(memo.category, categoryMemos);

    // Index entities
    memo.entities.forEach((entity) => {
      const memoIds = this.entityIndex.get(entity) || new Set();
      memoIds.add(memo.id);
      this.entityIndex.set(entity, memoIds);
    });
  }

  /**
   * Search memos by meaning (semantic search)
   */
  searchByMeaning(query: string, category?: MemoCategoryType, limit: number = 10): SearchResult[] {
    const queryTerms = query.toLowerCase().split(/[\s\-,]+/).filter((t) => t.length > 2);
    const results: Map<string, SearchResult> = new Map();

    // Search by keywords
    queryTerms.forEach((term) => {
      const memoIds = this.keywordIndex.get(term) || new Set();
      memoIds.forEach((memoId) => {
        const memo = this.memoIndex.get(memoId);
        if (!memo || (category && memo.category !== category)) return;

        const existing = results.get(memoId) || {
          memoId,
          memo: memo.memo,
          category: memo.category,
          relevanceScore: 0,
          matchedTerms: [],
          entities: memo.entities,
        };

        existing.relevanceScore += 1;
        if (!existing.matchedTerms.includes(term)) {
          existing.matchedTerms.push(term);
        }

        results.set(memoId, existing);
      });
    });

    // Search by entities
    queryTerms.forEach((term) => {
      const memoIds = this.entityIndex.get(term) || new Set();
      memoIds.forEach((memoId) => {
        const memo = this.memoIndex.get(memoId);
        if (!memo || (category && memo.category !== category)) return;

        const existing = results.get(memoId) || {
          memoId,
          memo: memo.memo,
          category: memo.category,
          relevanceScore: 0,
          matchedTerms: [],
          entities: memo.entities,
        };

        existing.relevanceScore += 0.5;
        if (!existing.matchedTerms.includes(term)) {
          existing.matchedTerms.push(term);
        }

        results.set(memoId, existing);
      });
    });

    // Search by category if specified
    if (category) {
      const categoryMemos = this.categoryIndex.get(category) || new Set();
      categoryMemos.forEach((memoId) => {
        if (!results.has(memoId)) {
          const memo = this.memoIndex.get(memoId);
          if (memo) {
            results.set(memoId, {
              memoId,
              memo: memo.memo,
              category: memo.category,
              relevanceScore: 0.1,
              matchedTerms: [category],
              entities: memo.entities,
            });
          }
        }
      });
    }

    // Sort by relevance and return
    return Array.from(results.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * Search memos by category
   */
  searchByCategory(category: MemoCategoryType, limit: number = 50): SearchResult[] {
    const memoIds = this.categoryIndex.get(category) || new Set();
    const results: SearchResult[] = [];

    memoIds.forEach((memoId) => {
      const memo = this.memoIndex.get(memoId);
      if (memo) {
        results.push({
          memoId,
          memo: memo.memo,
          category: memo.category,
          relevanceScore: 1.0,
          matchedTerms: [category],
          entities: memo.entities,
        });
      }
    });

    return results.slice(0, limit);
  }

  /**
   * Full-text search across all memos
   */
  fullTextSearch(query: string, limit: number = 20): SearchResult[] {
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    this.memoIndex.forEach((memo, memoId) => {
      if (memo.memo.toLowerCase().includes(lowerQuery)) {
        results.push({
          memoId,
          memo: memo.memo,
          category: memo.category,
          relevanceScore: this.calculateRelevance(memo.memo, lowerQuery),
          matchedTerms: this.extractMatchedTerms(memo.memo, lowerQuery),
          entities: memo.entities,
        });
      }
    });

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
  }

  /**
   * Get memo analytics
   */
  getAnalytics(): MemoAnalytics {
    const totalMemos = this.memoIndex.size;
    const categoryDistribution: Record<MemoCategoryType, number> = {} as any;
    let totalLength = 0;
    const keywordFreq = new Map<string, number>();
    const allEntities = new Set<string>();

    this.memoIndex.forEach((memo) => {
      // Category distribution
      categoryDistribution[memo.category] = (categoryDistribution[memo.category] || 0) + 1;

      // Length
      totalLength += memo.memo.length;

      // Keywords
      memo.keywords.forEach((kw) => {
        keywordFreq.set(kw, (keywordFreq.get(kw) || 0) + 1);
      });

      // Entities
      memo.entities.forEach((e) => allEntities.add(e));
    });

    const averageMemoLength = totalMemos > 0 ? totalLength / totalMemos : 0;

    // Sort keywords by frequency
    const mostCommonKeywords = Array.from(keywordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    // Sort categories by frequency
    const mostCommonCategories = Object.entries(categoryDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category: category as MemoCategoryType, count }));

    // Calculate searchability score (0-1)
    const searchableScore =
      totalMemos > 0 ? Math.min(1, (mostCommonKeywords.length / 10) * (allEntities.size / 100)) : 0;

    return {
      totalMemos,
      categoryDistribution,
      averageMemoLength,
      mostCommonKeywords,
      mostCommonCategories,
      uniqueEntities: allEntities.size,
      searchableScore,
    };
  }

  private calculateRelevance(memo: string, query: string): number {
    const lowerMemo = memo.toLowerCase();
    const queryLength = query.length;
    const memoLength = memo.length;

    // Exact match bonus
    if (lowerMemo === query) return 1.0;

    // Substring match
    const matchCount = (lowerMemo.match(new RegExp(query, 'gi')) || []).length;
    return Math.min(1.0, (matchCount / memoLength) * queryLength);
  }

  private extractMatchedTerms(memo: string, query: string): string[] {
    const terms = new Set<string>();
    const words = memo.toLowerCase().split(/\s+/);

    words.forEach((word) => {
      if (word.includes(query)) {
        terms.add(word);
      }
    });

    return Array.from(terms);
  }

  /**
   * Clear index
   */
  clearIndex(): void {
    this.memoIndex.clear();
    this.keywordIndex.clear();
    this.categoryIndex.clear();
    this.entityIndex.clear();
  }

  /**
   * Get indexed memo count
   */
  getIndexSize(): number {
    return this.memoIndex.size;
  }
}

export const memoSearchEngine = new MemoSearchEngine();
