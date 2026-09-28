/**
 * ExpertiseProgressPanel — Detailed growth metrics and progress tracking panel.
 *
 * Shows:
 *  - Current expertise level with confidence
 *  - Signal breakdown (session duration, feature usage, task completion, etc.)
 *  - Growth trend over time
 *  - Actions the user can take to level up
 *  - Prediction accuracy metrics
 *
 * Accessible from the ExpertiseBadge dropdown or as a standalone panel.
 */

import React, { useMemo } from 'react';
import { useExpertise } from '../../context/ExpertiseContext';
import { getPredictionAccuracy } from '../../lib/expertiseEngine';
import { EXPERTISE_STORAGE_KEY } from '../../lib/expertiseAdaptation';
import type { ExpertiseLevel } from '../../lib/expertiseAdaptation';
import type { ExtendedExpertiseSignals } from '../../lib/expertiseEngine';

// ─── Level Config ────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<ExpertiseLevel, { label: string; icon: string; color: string }> = {
  novice: { label: 'Novice', icon: '🌱', color: '#22c55e' },
  intermediate: { label: 'Intermediate', icon: '⚡', color: '#f59e0b' },
  expert: { label: 'Expert', icon: '👑', color: '#8b5cf6' },
};

// ─── Signal Display Config ──────────────────────────────────────────────────

interface SignalDisplayItem {
  key: keyof ExtendedExpertiseSignals | string;
  label: string;
  format: (value: unknown) => string;
  icon: string;
}

const SIGNAL_DISPLAY: SignalDisplayItem[] = [
  { key: 'sessionDurationMinutes', label: 'Session Duration', format: (v) => `${v ?? 0} min`, icon: '⏱' },
  { key: 'advancedFeatureUses', label: 'Advanced Features Used', format: (v) => `${v ?? 0} times`, icon: '⚡' },
  { key: 'repeatedTaskCount', label: 'Tasks Repeated', format: (v) => `${v ?? 0}`, icon: '🔄' },
  { key: 'successfulActions', label: 'Successful Actions', format: (v) => `${v ?? 0}`, icon: '✅' },
  { key: 'taskCompletionRate', label: 'Task Completion Rate', format: (v) => `${Math.round((v as number ?? 0) * 100)}%`, icon: '📊' },
  { key: 'errorRate', label: 'Error Rate', format: (v) => `${Math.round((v as number ?? 0) * 100)}%`, icon: '⚠️' },
  { key: 'shortcutUsageCount', label: 'Shortcuts Used', format: (v) => `${v ?? 0}`, icon: '⌨️' },
  { key: 'advancedPanelOpens', label: 'Advanced Panel Opens', format: (v) => `${v ?? 0}`, icon: '🔓' },
  { key: 'explorationScore', label: 'Feature Exploration', format: (v) => `${Math.round((v as number ?? 0) * 100)}%`, icon: '🔍' },
  { key: 'advancedSearchUsage', label: 'Advanced Searches', format: (v) => `${v ?? 0}`, icon: '🔎' },
  { key: 'customizationCount', label: 'Customizations Made', format: (v) => `${v ?? 0}`, icon: '⚙️' },
  { key: 'completedTutorials', label: 'Tutorials Completed', format: (v) => `${v ?? 0}`, icon: '📚' },
  { key: 'realtimeFeatureUses', label: 'Real-time Features Used', format: (v) => `${v ?? 0}`, icon: '🔴' },
];

// ─── Actions to Level Up ────────────────────────────────────────────────────

interface LevelUpAction {
  condition: (signals: Partial<ExtendedExpertiseSignals>) => boolean;
  description: string;
  icon: string;
  targetLevel: ExpertiseLevel;
}

