import React, { useState, useEffect } from 'react';
import { Bug, X } from 'lucide-react';

interface DebugAssistantButtonProps {
  onClick: () => void;
  isOpen: boolean;
  issueCount?: number;
}

export default function DebugAssistantButton({
  onClick,
  isOpen,
  issueCount = 0,
}: DebugAssistantButtonProps) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (issueCount > 0) {
      const interval = setInterval(() => {
        setPulse((p) => !p);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [issueCount]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? 'Close Debug Assistant' : `Open Debug Assistant${issueCount > 0 ? ` (${issueCount} issues)` : ''}`}
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '80px',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: isOpen
          ? '2px solid var(--cyan)'
          : issueCount > 0
          ? '2px solid var(--amber)'
          : '1px solid var(--border)',
        background: isOpen
          ? 'var(--cyan-glow)'
          : issueCount > 0
          ? 'var(--amber-glow)'
          : 'var(--bg-card)',
        color: isOpen ? 'var(--cyan)' : 'var(--text-secondary)',
        cursor: 'pointer',
        boxShadow: issueCount > 0
          ? `0 0 12px ${pulse ? 'rgba(255, 179, 0, 0.4)' : 'rgba(255, 179, 0, 0.2)'}`
          : '0 6px 18px rgba(0, 0, 0, 0.25)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        transition: 'all 200ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {isOpen ? <X size={20} /> : <Bug size={20} />}
      {issueCount > 0 && !isOpen && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: 'var(--red)',
            color: '#0a0a0a',
            borderRadius: '999px',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            minWidth: '18px',
            textAlign: 'center',
          }}
        >
          {issueCount > 99 ? '99+' : issueCount}
        </span>
      )}
    </button>
  );
}
