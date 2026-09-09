import React, { useMemo, useState } from 'react';
import { Search, MessageCircle, ArrowRight, Sparkles } from 'lucide-react';
import { parseNaturalLanguageQuery, classifyIntent } from '../../lib/nlpSearchEngine';
import { format } from 'date-fns';

const followUpTemplates = {
  transaction: [
    'Do you want to narrow this to a specific account or transaction hash?',
    'Would you like to filter by payment amount or operation type?',
  ],
  account: [
    'Should I show only payments, offers, or account changes?',
    'Do you want to see activity from the last 30 days only?',
  ],
  contract: [
    'Should I show only invocations or all contract interactions?',
    'Would you like to filter by a specific contract ID or asset?',
  ],
  general: [
    'Try asking something like "payments over 1000 XLM last month".',
    'You can refine the query by adding a time range or account ID.',
  ],
};

interface ConversationalSearchProps {
  onQuerySubmit: (query: string, parsed: { filters: any; searchTerms: string[]; intent: any }) => void;
  placeholder?: string;
}

export default function ConversationalSearch({ onQuerySubmit, placeholder }: ConversationalSearchProps) {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<Array<{ query: string; timestamp: string }>>([]);
  const [showFeedback, setShowFeedback] = useState(false);

  const intent = useMemo(() => {
    if (!query.trim()) return null;
    return classifyIntent(query);
  }, [query]);

  const suggestions = useMemo(() => {
    if (!intent) return [];
    const intentSuggestions = followUpTemplates[intent.type] || followUpTemplates.general;
    return intentSuggestions.slice(0, 2);
  }, [intent]);

  const [parsedIntent, setParsedIntent] = useState<{ filters: any; searchTerms: string[]; intent: any } | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    const parsed = parseNaturalLanguageQuery(trimmed);
    setParsedIntent(parsed);
    onQuerySubmit(trimmed, parsed);

    const nextHistory = [
      { query: trimmed, timestamp: format(new Date(), 'PPpp') },
      ...history.filter((item) => item.query !== trimmed),
    ].slice(0, 10);
    setHistory(nextHistory);
    setQuery('');
    setShowFeedback(true);
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '10px' }}>
        <label htmlFor="conversational-search" style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
          Conversational Stellar Query
        </label>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            id="conversational-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder || 'Ask something like "Show me payments over 1000 XLM last month"'}
            style={{
              width: '100%',
              padding: '12px 140px 12px 40px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          />
          <button
            type="submit"
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--cyan)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Ask <ArrowRight size={14} />
          </button>
        </div>

        {intent && (
          <div style={{ padding: '14px 16px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-muted)' }}>
              <Sparkles size={14} />
              <span style={{ fontSize: '12px', fontWeight: 700 }}>Detected intent</span>
            </div>
            <div style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
              <div><strong>Type:</strong> {intent.type}</div>
              {intent.entities.addresses?.length > 0 && <div><strong>Addresses:</strong> {intent.entities.addresses.join(', ')}</div>}
              {intent.entities.amounts?.length > 0 && <div><strong>Amounts:</strong> {intent.entities.amounts.join(', ')}</div>}
              {intent.entities.assets?.length > 0 && <div><strong>Assets:</strong> {intent.entities.assets.join(', ')}</div>}
              {intent.entities.dateRanges?.length > 0 && <div><strong>Date:</strong> {intent.entities.dateRanges.map((dr) => dr.start ? format(dr.start, 'PPP') : 'recent').join(', ')}</div>}
            </div>
          </div>
        )}

        {intent && suggestions.length > 0 && (
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Refine your query:</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuery(`${query.trim()} ${suggestion}`.trim())}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '999px',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      {showFeedback && (
        <div style={{ padding: '14px 16px', borderRadius: '14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <MessageCircle size={14} />
            <span style={{ fontSize: '12px', fontWeight: 700 }}>Conversation mode</span>
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
            This interface converts plain English into structured Stellar query filters. You can refine the results using follow-up questions or export the final results once they are loaded.
          </div>
        </div>
      )}

      {parsedIntent && (
        <div style={{ padding: '14px 16px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'grid', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Parsed query</div>
          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
            <div><strong>Intent:</strong> {parsedIntent.intent.type}</div>
            <div><strong>Terms:</strong> {parsedIntent.searchTerms.join(', ') || 'None'}</div>
            <div><strong>Filters:</strong> {Object.entries(parsedIntent.filters)
              .filter(([, value]) => {
                if (Array.isArray(value)) return value.length > 0;
                return value !== undefined && value !== null && value !== '';
              })
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join('; ') || 'None'}
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ padding: '14px 16px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '10px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Recent conversational queries</div>
          <ul style={{ display: 'grid', gap: '8px', margin: 0, padding: 0, listStyle: 'none' }}>
            {history.map((item, idx) => (
              <li key={`${item.query}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <span>{item.query}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{item.timestamp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
