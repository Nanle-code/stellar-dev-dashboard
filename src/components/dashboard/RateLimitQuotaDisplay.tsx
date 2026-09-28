/**
 * RateLimitQuotaDisplay
 *
 * Shows the remaining server-side API quota to developers using the dashboard.
 * Data is sourced from the Zustand store where `rateLimitedFetch` writes parsed
 * `X-RateLimit-*` / `Retry-After` response headers after every API call.
 *
 * The widget renders nothing when the server has not yet sent any rate-limit
 * headers (quota is null) — it doesn't appear until there is real data to show.
 */

import React from 'react'
import { useStore } from '../../lib/store'
import type { RateLimitQuota } from '../../lib/store'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Unix-epoch-seconds timestamp as a local HH:MM:SS string. */
function formatResetTime(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Compute a 0–100 percentage of quota used from limit + remaining.
 * Returns null when either value is unavailable.
 */
function usedPercent(quota: RateLimitQuota): number | null {
  if (quota.limit === null || quota.remaining === null) return null
  if (quota.limit <= 0) return 100
  const used = quota.limit - quota.remaining
  return Math.min(100, Math.max(0, Math.round((used / quota.limit) * 100)))
}

/** Pick a semantic colour based on how much quota has been consumed. */
function barColor(percent: number): string {
  if (percent >= 90) return 'var(--color-error, #ef4444)'
  if (percent >= 70) return 'var(--color-warning, #f59e0b)'
  return 'var(--color-success, #22c55e)'
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RateLimitQuotaDisplayProps {
  /** Additional CSS class names for the outer wrapper. */
  className?: string
}

export function RateLimitQuotaDisplay({ className }: RateLimitQuotaDisplayProps) {
  const quota = useStore((s) => s.rateLimitQuota)

  // Nothing to show until the first response with rate-limit headers arrives
  if (!quota) return null

  const percent = usedPercent(quota)
  const isLimited = quota.isLimited

  return (
    <div
      className={className}
      role="status"
      aria-label="API rate-limit quota"
      aria-live="polite"
      style={{
        padding: '8px 12px',
        borderRadius: '6px',
        background: isLimited
          ? 'var(--color-error-bg, rgba(239,68,68,0.12))'
          : 'var(--color-surface-2, rgba(255,255,255,0.05))',
        border: `1px solid ${isLimited ? 'var(--color-error, #ef4444)' : 'var(--color-border, rgba(255,255,255,0.1))'}`,
        fontSize: '11px',
        fontFamily: 'var(--font-mono, monospace)',
        color: 'var(--color-text-secondary, #a1a1aa)',
        minWidth: '180px',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
          gap: '8px',
        }}
      >
        <span
          style={{
            fontWeight: 600,
            color: isLimited
              ? 'var(--color-error, #ef4444)'
              : 'var(--color-text, #e4e4e7)',
            letterSpacing: '0.04em',
          }}
        >
          {isLimited ? '⚠ RATE LIMITED' : 'API Quota'}
        </span>

        {quota.remaining !== null && quota.limit !== null && (
          <span aria-label={`${quota.remaining} of ${quota.limit} requests remaining`}>
            {quota.remaining}&thinsp;/&thinsp;{quota.limit}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {percent !== null && (
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percent}% of quota used`}
          style={{
            height: '4px',
            borderRadius: '2px',
            background: 'var(--color-surface-3, rgba(255,255,255,0.08))',
            marginBottom: '6px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percent}%`,
              background: barColor(percent),
              borderRadius: '2px',
              transition: 'width 0.3s ease, background 0.3s ease',
            }}
          />
        </div>
      )}

      {/* Detail rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {quota.resetAt !== null && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Resets at</span>
            <span>{formatResetTime(quota.resetAt)}</span>
          </div>
        )}

        {quota.retryAfter !== null && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Retry after</span>
            <span style={{ color: 'var(--color-error, #ef4444)' }}>
              {quota.retryAfter}s
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default RateLimitQuotaDisplay
