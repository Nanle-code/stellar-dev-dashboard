/**
 * MainnetConfirmDialog — #983 Mainnet Safety Guard
 *
 * Modal confirmation dialog that intercepts write actions on mainnet.
 * The user must type exactly "mainnet" (case-insensitive) before the
 * confirm button becomes active.
 *
 * Props: spread `dialogProps` from `useWriteGuard()` directly onto this component.
 */

import React, { useState, useEffect, useRef } from 'react';

export interface MainnetConfirmDialogProps {
  open: boolean;
  actionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const REQUIRED_PHRASE = 'mainnet';

export default function MainnetConfirmDialog({
  open,
  actionLabel,
  onConfirm,
  onCancel,
}: MainnetConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmed = typed.trim().toLowerCase() === REQUIRED_PHRASE;

  // Reset typed value every time the dialog opens
  useEffect(() => {
    if (open) {
      setTyped('');
      // Focus after the paint so the modal is visible first
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && confirmed) onConfirm();
  };

  return (
    <div
      role="presentation"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mainnet-guard-title"
        aria-describedby="mainnet-guard-desc"
        style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--amber)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 0 48px rgba(255,179,0,0.35)',
          padding: '28px 28px 24px',
          maxWidth: '480px',
          width: '100%',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>
          <span
            aria-hidden="true"
            style={{
              fontSize: '28px',
              lineHeight: 1,
              flexShrink: 0,
              filter: 'drop-shadow(0 0 8px rgba(255,179,0,0.6))',
            }}
          >
            ⚠️
          </span>
          <div>
            <div
              id="mainnet-guard-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '16px',
                color: 'var(--amber)',
                marginBottom: '4px',
              }}
            >
              Mainnet Write Confirmation
            </div>
            <div
              id="mainnet-guard-desc"
              style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}
            >
              You are about to perform a{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{actionLabel}</strong> on{' '}
              <strong style={{ color: 'var(--amber)' }}>Mainnet</strong>. This action involves real
              funds and cannot be undone.
            </div>
          </div>
        </div>

        {/* Confirmation input */}
        <label
          htmlFor="mainnet-confirm-input"
          style={{
            display: 'block',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            letterSpacing: '0.04em',
          }}
        >
          Type{' '}
          <code
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-bright)',
              borderRadius: '3px',
              padding: '1px 6px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--amber)',
            }}
          >
            mainnet
          </code>{' '}
          to confirm
        </label>
        <input
          id="mainnet-confirm-input"
          ref={inputRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="mainnet"
          aria-invalid={typed.length > 0 && !confirmed}
          aria-describedby="mainnet-guard-desc"
          style={{
            width: '100%',
            background: 'var(--bg-elevated)',
            border: `1px solid ${
              typed.length === 0
                ? 'var(--border-bright)'
                : confirmed
                  ? 'var(--green)'
                  : 'var(--red)'
            }`,
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color var(--transition)',
          }}
        />

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginTop: '20px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '9px 18px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-bright)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'var(--transition)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!confirmed}
            aria-disabled={!confirmed}
            style={{
              padding: '9px 20px',
              background: confirmed ? 'var(--amber)' : 'var(--bg-elevated)',
              border: `1px solid ${confirmed ? 'var(--amber)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              color: confirmed ? 'var(--bg-base)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: confirmed ? 'pointer' : 'not-allowed',
              transition: 'var(--transition)',
            }}
          >
            Confirm Write
          </button>
        </div>
      </div>
    </div>
  );
}
