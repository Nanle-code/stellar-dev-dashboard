/**
 * useSemanticSearch
 *
 * React hook that wraps the SemanticSearchEngine + RelevanceFeedbackStore to
 * provide a complete semantic search experience:
 *
 *   - Indexes a caller-supplied set of documents on mount (or when they change)
 *   - Runs a live search as `query` changes (debounced 200 ms)
 *   - Expands queries with domain synonyms
 *   - Corrects typos against the index vocabulary
 *   - Ranks results with TF-IDF + BM25 cosine similarity
 *   - Applies stored relevance feedback boosts
 *   - Exposes `recordFeedback()` so the UI can log click / thumbs signals
 *   - Tracks a "relevance improvement" score comparing semantic vs keyword results
 *
 * Usage:
 *   const {
 *     results, loading, query, setQuery,
 *     typoCorrections, queryExpansion,
 *     recordFeedback, relevanceImprovement,
 *   } = useSemanticSearch({ documents, options });
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  SemanticSearchEngine,
  SearchResult,
  SemanticDocument,
  QueryExpansion,
  TypoCorrection,
  SemanticSearchOptions,
} from '../lib/semanticSearch';
import {
  RelevanceFeedbackStore,
  FeedbackSignal,
  globalRelevanceFeedback,
} from '../lib/relevanceFeedback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSemanticSearchOptions {
  /** Documents to index; engine re-indexes when this reference changes */
  documents: SemanticDocument[];
  /** Initial query string */
  initialQuery?: string;
  /** Override default search options */
  searchOptions?: Partial<SemanticSearchOptions>;
  /**
   * Optional external feedback store. Defaults to the app-wide singleton so
   * signals persist across sessions.
   */
  feedbackStore?: RelevanceFeedbackStore;
  /** Debounce delay in ms (default: 200) */
  debounceMs?: number;
  /**
   * If provided, a simple keyword search is run in parallel and the
   * "relevanceImprovement" metric is derived as the ratio of semantic score
   * sum to keyword match count.
   */
  enableImprovementMetric?: boolean;
}

export interface UseSemanticSearchResult {
  /** Current search query string */
  query: string;
  /** Set the search query */
  setQuery: (q: string) => void;
  /** Ranked search results from the semantic engine */
  results: SearchResult[];
  /** True while the engine is processing */
  loading: boolean;
  /** Typo corrections applied to the last query */
  typoCorrections: TypoCorrection[];
  /** Synonym expansion applied to the last query */
  queryExpansion: QueryExpansion | null;
  /**
   * Estimated relevance improvement over keyword search (0–1, higher is better).
   * Only populated when `enableImprovementMetric` is true and at least one
   * result exists.
   */
  relevanceImprovement: number | null;
  /** Log a user feedback signal for a (queryId, documentId) pair */
  recordFeedback: (documentId: string, signal: FeedbackSignal) => void;
  /** Total number of indexed documents */
  indexSize: number;
  /** Autocomplete / query suggestions from the vocabulary */
  suggestions: string[];
  /** A stable identifier for the current query (normalised lowercase) */
  queryId: string;
}

