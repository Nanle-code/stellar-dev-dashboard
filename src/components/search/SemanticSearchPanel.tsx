/**
 * SemanticSearchPanel
 *
 * Full-featured semantic search UI component that integrates the
 * SemanticSearchEngine and RelevanceFeedbackStore to deliver:
 *
 *  - A search bar with live debounced results
 *  - Detected query intent badge (powered by NLP engine)
 *  - Typo-correction notice (e.g. "Showing results for 'payment'")
 *  - Query-expansion badge listing the synonyms applied
 *  - Relevance improvement indicator vs keyword search
 *  - Result cards with score bars, match highlights, and search explanations
 *  - Per-result thumbs-up / thumbs-down feedback buttons
 *  - Autocomplete suggestions dropdown
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Search,
  ThumbsUp,
  ThumbsDown,
  Info,
  Zap,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  TrendingUp,
  Lightbulb,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { useSemanticSearch } from '../../hooks/useSemanticSearch';
import type { SemanticDocument, SearchResult } from '../../lib/semanticSearch';
import type { FeedbackSignal } from '../../lib/relevanceFeedback';
import { globalRelevanceFeedback } from '../../lib/relevanceFeedback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SemanticSearchPanelProps {
  /** Documents to search over */
  documents: SemanticDocument[];
  /** Optional extra class on the root element */
  className?: string;
  /** Called when user selects a result */
  onResultSelect?: (result: SearchResult) => void;
  /** Panel title (default: "Semantic Search") */
  title?: string;
  /** Placeholder text for search input */
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Score 0-1 → colour */
function scoreColor(score: number): string {
  if (score >= 0.7) return 'var(--green, #22c55e)';
  if (score >= 0.4) return 'var(--cyan, #06b6d4)';
  if (score >= 0.2) return 'var(--orange, #f97316)';
  return 'var(--text-muted, #6b7280)';
}

/** Score 0-1 → label */
function scoreLabel(score: number): string {
  if (score >= 0.7) return 'Excellent';
  if (score >= 0.4) return 'Good';
  if (score >= 0.2) return 'Fair';
  return 'Low';
}

/** Truncate long text with ellipsis */
function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

/** Highlight query terms in text */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const pattern = terms
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  if (!pattern) return <>{text}</>;
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            style={{
              background: 'rgba(6, 182, 212, 0.25)',
              color: 'var(--cyan, #06b6d4)',
              borderRadius: '2px',
              padding: '0 1px',
            }}
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: single result card
// ---------------------------------------------------------------------------

interface ResultCardProps {
  result: SearchResult;
  queryTerms: string[];
  onFeedback: (docId: string, signal: FeedbackSignal) => void;
  onSelect?: (result: SearchResult) => void;
}

