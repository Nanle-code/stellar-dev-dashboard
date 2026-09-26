import { NETWORK_LABELS } from '../../lib/context/url-context';
import { useDashboardContext } from '../../context/DashboardContext';

export interface ContextScopeNoticeProps {
  /**
   * Label for a view-level override that differs from the global context.
   * Pass `null`/`undefined` when the view is following the global context.
   */
  localOverride?: string | null;
  /** Clears the view-level override; when omitted no reset affordance is shown. */
  onUseGlobal?: () => void;
}

/**
 * ContextScopeNotice — makes it explicit which network + time range an
 * analytics/chart view is rendering with, and flags any view-level override so
 * it is never silently different from the shareable global context (#987).
 */
export default function ContextScopeNotice({
  localOverride = null,
  onUseGlobal,
}: ContextScopeNoticeProps) {
  const { network, timeRangeLabel, resolvedRange } = useDashboardContext();
  const isOverridden = Boolean(localOverride) && localOverride !== timeRangeLabel;

  return (
    <div
      data-testid="context-scope-notice"
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        fontSize: '11px',
        color: 'var(--text-muted)',
      }}
    >
      <span>
        Context: <strong style={{ color: 'var(--text-secondary)' }}>{NETWORK_LABELS[network]}</strong>
        {' · '}
        <strong style={{ color: 'var(--text-secondary)' }}>{timeRangeLabel}</strong>
        {resolvedRange.start && resolvedRange.end
          ? ` (${resolvedRange.start.toISOString().slice(0, 10)} → ${resolvedRange.end
              .toISOString()
              .slice(0, 10)})`
          : ''}
      </span>

      {isOverridden && (
        <span
          data-testid="local-override-badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 8px',
            borderRadius: '999px',
            border: '1px solid var(--amber, #f59e0b)',
            color: 'var(--amber, #f59e0b)',
            fontWeight: 600,
          }}
        >
          Local override: {localOverride}
          {onUseGlobal && (
            <button
              type="button"
              onClick={onUseGlobal}
              style={{
                border: 'none',
                background: 'none',
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '11px',
                padding: 0,
              }}
            >
              Use global
            </button>
          )}
        </span>
      )}
    </div>
  );
}