// ---------------------------------------------------------------------------
// Normalise query into a stable identifier
// ---------------------------------------------------------------------------
function normaliseQueryId(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Simple keyword match count (for improvement metric baseline)
// ---------------------------------------------------------------------------
function keywordMatchCount(documents: SemanticDocument[], query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 0;
  return documents.filter((doc) =>
    terms.every((t) => doc.text.toLowerCase().includes(t))
  ).length;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSemanticSearch({
  documents,
  initialQuery = '',
  searchOptions = {},
  feedbackStore = globalRelevanceFeedback,
  debounceMs = 200,
  enableImprovementMetric = true,
}: UseSemanticSearchOptions): UseSemanticSearchResult {
  // Engine lives in a ref so it's not re-created on every render
  const engineRef = useRef<SemanticSearchEngine>(new SemanticSearchEngine());

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [typoCorrections, setTypoCorrections] = useState<TypoCorrection[]>([]);
  const [queryExpansion, setQueryExpansion] = useState<QueryExpansion | null>(null);
  const [relevanceImprovement, setRelevanceImprovement] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [indexSize, setIndexSize] = useState(0);

  // Stable query id (normalised)
  const queryId = useMemo(() => normaliseQueryId(query), [query]);

  // -------------------------------------------------------------------------
  // Re-index when documents change
  // -------------------------------------------------------------------------
  useEffect(() => {
    const engine = engineRef.current;
    engine.clearIndex();
    if (documents.length > 0) {
      engine.indexDocuments(documents);
    }
    setIndexSize(engine.getIndexSize());
    // Trigger a fresh search against the new index
    if (query.trim()) {
      runSearch(query, engine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  // -------------------------------------------------------------------------
  // Debounced search
  // -------------------------------------------------------------------------
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (q: string, engine: SemanticSearchEngine) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setTypoCorrections([]);
        setQueryExpansion(null);
        setRelevanceImprovement(null);
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Resolve feedback boosts for the current query
      const qId = normaliseQueryId(q);
      const feedbackBoosts = feedbackStore.getBoostsForQuery(qId);

      const opts: SemanticSearchOptions = {
        topK: 20,
        minScore: 0.01,
        expandQuery: true,
        correctTypos: true,
        applyFeedback: true,
        ...searchOptions,
        feedbackBoosts,
      };

      // Run the engine synchronously (all computation is in-memory)
      const searchResults = engine.search(trimmed, opts);

      // Extract typo corrections & query expansion from the engine using
      // the same pipeline (cheap — the engine exposes these utilities)
      const rawTerms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
      const { corrections } = engine.correctQueryTerms(rawTerms);
      const actualCorrections = corrections.filter((c) => c.wasCorreected);

      const expansion = engine.expandQuery(trimmed);

      // Relevance improvement metric
      let improvement: number | null = null;
      if (enableImprovementMetric && documents.length > 0) {
        const kwCount = keywordMatchCount(documents, trimmed);
        const semanticScoreSum = searchResults.reduce((s, r) => s + r.score, 0);
        if (kwCount > 0 && semanticScoreSum > 0) {
          // Normalise: semantic score sum / keyword hit count, capped at 1
          improvement = Math.min(1, semanticScoreSum / kwCount);
        } else if (kwCount === 0 && searchResults.length > 0) {
          // Semantic found results where keyword found none → maximum improvement
          improvement = 1;
        } else {
          improvement = 0;
        }
      }

      // Suggestions for the current partial query
      const sug = engine.getSuggestions(trimmed, 8);

      setResults(searchResults);
      setTypoCorrections(actualCorrections);
      setQueryExpansion(expansion);
      setRelevanceImprovement(improvement);
      setSuggestions(sug);
      setLoading(false);
    },
    // searchOptions object reference changes on every render; stringify for stability
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feedbackStore, enableImprovementMetric, documents, JSON.stringify(searchOptions)]
  );

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      runSearch(query, engineRef.current);
    }, debounceMs);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, runSearch, debounceMs]);

  // -------------------------------------------------------------------------
  // Feedback recorder
  // -------------------------------------------------------------------------
  const recordFeedback = useCallback(
    (documentId: string, signal: FeedbackSignal) => {
      feedbackStore.record(queryId, documentId, signal);
      // Re-run search immediately so ranking reflects the new feedback
      runSearch(query, engineRef.current);
    },
    [feedbackStore, queryId, query, runSearch]
  );

  return {
    query,
    setQuery,
    results,
    loading,
    typoCorrections,
    queryExpansion,
    relevanceImprovement,
    recordFeedback,
    indexSize,
    suggestions,
    queryId,
  };
}

export default useSemanticSearch;
