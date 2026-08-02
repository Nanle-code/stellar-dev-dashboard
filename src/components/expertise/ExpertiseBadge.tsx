/**
 * ExpertiseBadge — Floating badge showing current expertise level with manual override.
 *
 * Features:
 *  - Displays current level with color-coded indicator
 *  - Dropdown for manual level override (Novice/Intermediate/Expert/Auto)
 *  - Shows growth trend indicator
 *  - Tooltip with next milestone information
 *  - Progress bar towards next level
 *
 * Placement: Rendered in DashboardLayout, positioned near the user menu.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useExpertise } from '../../context/ExpertiseContext';
import type { ExpertiseLevel } from '../../lib/expertiseAdaptation';
import { isFeatureAccessible, type ComponentAdaptation } from '../../hooks/useAdaptiveComponents';

// ─── Level Config ────────────────────────────────────────────────────────────

interface LevelConfig {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const LEVEL_CONFIG: Record<ExpertiseLevel, LevelConfig> = {
  novice: {
    label: 'Novice',
    icon: '🌱',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  intermediate: {
    label: 'Intermediate',
    icon: '⚡',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  expert: {
    label: 'Expert',
    icon: '👑',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
};

const TREND_LABELS: Record<string, string> = {
  accelerating: '🚀 Accelerating',
  stable: '→ Stable',
  plateaued: '⏸ Plateaued',
};

// ─── Component ───────────────────────────────────────────────────────────────

export interface ExpertiseBadgeProps {
  /** Position of the badge */
  position?: 'top-right' | 'inline';
  /** Whether to show the progress panel inline */
  showProgressPanel?: boolean;
  /** Callback when level changes */
  onLevelChange?: (level: ExpertiseLevel | 'auto') => void;
  /** Additional CSS styles */
  style?: React.CSSProperties;
}

export default function ExpertiseBadge({
  position = 'inline',
  showProgressPanel = false,
  onLevelChange,
  style = {},
}: ExpertiseBadgeProps) {
  const {
    level,
    profile,
    setLevel,
    clearOverride,
    isNovice,
    isIntermediate,
    isExpert,
    refreshProfile,
  } = useExpertise();

  const [isOpen, setIsOpen] = useState(false);
  const [showPanel, setShowPanel] = useState(showProgressPanel);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);

  const config = LEVEL_CONFIG[level];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        badgeRef.current &&
        !badgeRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLevelChange = useCallback((newLevel: ExpertiseLevel | 'auto') => {
    if (newLevel === 'auto') {
      clearOverride();
    } else {
      setLevel(newLevel);
    }
    setIsOpen(false);
    onLevelChange?.(newLevel);
  }, [setLevel, clearOverride, onLevelChange]);

  const confidencePercent = profile ? Math.round(profile.confidence * 100) : 0;
  const progressPercent = profile ? Math.round(profile.progressToNext * 100) : 0;

  return (
    <>
      {/* Badge button */}
      <button
        ref={badgeRef}
        onClick={() => setIsOpen(!isOpen)}
        className="expertise-badge-trigger"
        aria-label={`Expertise level: ${config.label}. Click to change.`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          background: config.bgColor,
          border: `1px solid ${config.borderColor}`,
          borderRadius: 'var(--radius-pill, 999px)',
          color: config.color,
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          transition: 'var(--transition)',
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '14px' }}>{config.icon}</span>
        <span>{config.label}</span>
        <span
          aria-hidden="true"
          style={{
            fontSize: '8px',
            opacity: 0.7,
            transition: 'transform var(--transition)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▼
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="expertise-badge-dropdown"
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            minWidth: '240px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
            zIndex: 1200,
            overflow: 'hidden',
          }}
        >
          {/* Current level info */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '24px' }}>{config.icon}</span>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {config.label}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Confidence: {confidencePercent}%
                </div>
              </div>
            </div>

            {/* Progress to next level */}
            {profile?.nextMilestone && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>Progress to next level</span>
                  <span>{progressPercent}%</span>
                </div>
                <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${progressPercent}%`,
                      background: `linear-gradient(90deg, ${config.color}, ${level === 'novice' ? '#f59e0b' : '#8b5cf6'})`,
                      borderRadius: '2px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                  {profile.nextMilestone}
                </div>
              </div>
            )}

            {/* Growth trend */}
            {profile?.growthTrend && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                {TREND_LABELS[profile.growthTrend] || profile.growthTrend}
              </div>
            )}
          </div>

          {/* Manual override options */}
          <div style={{ padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Manual Override
            </div>

            {(['novice', 'intermediate', 'expert'] as ExpertiseLevel[]).map((lvl) => {
              const lvlConfig = LEVEL_CONFIG[lvl];
              const isActive = level === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => handleLevelChange(lvl)}
                  role="menuitemradio"
                  aria-checked={isActive}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    background: isActive ? lvlConfig.bgColor : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? lvlConfig.color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 400,
                    fontFamily: 'var(--font-mono)',
                    transition: 'var(--transition)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{lvlConfig.icon}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{lvlConfig.label}</span>
                  {isActive && <span>✓</span>}
                </button>
              );
            })}

            {/* Auto (no override) option */}
            <button
              onClick={() => handleLevelChange('auto')}
              role="menuitemradio"
              aria-checked={!profile?.level} // if no override is set, it's auto
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 400,
                fontFamily: 'var(--font-mono)',
                transition: 'var(--transition)',
                marginTop: '4px',
                borderTop: '1px solid var(--border)',
                paddingTop: '10px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '16px' }}>🤖</span>
              <span style={{ flex: 1, textAlign: 'left' }}>Auto (AI Detection)</span>
            </button>
          </div>

          {/* Progress panel button */}
          <div style={{ padding: '4px 8px 8px' }}>
            <button
              onClick={() => { setShowPanel(!showPanel); setIsOpen(false); }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              📊 View Detailed Progress
            </button>
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--border)',
            fontSize: '9px',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            AI-powered expertise detection v1.0
          </div>
        </div>
      )}
    </>
  );
}

