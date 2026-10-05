import React, { useEffect, useState } from 'react';
import {
  DEFAULT_TIME_RANGE,
  NETWORK_LABELS,
  NETWORK_NAMES,
  TIME_RANGE_LABELS,
  TIME_RANGE_PRESETS,
  issueMessage,
  type NetworkName,
  type TimeRangePreset,
} from '../../lib/context/url-context';
import { useDashboardContext } from '../../context/DashboardContext';

const BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
  padding: '8px 12px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
};

const GROUP_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontWeight: 700,
};

const CONTROL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  padding: '4px 8px',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};

function presetButtonStyle(active: boolean): React.CSSProperties {
  return {
    ...CONTROL_STYLE,
    background: active ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
    borderColor: active ? 'var(--cyan-dim)' : 'var(--border)',
    color: active ? 'var(--cyan)' : 'var(--text-secondary)',
    fontWeight: active ? 700 : 500,
  };
}

/**
 * ContextBar — the global network + time-range header control (#987).
 *
 * Every change writes to the URL query string (via `DashboardProvider`), so
 * links are shareable and browser back/forward restores the previous context.
 * Invalid values supplied through a hand-edited URL are surfaced here instead
 * of silently mis-rendering the analytics views.
 */
export default function ContextBar() {
  const {
    network,
    networkSource,
    range,
    context,
    setNetwork,
    setRange,
    setCustomRange,
    resetRange,
  } = useDashboardContext();

  const [customOpen, setCustomOpen] = useState(range.value === 'custom');
  const [customFrom, setCustomFrom] = useState(range.from?.slice(0, 10) ?? '');
  const [customTo, setCustomTo] = useState(range.to?.slice(0, 10) ?? '');
  const [customError, setCustomError] = useState<string | null>(null);

  // Keep the custom inputs aligned with the URL when back/forward (or another
  // view) changes the active range.
  useEffect(() => {
    if (range.value === 'custom') {
      setCustomOpen(true);
      setCustomFrom(range.from?.slice(0, 10) ?? '');
      setCustomTo(range.to?.slice(0, 10) ?? '');
    }
  }, [range.value, range.from, range.to]);

  const applyCustom = () => {
    if (!customFrom || !customTo) {
      setCustomError('Pick both a start and an end date.');
      return;
    }
    const applied = setCustomRange(customFrom, customTo);
    setCustomError(applied ? null : 'Start date must be on or before the end date.');
  };

  const issueText = context.issues
    .map((issue) => issueMessage(issue, { requestedNetwork: context.requestedNetwork }))
    .filter(Boolean);

  return (
    <section
      aria-label="Global analytics context"
      data-testid="context-bar"
      style={BAR_STYLE}
    >
      <div style={GROUP_STYLE} role="group" aria-label="Network context">
        <span style={LABEL_STYLE}>Network</span>
        <select
          aria-label="Network"
          value={network}
          onChange={(event) => setNetwork(event.target.value as NetworkName)}
          style={{ ...CONTROL_STYLE, cursor: 'pointer' }}
        >
          {NETWORK_NAMES.map((name) => (
            <option key={name} value={name}>
              {NETWORK_LABELS[name]}
            </option>
          ))}
        </select>
        {networkSource === 'url' && (
          <span style={{ ...LABEL_STYLE, color: 'var(--cyan)' }} title="Network comes from the URL">
            URL
          </span>
        )}
      </div>

      <div style={GROUP_STYLE} role="group" aria-label="Time range context">
        <span style={LABEL_STYLE}>Range</span>
        {TIME_RANGE_PRESETS.map((preset: TimeRangePreset) => {
          const active = range.value === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={active}
              aria-label={TIME_RANGE_LABELS[preset]}
              title={TIME_RANGE_LABELS[preset]}
              onClick={() => setRange(preset)}
              style={presetButtonStyle(active)}
            >
              {preset}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={range.value === 'custom'}
          aria-expanded={customOpen}
          onClick={() => setCustomOpen((open) => !open)}
          style={presetButtonStyle(range.value === 'custom')}
        >
          Custom
        </button>
      </div>

      {customOpen && (
        <div style={GROUP_STYLE} role="group" aria-label="Custom time range">
          <label style={LABEL_STYLE} htmlFor="context-from">
            From
          </label>
          <input
            id="context-from"
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(event) => {
              setCustomFrom(event.target.value);
              setCustomError(null);
            }}
            style={CONTROL_STYLE}
          />
          <label style={LABEL_STYLE} htmlFor="context-to">
            To
          </label>
          <input
            id="context-to"
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(event) => {
              setCustomTo(event.target.value);
              setCustomError(null);
            }}
            style={CONTROL_STYLE}
          />
          <button type="button" onClick={applyCustom} style={presetButtonStyle(false)}>
            Apply
          </button>
          {customError && (
            <span role="alert" style={{ fontSize: '11px', color: 'var(--red, #ef4444)' }}>
              {customError}
            </span>
          )}
        </div>
      )}

      {range.value !== DEFAULT_TIME_RANGE && (
        <button type="button" onClick={resetRange} style={{ ...CONTROL_STYLE, border: 'none' }}>
          Reset range
        </button>
      )}

      {issueText.length > 0 && (
        <span
          role="status"
          data-testid="context-issues"
          style={{ fontSize: '11px', color: 'var(--amber, #f59e0b)' }}
        >
          {issueText.join(' ')}
        </span>
      )}
    </section>
  );
}
