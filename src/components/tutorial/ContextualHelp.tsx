import React, { useState } from 'react';
import { HelpCircle, X, ExternalLink } from 'lucide-react';
import tutorialSystem from '../../lib/tutorialSystem';

/**
 * ContextualHelp — a small "?" icon that shows a popover with help text.
 *
 * Usage:
 *   <ContextualHelp topic="trustline" />
 *   <ContextualHelp topic="public-key" />
 */
export default function ContextualHelp({ topic, inline = false }) {
  const [open, setOpen] = useState(false);
  const help = tutorialSystem.getHelp(topic);

  if (!help) return null;

  return (
    <span style={{ position: 'relative', display: inline ? 'inline-flex' : 'inline-block', verticalAlign: 'middle' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Help: ${help.title}`}
        aria-expanded={open}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted, #94a3b8)', padding: '2px',
          display: 'flex', alignItems: 'center',
        }}
      >
        <HelpCircle size={14} />
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          />
          <div
            role="tooltip"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'var(--bg-card, #1e293b)',
              border: '1px solid var(--border, #334155)',
              borderRadius: '8px',
              padding: '12px',
              width: '240px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                {help.title}
              </span>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #94a3b8)', padding: 0 }}
              >
                <X size={12} />
              </button>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5 }}>
              {help.content}
            </p>
            {help.learnMore && (
              <a
                href={help.learnMore}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: 'var(--accent, #6366f1)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Learn more <ExternalLink size={10} />
              </a>
            )}
          </div>
        </>
      )}
    </span>
  );
}