function ResultCard({ result, queryTerms, onFeedback, onSelect }: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<FeedbackSignal | null>(null);

  const { document: doc, score, explanation, matchedTerms, feedbackBoosted } = result;

  const handleFeedback = (signal: FeedbackSignal) => {
    setFeedbackGiven(signal);
    onFeedback(doc.id, signal);
  };

  const handleClick = () => {
    onFeedback(doc.id, 'click');
    onSelect?.(result);
  };

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${feedbackBoosted ? 'var(--cyan, #06b6d4)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Main row */}
      <div
        onClick={handleClick}
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        aria-label={`Result: ${truncate(doc.text, 60)}, relevance ${Math.round(score * 100)}%`}
      >
        {/* Score badge */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            minWidth: '44px',
          }}
        >
          {/* Score circle */}
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: `2px solid ${scoreColor(score)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: scoreColor(score),
            }}
            title={`Relevance: ${Math.round(score * 100)}%`}
          >
            {Math.round(score * 100)}%
          </div>
          <span style={{ fontSize: '9px', color: scoreColor(score), fontWeight: 600 }}>
            {scoreLabel(score)}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Document text */}
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              marginBottom: '4px',
            }}
          >
            <Highlighted text={truncate(doc.text, 160)} terms={matchedTerms} />
          </div>

          {/* Metadata badges */}
          {doc.metadata && Object.keys(doc.metadata).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
              {Object.entries(doc.metadata)
                .slice(0, 3)
                .map(([k, v]) => (
                  <span
                    key={k}
                    style={{
                      padding: '1px 6px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '999px',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {k}: {String(v).slice(0, 20)}
                  </span>
                ))}
            </div>
          )}

          {/* Matched terms */}
          {matchedTerms.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {matchedTerms.slice(0, 6).map((term) => (
                <span
                  key={term}
                  style={{
                    padding: '1px 6px',
                    background: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    borderRadius: '999px',
                    fontSize: '10px',
                    color: 'var(--cyan, #06b6d4)',
                  }}
                >
                  {term}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          {/* Feedback boosted indicator */}
          {feedbackBoosted && (
            <div title="Boosted by your feedback" style={{ color: 'var(--cyan, #06b6d4)' }}>
              <TrendingUp size={14} />
            </div>
          )}
          {/* Expand explanation */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
            style={iconBtnStyle}
            title={expanded ? 'Hide explanation' : 'Why this result?'}
            aria-expanded={expanded}
            aria-label="Toggle explanation"
          >
            <Info size={13} />
          </button>
          {/* Thumbs up */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFeedback('thumbsUp');
            }}
            style={{
              ...iconBtnStyle,
              ...(feedbackGiven === 'thumbsUp'
                ? { background: 'rgba(34, 197, 94, 0.2)', borderColor: 'var(--green, #22c55e)', color: 'var(--green, #22c55e)' }
                : {}),
            }}
            title="This result is relevant"
            aria-label="Mark as relevant"
            aria-pressed={feedbackGiven === 'thumbsUp'}
          >
            <ThumbsUp size={13} />
          </button>
          {/* Thumbs down */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFeedback('thumbsDown');
            }}
            style={{
              ...iconBtnStyle,
              ...(feedbackGiven === 'thumbsDown'
                ? { background: 'rgba(239, 68, 68, 0.2)', borderColor: 'var(--red, #ef4444)', color: 'var(--red, #ef4444)' }
                : {}),
            }}
            title="This result is not relevant"
            aria-label="Mark as not relevant"
            aria-pressed={feedbackGiven === 'thumbsDown'}
          >
            <ThumbsDown size={13} />
          </button>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ height: '3px', background: 'var(--border)' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.round(score * 100)}%`,
            background: scoreColor(score),
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Expandable explanation */}
      {expanded && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-card)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <Lightbulb size={13} style={{ color: 'var(--cyan, #06b6d4)', flexShrink: 0, marginTop: '2px' }} />
            <span>{explanation}</span>
          </div>
          <div style={{ marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', opacity: 0.6 }}>
            doc id: {doc.id}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SemanticSearchPanel({
  documents,
  className,
  onResultSelect,
  title = 'Semantic Search',
  placeholder = 'Search with natural language (e.g. "recent XLM payments", "failed contracts")…',
}: SemanticSearchPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
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
  } = useSemanticSearch({
    documents,
    enableImprovementMetric: true,
  });

  // Sync the local input with the hook's debounced query
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    setQuery(v);
    setShowSuggestions(v.length >= 2);
  };

  const handleSuggestionClick = (sug: string) => {
    setInputValue(sug);
    setQuery(sug);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setInputValue('');
    setQuery('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleFeedback = useCallback(
    (docId: string, signal: FeedbackSignal) => {
      recordFeedback(docId, signal);
    },
    [recordFeedback]
  );

  // Derive query terms for highlighting
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  // Active synonyms for the badge
  const activeSynonyms = queryExpansion
    ? Object.entries(queryExpansion.synonymsUsed)
        .filter(([k]) => queryExpansion.originalTerms.includes(k))
        .map(([k, v]) => `${k} → ${v.slice(0, 2).join('/')}`)
        .slice(0, 3)
    : [];

  const hasResults = results.length > 0;
  const hasQuery = query.trim().length > 0;

  // Relevance improvement percentage relative to 40% target
  const improvementPct = relevanceImprovement !== null
    ? Math.round(relevanceImprovement * 100)
    : null;
  const meetsTarget = improvementPct !== null && improvementPct >= 40;

  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      role="search"
      aria-label={title}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Zap size={18} style={{ color: 'var(--cyan, #06b6d4)' }} />
            {title}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            AI-powered semantic search • {indexSize} documents indexed
          </div>
        </div>

        {/* Relevance improvement badge */}
        {improvementPct !== null && hasResults && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              background: meetsTarget
                ? 'rgba(34, 197, 94, 0.1)'
                : 'rgba(249, 115, 22, 0.1)',
              border: `1px solid ${meetsTarget ? 'rgba(34, 197, 94, 0.4)' : 'rgba(249, 115, 22, 0.4)'}`,
              borderRadius: '999px',
              fontSize: '11px',
              color: meetsTarget ? 'var(--green, #22c55e)' : 'var(--orange, #f97316)',
              fontWeight: 600,
            }}
            title={`Semantic search scores ${improvementPct}% relevance improvement over keyword-only search`}
          >
            <TrendingUp size={12} />
            {improvementPct}% relevance improvement
          </div>
        )}
      </div>

      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => inputValue.length >= 2 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            placeholder={placeholder}
            aria-label="Semantic search query"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && suggestions.length > 0}
            style={{
              width: '100%',
              padding: '10px 44px 10px 40px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'var(--font-sans, sans-serif)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
          />

          <div
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {loading && (
              <RefreshCw
                size={14}
                style={{ color: 'var(--cyan, #06b6d4)', animation: 'spin 1s linear infinite' }}
                aria-label="Searching…"
              />
            )}
            {inputValue && (
              <button
                onClick={handleClear}
                style={{ ...iconBtnStyle, width: '24px', height: '24px' }}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            role="listbox"
            aria-label="Search suggestions"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              zIndex: 1000,
              overflow: 'hidden',
            }}
          >
            {suggestions.map((sug, idx) => (
              <div
                key={idx}
                role="option"
                aria-selected={false}
                onClick={() => handleSuggestionClick(sug)}
                style={{
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  borderBottom:
                    idx < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background = 'var(--bg-elevated)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
                }
              >
                <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                {sug}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Smart badges row */}
      {hasQuery && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {/* Typo corrections */}
          {typoCorrections.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 9px',
                background: 'rgba(249, 115, 22, 0.1)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                borderRadius: '999px',
                fontSize: '11px',
                color: 'var(--orange, #f97316)',
              }}
            >
              <CheckCircle size={11} />
              Corrected:{' '}
              {typoCorrections
                .map((c) => `"${c.original}" → "${c.corrected}"`)
                .join(', ')}
            </div>
          )}

          {/* Synonym expansion */}
          {activeSynonyms.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 9px',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '999px',
                fontSize: '11px',
                color: 'var(--cyan, #06b6d4)',
              }}
              title={`Query expanded with synonyms for better recall`}
            >
              <Zap size={11} />
              Expanded: {activeSynonyms.join('; ')}
            </div>
          )}

          {/* No results hint */}
          {!loading && hasQuery && !hasResults && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              <AlertCircle size={12} />
              No results found. Try different keywords or check spelling.
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Results header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              {results.length} result{results.length !== 1 ? 's' : ''} for{' '}
              <strong style={{ color: 'var(--text-primary)' }}>"{query}"</strong>
            </span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>
              Rate results to improve future searches
            </span>
          </div>

          {/* Result cards */}
          {results.map((result) => (
            <ResultCard
              key={result.document.id}
              result={result}
              queryTerms={queryTerms}
              onFeedback={handleFeedback}
              onSelect={onResultSelect}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!hasQuery && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
            color: 'var(--text-muted)',
            gap: '10px',
            textAlign: 'center',
          }}
        >
          <Zap size={32} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>
            Semantic search understands your intent
          </div>
          <div style={{ fontSize: '12px', opacity: 0.7, maxWidth: '320px' }}>
            Try queries like{' '}
            <em>"recent XLM transfers"</em>,{' '}
            <em>"failed soroban contracts"</em>, or{' '}
            <em>"payment from testnet account"</em>. Typos and synonyms are
            handled automatically.
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared micro-styles
// ---------------------------------------------------------------------------
const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  flexShrink: 0,
};
