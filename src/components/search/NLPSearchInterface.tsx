import React, { useState, useEffect } from 'react';
import { parseNaturalLanguageQuery, generateSearchSuggestions, classifyIntent } from '../../lib/nlpSearchEngine';
import { globalSemanticSearch } from '../../lib/semanticSearch';

interface NLPSearchInterfaceProps {
  onSearch: (filters: any, searchTerms: string[]) => void;
  placeholder?: string;
}

export default function NLPSearchInterface({ onSearch, placeholder }: NLPSearchInterfaceProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('search-history');
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse search history', e);
      }
    }
  }, []);

  useEffect(() => {
    if (query.length >= 2) {
      const newSuggestions = generateSearchSuggestions(query, history);
      setSuggestions(newSuggestions);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query, history]);

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const parsed = parseNaturalLanguageQuery(searchQuery);
    onSearch(parsed.filters, parsed.searchTerms);

    const updatedHistory = [searchQuery, ...history.filter(h => h !== searchQuery)].slice(0, 20);
    setHistory(updatedHistory);
    localStorage.setItem('search-history', JSON.stringify(updatedHistory));
    
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const intent = query.length >= 3 ? classifyIntent(query) : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(suggestions.length > 0)}
          placeholder={placeholder || "Search with natural language (e.g., 'payments to GABC...')"}
          style={{
            width: '100%',
            padding: '12px 48px 12px 16px',
            fontSize: '14px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="submit"
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'var(--color-primary)',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            cursor: 'pointer',
            color: 'white',
          }}
        >
          Search
        </button>
      </form>

      {intent && intent.confidence > 0.7 && (
        <div style={{ 
          marginTop: '8px', 
          padding: '8px 12px', 
          background: 'var(--bg-elevated)', 
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}>
          Detected: <strong>{intent.type}</strong> search
          {intent.entities.addresses && ` • ${intent.entities.addresses.length} address(es)`}
          {intent.entities.amounts && ` • ${intent.entities.amounts.length} amount(s)`}
          {intent.entities.assets && ` • ${intent.entities.assets.length} asset(s)`}
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxHeight: '200px',
          overflow: 'auto',
        }}>
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              onClick={() => {
                setQuery(suggestion);
                handleSearch(suggestion);
              }}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
