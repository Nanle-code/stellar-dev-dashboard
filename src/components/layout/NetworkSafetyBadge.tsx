/**
 * NetworkSafetyBadge — #983 Mainnet Safety Guard
 *
 * Persistent badge shown in the dashboard header.
 * - All networks: shows the network name with the appropriate accent colour.
 * - Mainnet: uses a distinct amber chrome with a "⚠ MAINNET" label so it is
 *   impossible to confuse with testnet at a glance.
 * - Mainnet + read-only lock: shows a lock icon and a tooltip explaining the
 *   session lock. The lock can be toggled from here.
 *
 * This component is accessibility-compliant: the role, aria-label, and live
 * region announce network changes to screen readers.
 */

import React, { useState } from 'react';
import { useStore } from '../../lib/store';

interface NetworkSafetyBadgeProps {
  isReadOnlyLocked?: boolean;
  onLockToggle?: () => void;
}

const NETWORK_LABELS: Record<string, string> = {
  mainnet: 'MAINNET',
  testnet: 'TESTNET',
  futurenet: 'FUTURENET',
  local: 'LOCAL',
  custom: 'CUSTOM',
};

export default function NetworkSafetyBadge({
  isReadOnlyLocked = false,
  onLockToggle,
}: NetworkSafetyBadgeProps) {
  const { network } = useStore();
  const isMainnet = network === 'mainnet';
  const label = NETWORK_LABELS[network] ?? network.toUpperCase();
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Colour scheme: mainnet gets amber, others keep existing accent colours
  const colourMap: Record<string, string> = {
    mainnet: 'var(--amber)',
    testnet: 'var(--yellow, #f59e0b)',
    futurenet: 'var(--cyan)',
    local: 'var(--purple, #8b5cf6)',
    custom: 'var(--blue, #0ea5e9)',
  };
  const accentColour = colourMap[network] ?? 'var(--text-muted)';

  const mainnetBorderColour = isReadOnlyLocked ? 'var(--red)' : 'var(--amber)';
  const mainnetBgColour = isReadOnlyLocked
    ? 'rgba(255,23,68,0.10)'
    : 'rgba(255,179,0,0.10)';

  const containerStyle: React.CSSProperties = isMainnet
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: '6px 12px',
        borderRadius: '999px',
        background: mainnetBgColour,
        border: `1.5px solid ${mainnetBorderColour}`,
        boxShadow: isReadOnlyLocked
          ? '0 0 10px rgba(255,23,68,0.25)'
          : '0 0 10px rgba(255,179,0,0.25)',
        color: isReadOnlyLocked ? 'var(--red)' : 'var(--amber)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        letterSpacing: '0.08em',
        position: 'relative',
        cursor: onLockToggle ? 'pointer' : 'default',
        transition: 'var(--transition)',
        userSelect: 'none',
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: '999px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        letterSpacing: '0.06em',
      };

  const ariaLabel = isMainnet
    ? isReadOnlyLocked
      ? `Mainnet — read-only lock active. Click to unlock.`
      : `Mainnet — live funds at risk. Click to enable read-only lock.`
    : `Network: ${label}`;

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <div
        role={isMainnet && onLockToggle ? 'button' : undefined}
        tabIndex={isMainnet && onLockToggle ? 0 : undefined}
        aria-label={ariaLabel}
        aria-live="polite"
        aria-atomic="true"
        style={containerStyle}
        onClick={isMainnet && onLockToggle ? onLockToggle : undefined}
        onKeyDown={
          isMainnet && onLockToggle
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onLockToggle();
                }
              }
            : undefined
        }
        onMouseEnter={() => isMainnet && setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => isMainnet && setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
      >
        {/* Dot indicator */}
        <span
          aria-hidden="true"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isMainnet
              ? isReadOnlyLocked
                ? 'var(--red)'
                : 'var(--amber)'
              : accentColour,
            flexShrink: 0,
            boxShadow: isMainnet
              ? isReadOnlyLocked
                ? '0 0 6px var(--red)'
                : '0 0 6px var(--amber)'
              : 'none',
          }}
        />

        {/* Label */}
        {isMainnet ? (
          <>
            <span aria-hidden="true">⚠</span>
            <span>{label}</span>
            {isReadOnlyLocked && <span aria-hidden="true">🔒</span>}
          </>
        ) : (
          <span>{label}</span>
        )}
      </div>

      {/* Tooltip for mainnet */}
      {isMainnet && tooltipVisible && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'var(--bg-elevated)',
            border: `1px solid ${isReadOnlyLocked ? 'var(--red)' : 'var(--amber)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            width: '240px',
            zIndex: 8000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }}
        >
          {isReadOnlyLocked ? (
            <>
              <strong style={{ color: 'var(--red)' }}>🔒 Read-only mode active</strong>
              <br />
              All write actions are blocked this session. Click to unlock.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--amber)' }}>⚠ You are on Mainnet</strong>
              <br />
              Real funds are at risk. Click to enable session read-only lock.
            </>
          )}
        </div>
      )}
    </div>
  );
}
