import { useState, useCallback, useEffect } from 'react';
import { MemoCategorizer, type MemoAnalysisResult } from '../lib/memoAnalysis/memoCategorizer';
import { MemoSuggestionEngine, type MemoSuggestion } from '../lib/memoAnalysis/memoSuggestions';
import { MemoSearchEngine, type SearchResult, type MemoAnalytics } from '../lib/memoAnalysis/memoSearch';

interface UseMemoAnalysisReturn {
  analyzeMemo: (memo: string) => MemoAnalysisResult | null;
  suggestTemplates: (type: string) => MemoSuggestion[];
  searchMemos: (query: string, category?: string) => SearchResult[];
  getAnalytics: () => MemoAnalytics;
  recordMemoUsage: (memo: string, templateId?: string) => void;
  getTemplateStats: () => Record<string, number>;
  fillTemplate: (templateId: string, values: Record<string, string>) => string | null;
  error: string | null;
  isLoading: boolean;
}

export function useMemoAnalysis(): UseMemoAnalysisReturn {
  const [categorizer] = useState(() => new MemoCategorizer());
  const [suggestionEngine] = useState(() => new MemoSuggestionEngine());
  const [searchEngine] = useState(() => new MemoSearchEngine());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const analyzeMemo = useCallback(
    (memo: string): MemoAnalysisResult | null => {
      try {
        setError(null);
        return categorizer.analyzeMemo(memo);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to analyze memo';
        setError(message);
        return null;
      }
    },
    [categorizer],
  );

  const suggestTemplates = useCallback(
    (type: string): MemoSuggestion[] => {
      try {
        setError(null);
        return suggestionEngine.suggestTemplates(type);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get suggestions';
        setError(message);
        return [];
      }
    },
    [suggestionEngine],
  );

  const searchMemos = useCallback(
    (query: string, category?: string): SearchResult[] => {
      try {
        setError(null);
        if (category) {
          return searchEngine.searchByMeaning(query, category as any);
        }
        return searchEngine.searchByMeaning(query);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Search failed';
        setError(message);
        return [];
      }
    },
    [searchEngine],
  );

  const getAnalytics = useCallback((): MemoAnalytics => {
    try {
      setError(null);
      return searchEngine.getAnalytics();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get analytics';
      setError(message);
      return {
        totalMemos: 0,
        categoryDistribution: {},
        averageMemoLength: 0,
        mostCommonKeywords: [],
        mostCommonCategories: [],
        uniqueEntities: 0,
        searchableScore: 0,
      };
    }
  }, [searchEngine]);

  const recordMemoUsage = useCallback(
    (memo: string, templateId?: string): void => {
      try {
        setError(null);
        suggestionEngine.recordMemoUsage(memo, templateId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to record usage';
        setError(message);
      }
    },
    [suggestionEngine],
  );

  const getTemplateStats = useCallback((): Record<string, number> => {
    try {
      setError(null);
      return suggestionEngine.getTemplateStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get stats';
      setError(message);
      return {};
    }
  }, [suggestionEngine]);

  const fillTemplate = useCallback(
    (templateId: string, values: Record<string, string>): string | null => {
      try {
        setError(null);
        return suggestionEngine.fillTemplate(templateId, values);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fill template';
        setError(message);
        return null;
      }
    },
    [suggestionEngine],
  );

  return {
    analyzeMemo,
    suggestTemplates,
    searchMemos,
    getAnalytics,
    recordMemoUsage,
    getTemplateStats,
    fillTemplate,
    error,
    isLoading,
  };
}

export default useMemoAnalysis;
