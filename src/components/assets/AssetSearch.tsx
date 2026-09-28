import React, { useState, useRef, useEffect } from 'react';
import { useResponsive } from '../../hooks/useResponsive';

export default function AssetSearch({ onSearch, loading, placeholder = "Search assets..." }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const { isMobile } = useResponsive();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  // Keyboard shortcut (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const containerStyles = {
    position: 'relative',
    width: '100%',
    maxWidth: isMobile ? '100%' : '600px',
    margin: '0 auto'
  };

  const formStyles = {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--bg-card)',
    border: `2px solid ${focused ? 'var(--cyan)' : 'var(--border-bright)'}`,
    borderRadius: 'var(--radius-lg)',
    padding: isMobile ? '12px 16px' : '8px 12px',
    transition: 'var(--transition)',
    boxShadow: focused ? '0 0 0 3px var(--cyan-glow-sm)' : 'none'
  };

  const inputStyles = {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontSize: isMobile ? '16px' : '14px', // 16px prevents zoom on iOS
    fontFamily: 'var(--font-mono)',
    padding: '4px 0',
    minHeight: isMobile ? '24px' : '20px'
  };

  const iconButtonStyles = {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition)',
    minWidth: isMobile ? 'var(--touch-target-sm)' : '24px',
    minHeight: isMobile ? 'var(--touch-target-sm)' : '24px'
  };

  const searchButtonStyles = {
    ...iconButtonStyles,
    background: loading ? 'var(--bg-hover)' : 'var(--cyan)',
    color: loading ? 'var(--text-muted)' : 'var(--bg-base)',
    marginLeft: '8px',
    cursor: loading ? 'not-allowed' : 'pointer'
  };

  return (
    <div style={containerStyles}>
      <form onSubmit={handleSubmit} style={formStyles}>
        {/* Search Icon */}
        <div style={{
          ...iconButtonStyles,
          cursor: 'default',
          marginRight: '8px'
        }}>
          🔍
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={inputStyles}
          disabled={loading}
        />

        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              ...iconButtonStyles,
              marginRight: '4px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            ✕
          </button>
        )}

        {/* Search Button */}
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={searchButtonStyles}
          onMouseEnter={e => {
            if (!loading && query.trim()) {
              e.currentTarget.style.background = 'var(--cyan-dim)'
            }
          }}
          onMouseLeave={e => {
            if (!loading && query.trim()) {
              e.currentTarget.style.background = 'var(--cyan)'
            }
          }}
        >
          {loading ? (
            <div className="spinner" style={{ width: '16px', height: '16px' }} />
          ) : (
            '→'
          )}
        </button>
      </form>

      {/* Keyboard Shortcut Hint */}
      {!isMobile && !focused && (
        <div style={{
          position: 'absolute',
          right: '60px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: 'var(--text-muted)',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <kbd style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            padding: '2px 6px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)'
          }}>
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
          </kbd>
          <kbd style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            padding: '2px 6px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)'
          }}>
            K
          </kbd>
        </div>
      )}
    </div>
  );
}