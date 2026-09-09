import React from 'react';
import { useBackupOptimizer } from '../../hooks/useBackupOptimizer';
import type { ChangeEvent } from '../../lib/backupOptimizer';

const CRITICALITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#6b7280',
  running: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  skipped: '#9ca3af',
};

export function BackupOptimizerDashboard() {
  const {
    loading,
    optimizerState,
    plannerState,
    schedulerState,
    activePlan,
    nextTask,
    efficiencyReport,
    complianceReport,
    scheduleProjection,
    runOptimization,
    runRecoveryPlan,
    executeNextBackup,
    refresh,
  } = useBackupOptimizer();

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'var(--text-secondary, #9ca3af)' }}>
        Loading backup optimizer...
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #f9fafb)' }}>
          Backup & Recovery Optimizer
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={runOptimization}
            style={{
              padding: '8px 16px',
              background: 'var(--accent, #3b82f6)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Run Optimization
          </button>
          <button
            onClick={runRecoveryPlan}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-card, #1f2937)',
              color: 'var(--text-primary, #f9fafb)',
              border: '1px solid var(--border, #374151)',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Generate Recovery Plan
          </button>
          <button
            onClick={refresh}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-card, #1f2937)',
              color: 'var(--text-primary, #f9fafb)',
              border: '1px solid var(--border, #374151)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
        <MetricCard title="Efficiency Gain" value={`${efficiencyReport.current}%`} subtitle={`+${efficiencyReport.improvement}% vs baseline`} color="#22c55e" />
        <MetricCard title="RTO Compliance" value={`${complianceReport.rtoCompliance}%`} subtitle="Recovery Time Objective" color="#3b82f6" />
        <MetricCard title="RPO Compliance" value={`${complianceReport.rpoCompliance}%`} subtitle="Recovery Point Objective" color="#8b5cf6" />
        <MetricCard title="Schedule Projection" value={`${scheduleProjection.projectedGain}%`} subtitle="Projected efficiency" color="#f97316" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card, #1f2937)', borderRadius: 8, padding: 16, border: '1px solid var(--border, #374151)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #f9fafb)' }}>
            Change Patterns
          </h3>
          {optimizerState && Object.values(optimizerState.patterns).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.values(optimizerState.patterns).map((pattern) => (
                <div key={pattern.entityType} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--bg-base, #111827)',
                  borderRadius: 6,
                }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary, #f9fafb)' }}>{pattern.entityType}</span>
                  <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-secondary, #9ca3af)' }}>
                    <span>{pattern.frequency}/day</span>
                    <span>v:{pattern.volatility}</span>
                    <span style={{
                      color: pattern.trend === 'increasing' ? '#22c55e' : pattern.trend === 'decreasing' ? '#ef4444' : '#eab308',
                    }}>
                      {pattern.trend}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 14 }}>No patterns yet. Run optimization to analyze.</p>
          )}
        </div>

        <div style={{ background: 'var(--bg-card, #1f2937)', borderRadius: 8, padding: 16, border: '1px solid var(--border, #374151)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #f9fafb)' }}>
            Importance Scores
          </h3>
          {optimizerState && Object.values(optimizerState.importanceScores).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.values(optimizerState.importanceScores).map((score) => (
                <div key={score.entityType} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--bg-base, #111827)',
                  borderRadius: 6,
                }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary, #f9fafb)' }}>{score.entityType}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{
                      width: 60,
                      height: 6,
                      background: '#374151',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${score.score * 100}%`,
                        height: '100%',
                        background: CRITICALITY_COLORS[score.criticality],
                        borderRadius: 3,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: `${CRITICALITY_COLORS[score.criticality]}20`,
                      color: CRITICALITY_COLORS[score.criticality],
                    }}>
                      {score.criticality}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 14 }}>No scores yet. Run optimization to compute.</p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--bg-card, #1f2937)', borderRadius: 8, padding: 16, border: '1px solid var(--border, #374151)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #f9fafb)' }}>
            Recovery Plan
          </h3>
          {activePlan ? (
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary, #9ca3af)' }}>
                  <span style={{ color: 'var(--text-primary, #f9fafb)', fontWeight: 600 }}>{activePlan.priorities.length}</span> entities
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary, #9ca3af)' }}>
                  <span style={{ color: 'var(--text-primary, #f9fafb)', fontWeight: 600 }}>{(activePlan.totalEstimatedDuration / 60).toFixed(1)}h</span> est. duration
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activePlan.sequence.slice(0, 8).map((step) => (
                  <div key={step.step} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    background: step.criticalPath ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-base, #111827)',
                    borderRadius: 4,
                    fontSize: 13,
                  }}>
                    <span style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: step.criticalPath ? '#ef4444' : '#374151',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {step.step}
                    </span>
                    <span style={{ color: 'var(--text-primary, #f9fafb)', flex: 1 }}>{step.entityType}</span>
                    <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 12 }}>
                      {step.estimatedDuration.toFixed(0)}s
                    </span>
                    {step.criticalPath && (
                      <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 600 }}>CRITICAL</span>
                    )}
                  </div>
                ))}
                {activePlan.sequence.length > 8 && (
                  <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 12, textAlign: 'center' }}>
                    +{activePlan.sequence.length - 8} more steps
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 14 }}>No active recovery plan. Generate one to see the sequence.</p>
          )}
        </div>

        <div style={{ background: 'var(--bg-card, #1f2937)', borderRadius: 8, padding: 16, border: '1px solid var(--border, #374151)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #f9fafb)' }}>
            Backup Schedule
          </h3>
          <div style={{ marginBottom: 12 }}>
            {nextTask ? (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: 6,
                border: '1px solid rgba(59, 130, 246, 0.3)',
                marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary, #f9fafb)', fontSize: 14 }}>{nextTask.entityType}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #9ca3af)', marginTop: 2 }}>
                      {nextTask.strategy} · Priority {nextTask.priority}
                    </div>
                  </div>
                  <button
                    onClick={executeNextBackup}
                    style={{
                      padding: '6px 12px',
                      background: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Execute
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                  Scheduled: {new Date(nextTask.scheduledAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 13, marginBottom: 12 }}>No pending tasks</p>
            )}
          </div>
          {schedulerState && schedulerState.tasks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #9ca3af)', margin: '0 0 4px 0' }}>
                Queued Tasks ({schedulerState.tasks.length})
              </p>
              {schedulerState.tasks.slice(0, 6).map((task) => (
                <div key={task.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 10px',
                  background: 'var(--bg-base, #111827)',
                  borderRadius: 4,
                  fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text-primary, #f9fafb)' }}>{task.entityType}</span>
                  <span style={{ color: STATUS_COLORS[task.status], fontSize: 12, fontWeight: 500 }}>{task.status}</span>
                </div>
              ))}
            </div>
          )}
          {schedulerState && schedulerState.tasks.length === 0 && !nextTask && (
            <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 14 }}>Run optimization to generate a backup schedule.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, color }: { title: string; value: string; subtitle: string; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-card, #1f2937)',
      borderRadius: 8,
      padding: 16,
      border: '1px solid var(--border, #374151)',
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary, #9ca3af)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #9ca3af)', marginTop: 4 }}>{subtitle}</div>
    </div>
  );
}

export default BackupOptimizerDashboard;
