import React, { useState } from 'react';
import { runAccessibilityAudit, formatViolation, getViolationSeverity, generateAccessibilityReport, type AuditResult } from '../../lib/accessibilityAudit';

export default function AccessibilityAuditPanel() {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await runAccessibilityAudit();
      setAudit(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed');
    } finally {
      setIsRunning(false);
    }
  };

  const downloadReport = () => {
    if (!audit) return;
    const report = generateAccessibilityReport(audit);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      critical: '#dc2626',
      serious: '#ea580c',
      moderate: '#f59e0b',
      minor: '#3b82f6',
    };
    return colors[severity as keyof typeof colors] || '#6b7280';
  };

  return (
    <div style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Accessibility Audit (WCAG 2.1)</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {audit && <button onClick={downloadReport} style={{ padding: '6px 12px' }}>Download Report</button>}
          <button onClick={runAudit} disabled={isRunning} style={{ padding: '6px 12px' }}>
            {isRunning ? 'Running...' : 'Run Audit'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {audit && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Score</div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: audit.score >= 90 ? '#10b981' : audit.score >= 70 ? '#f59e0b' : '#ef4444' }}>
                {audit.score}
              </div>
            </div>
            <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Violations</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ef4444' }}>{audit.violations.length}</div>
            </div>
            <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Passes</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>{audit.passes.length}</div>
            </div>
            <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Incomplete</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>{audit.incomplete.length}</div>
            </div>
          </div>

          {audit.violations.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '12px' }}>Violations</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {audit.violations.map((violation, idx) => (
                  <div key={idx} style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', borderLeft: `4px solid ${getSeverityColor(violation.impact || 'minor')}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 'bold' }}>{formatViolation(violation)}</div>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '12px', 
                        fontWeight: 'bold',
                        background: getSeverityColor(violation.impact || 'minor'),
                        color: 'white'
                      }}>
                        {violation.impact?.toUpperCase() || 'MINOR'}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {violation.description}
                    </div>
                    <a href={violation.helpUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '14px', color: 'var(--color-primary)' }}>
                      Learn more →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
