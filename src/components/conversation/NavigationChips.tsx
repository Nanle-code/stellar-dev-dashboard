/**
 * NavigationChips — Quick action chips for discoverability of navigation commands (#555)
 */

import React from 'react';
import { getQuickNavSuggestions, type NavCommand } from '../../lib/navigationClassifier';

interface NavigationChipsProps {
  onSelect: (command: NavCommand) => void;
  compact?: boolean;
}

export default function NavigationChips({ onSelect, compact = false }: NavigationChipsProps) {
  const suggestions = getQuickNavSuggestions();

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: compact ? '4px' : '6px',
        padding: compact ? '4px 0' : '8px 0',
      }}
    >
      {suggestions.map((cmd) => (
        <button
          key={cmd.id}
          onClick={() => onSelect(cmd)}
          title={cmd.description}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: compact ? '5px 10px' : '7px 12px',
            fontSize: compact ? '10px' : '11px',
            fontFamily: 'var(--font-mono)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 180ms ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--cyan-glow)';
            e.currentTarget.style.borderColor = 'var(--cyan-dim)';
            e.currentTarget.style.color = 'var(--cyan)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-elevated)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <span style={{ fontSize: compact ? '12px' : '14px', lineHeight: 1 }}>
            {cmd.icon}
          </span>
          {!compact && <span>{cmd.label}</span>}
        </button>
      ))}
    </div>
  );
}