const LEVEL_UP_ACTIONS: LevelUpAction[] = [
  {
    condition: (s) => (s.sessionDurationMinutes ?? 0) < 30,
    description: 'Spend more time exploring the dashboard (aim for 30+ minutes per session)',
    icon: '⏱',
    targetLevel: 'intermediate',
  },
  {
    condition: (s) => (s.advancedFeatureUses ?? 0) < 5,
    description: 'Try advanced features like the Transaction Builder and Contract Interaction',
    icon: '⚡',
    targetLevel: 'intermediate',
  },
  {
    condition: (s) => (s.taskCompletionRate ?? 0) < 0.5,
    description: 'Complete more tasks successfully to improve your completion rate',
    icon: '✅',
    targetLevel: 'intermediate',
  },
  {
    condition: (s) => (s.shortcutUsageCount ?? 0) < 3,
    description: 'Use keyboard shortcuts for faster navigation (press ? to see shortcuts)',
    icon: '⌨️',
    targetLevel: 'intermediate',
  },
  {
    condition: (s) => (s.explorationScore ?? 0) < 0.3,
    description: 'Explore more dashboard sections to discover all features',
    icon: '🔍',
    targetLevel: 'intermediate',
  },
  {
    condition: (s) => (s.completedTutorials ?? 0) < 2,
    description: 'Complete guided tutorials to learn advanced concepts',
    icon: '📚',
    targetLevel: 'intermediate',
  },
  {
    condition: (s) => (s.advancedPanelOpens ?? 0) < 10,
    description: 'Access expert-level features like Governance, Compliance, and Monitoring',
    icon: '🔓',
    targetLevel: 'expert',
  },
  {
    condition: (s) => (s.realtimeFeatureUses ?? 0) < 5,
    description: 'Use real-time monitoring features like Live Activity and Streaming',
    icon: '🔴',
    targetLevel: 'expert',
  },
  {
    condition: (s) => (s.customizationCount ?? 0) < 3,
    description: 'Customize your dashboard preferences and layout',
    icon: '⚙️',
    targetLevel: 'expert',
  },
  {
    condition: (s) => (s.advancedSearchUsage ?? 0) < 5,
    description: 'Use the advanced search for more powerful data discovery',
    icon: '🔎',
    targetLevel: 'expert',
  },
];

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ExpertiseProgressPanelProps {
  /** Called when the user wants to close the panel */
  onClose?: () => void;
  /** Whether to show in compact mode (embedded in sidebar/badge) */
  compact?: boolean;
  /** Additional CSS styles */
  style?: React.CSSProperties;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExpertiseProgressPanel({
  onClose,
  compact = false,
  style = {},
}: ExpertiseProgressPanelProps) {
  const { level, profile, signals, extendedSignals, isNovice, isIntermediate, isExpert, refreshProfile } = useExpertise();

  const config = LEVEL_CONFIG[level];
  const confidencePercent = profile ? Math.round(profile.confidence * 100) : 0;
  const progressPercent = profile ? Math.round(profile.progressToNext * 100) : 0;
  const accuracy = profile ? getPredictionAccuracy(profile.signals) : { accuracy: 0, totalPredictions: 0, correctPredictions: 0 };

  // Compute signal values from stored data
  const signalValues = useMemo(() => {
    const stored = typeof window !== 'undefined'
      ? (() => {
          try {
            const raw = window.localStorage.getItem(EXPERTISE_STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
          } catch { return {}; }
        })()
      : {};
    return { ...signals, ...extendedSignals, ...stored };
  }, [signals, extendedSignals]);

  // Determine which actions are still relevant
  const pendingActions = useMemo(() => {
    return LEVEL_UP_ACTIONS.filter(action => {
      const targetMet = action.condition(signalValues);
      // Show actions that haven't been satisfied yet
      return !targetMet && (
        (action.targetLevel === 'intermediate' && (isNovice || isIntermediate)) ||
        (action.targetLevel === 'expert' && (isIntermediate || isExpert))
      );
    });
  }, [signalValues, isNovice, isIntermediate, isExpert]);

  // Compute unique features count
  const uniqueFeaturesCount = useMemo(() => {
    if (signalValues.featureUsageFrequency) {
      return Object.keys(signalValues.featureUsageFrequency).length;
    }
    return 0;
  }, [signalValues]);

  if (compact) {
    return (
      <div
        style={{
          padding: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          ...style,
        }}
      >
        {/* Compact header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <span style={{ fontSize: '20px' }}>{config.icon}</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {config.label} Level
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {confidencePercent}% confidence · {progressPercent}% to next
            </div>
          </div>
        </div>

        {/* Compact progress bar */}
        <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
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

        {/* Pending actions summary */}
        {pendingActions.length > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {pendingActions.length} actions recommended to level up
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '28px' }}>{config.icon}</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {config.label} Level
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                AI-powered expertise detection · Confidence: {confidencePercent}%
              </p>
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close panel"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ padding: '20px' }}>
        {/* Growth trend and progress */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Progress to {level === 'novice' ? 'Intermediate' : level === 'intermediate' ? 'Expert' : '— Max Level'}
            </span>
            <span style={{ fontSize: '13px', color: config.color, fontWeight: 700 }}>{progressPercent}%</span>
          </div>
          <div style={{ height: '8px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: `linear-gradient(90deg, ${config.color}, ${level === 'novice' ? '#f59e0b' : '#8b5cf6'})`,
                borderRadius: '4px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          {profile?.nextMilestone && (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              🎯 {profile.nextMilestone}
            </p>
          )}
        </div>

        {/* Growth trend */}
        {profile?.growthTrend && (
          <div style={{ marginBottom: '24px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Growth Trend
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
              {profile.growthTrend === 'accelerating' && '🚀 Accelerating — You\'re learning fast!'}
              {profile.growthTrend === 'stable' && '→ Stable — Consistent usage detected'}
              {profile.growthTrend === 'plateaued' && '⏸ Plateaued — Try new features to accelerate growth'}
            </div>
          </div>
        )}

        {/* Signal breakdown */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            📊 Signal Breakdown
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {SIGNAL_DISPLAY.map((signal) => {
              const value = signalValues[signal.key as keyof typeof signalValues];
              const displayValue = value !== undefined ? signal.format(value) : '—';
              return (
                <div
                  key={signal.key}
                  style={{
                    padding: '8px 10px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '14px' }}>{signal.icon}</span>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{signal.label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{displayValue}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unique features */}
        <div style={{ marginBottom: '24px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
            Feature Exploration
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
            {uniqueFeaturesCount} unique features explored
          </div>
          <div style={{ marginTop: '6px', height: '4px', background: 'var(--bg-card)', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (uniqueFeaturesCount / 50) * 100)}%`,
                background: 'var(--cyan)',
                borderRadius: '2px',
              }}
            />
          </div>
        </div>

        {/* Level-up actions */}
        {pendingActions.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              🎯 Recommended Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {pendingActions.slice(0, 5).map((action, index) => (
                <div
                  key={index}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--bg-elevated)',
                    borderLeft: `3px solid ${action.targetLevel === 'expert' ? '#8b5cf6' : '#f59e0b'}`,
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '14px', marginTop: '1px' }}>{action.icon}</span>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {action.description}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Helps reach: {action.targetLevel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prediction accuracy */}
        <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
            AI Prediction Accuracy
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--cyan)' }}>
              {accuracy.totalPredictions > 0 ? `${Math.round(accuracy.accuracy * 100)}%` : '—'}
            </div>
            {accuracy.totalPredictions > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {accuracy.correctPredictions}/{accuracy.totalPredictions} correct predictions
              </div>
            )}
            {accuracy.totalPredictions === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Not enough data yet — keep using the dashboard!
              </div>
            )}
          </div>
        </div>

        {/* Refresh button */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            onClick={refreshProfile}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 16px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              transition: 'var(--transition)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            🔄 Refresh Expertise Profile
          </button>
        </div>
      </div>
    </div>
  );
}

