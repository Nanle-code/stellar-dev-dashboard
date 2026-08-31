/**
 * MainnetReviewModal
 *
 * Displays a mandatory review step before any write operation on Mainnet.
 * Shows network, source, destination(s), assets, fees, and irreversibility
 * warnings so the user can make an informed decision before signing.
 */
import React, { useState } from 'react'
import { AlertTriangle, Shield, Globe, User, ArrowRight, Coins, Zap, X } from 'lucide-react'

export interface MainnetReviewItem {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
}

export interface MainnetReviewModalProps {
  /** Human-readable title for the action being reviewed */
  actionTitle: string
  /** Set to true when the action is irreversible (contract invoke, payment, etc.) */
  irreversible?: boolean
  /** Summary rows to display in the review table */
  items: MainnetReviewItem[]
  /** Additional warning lines shown in the caution box */
  warnings?: string[]
  onConfirm: () => void
  onCancel: () => void
}

export default function MainnetReviewModal({
  actionTitle,
  irreversible = true,
  items,
  warnings = [],
  onConfirm,
  onCancel,
}: MainnetReviewModalProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mainnet-review-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--amber, #f59e0b)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(245,158,11,0.15)',
                border: '1px solid var(--amber, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Shield size={20} style={{ color: 'var(--amber, #f59e0b)' }} />
            </div>
            <div>
              <div
                id="mainnet-review-title"
                style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}
              >
                Mainnet Review
              </div>
              <div style={{ fontSize: '12px', color: 'var(--amber, #f59e0b)', marginTop: '2px' }}>
                {actionTitle}
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cancel and close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Network badge */}
        <div style={{ padding: '16px 24px 0' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid var(--amber, #f59e0b)',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--amber, #f59e0b)',
            }}
          >
            <Globe size={13} />
            Stellar Mainnet (Public Network)
          </div>
        </div>

        {/* Review items */}
        <div style={{ padding: '16px 24px' }}>
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {items.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderBottom: i < items.length - 1 ? '1px solid var(--border)' : undefined,
                  background: item.highlight ? 'rgba(245,158,11,0.06)' : undefined,
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                    minWidth: '110px',
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: item.highlight ? 700 : 500,
                    fontFamily: item.mono ? 'var(--font-mono)' : undefined,
                    color: item.highlight ? 'var(--amber, #f59e0b)' : 'var(--text-primary)',
                    textAlign: 'right',
                    wordBreak: 'break-all',
                  }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Irreversibility + custom warnings */}
        <div style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {irreversible && (
            <div
              style={{
                display: 'flex',
                gap: '10px',
                padding: '12px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: '1px' }} />
              <div style={{ fontSize: '12px', color: 'var(--red)', lineHeight: 1.5 }}>
                This action is <strong>irreversible</strong>. Once submitted to Mainnet it cannot be
                undone. Verify every detail carefully.
              </div>
            </div>
          )}

          {warnings.map((w, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '10px',
                padding: '10px 14px',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <AlertTriangle size={14} style={{ color: 'var(--amber, #f59e0b)', flexShrink: 0, marginTop: '1px' }} />
              <div style={{ fontSize: '12px', color: 'var(--amber, #f59e0b)', lineHeight: 1.5 }}>
                {w}
              </div>
            </div>
          ))}
        </div>

        {/* Acknowledgement checkbox */}
        <div style={{ padding: '0 24px 20px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
              padding: '12px 14px',
              background: 'var(--bg-elevated)',
              border: `1px solid ${acknowledged ? 'var(--green)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              transition: 'border-color 0.2s',
            }}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              style={{ marginTop: '2px', flexShrink: 0, accentColor: 'var(--green)' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              I have reviewed all details above and understand this operation will be submitted to{' '}
              <strong>Stellar Mainnet</strong>.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div
          style={{
            padding: '16px 24px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: '12px',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '11px 16px',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!acknowledged}
            aria-disabled={!acknowledged}
            style={{
              flex: 2,
              padding: '11px 16px',
              background: acknowledged ? 'var(--amber, #f59e0b)' : 'var(--bg-elevated)',
              color: acknowledged ? '#000' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: acknowledged ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            Confirm &amp; Proceed on Mainnet
          </button>
        </div>
      </div>
    </div>
  )
}
