import React, { useState, useRef } from 'react';
import { analyzeLogs, type LogEntry, type LogInsight, type LogIssue } from '../../lib/logAnalysis';
import { StatCard } from './Card';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--red)',
  high: 'var(--orange, #f97316)',
  medium: 'var(--amber)',
  low: 'var(--cyan)',
};

const CATEGORY_ICONS: Record<string, string> = {
  error: '🔴',
  performance: '⚡',
  security: '🔒',
  pattern: '📊',
  anomaly: '⚠',
};

function parseLogInput(input: string): LogEntry[] {
  const lines = input
    .split('\n')
    .filter((line) => line.trim())
    .slice(0, 1000);

  return lines.map((line, index) => {
    const id = `log-${index}`;
    let timestamp = new Date();
    let level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' = 'INFO';
    let message = line;

    // Try to parse ISO timestamp
    const isoMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    if (isoMatch) {
      timestamp = new Date(isoMatch[0]);
    }

    // Try to detect log level
    if (/\[?ERROR\]?/i.test(line)) level = 'ERROR';
    else if (/\[?FATAL\]?|panic/i.test(line)) level = 'FATAL';
    else if (/\[?WARN\]?/i.test(line)) level = 'WARN';
    else if (/\[?DEBUG\]?/i.test(line)) level = 'DEBUG';
    else if (/\[?INFO\]?/i.test(line)) level = 'INFO';

    // Extract message (remove timestamp and level prefix)
    message = line
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/g, '')
      .replace(/\[\s*(ERROR|WARN|INFO|DEBUG|FATAL)\s*\]\s*/i, '')
      .trim();

    return {
      id,
      timestamp,
      level,
      message: message || line,
    };
  });
}

function LogIssueCard({ issue }: { issue: LogIssue }) {
  const color = SEVERITY_COLORS[issue.severity];
  const icon = CATEGORY_ICONS[issue.category];

  return (
    <div
      style={{
        padding: '12px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${color}`,
        background: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color }}>
            {issue.title}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {issue.category} • {issue.occurrences} occurrence{issue.occurrences !== 1 ? 's' : ''}
          </div>
        </div>
        <div
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            background: color,
            color: '#000',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {issue.severity}
        </div>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {issue.description}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-primary)', padding: '8px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', lineHeight: 1.4 }}>
        <strong>Suggestion:</strong> {issue.suggestion}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        First seen: {issue.firstSeen.toLocaleTimeString()} • Last seen: {issue.lastSeen.toLocaleTimeString()}
      </div>
    </div>
  );
}

function PatternRow({ pattern, index }: { pattern: any; index: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 80px 100px',
        gap: '12px',
        padding: '10px',
        borderBottom: index < 4 ? '1px solid var(--border)' : 'none',
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {pattern.pattern}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
        {pattern.frequency}x
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
        {pattern.percentage.toFixed(1)}%
      </div>
      <div style={{ textAlign: 'center' }}>
        {pattern.isAnomaly && (
          <span
            style={{
              display: 'inline-block',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--amber)',
              color: '#000',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            ANOMALY
          </span>
        )}
      </div>
    </div>
  );
}

export default function LogAnalyzer() {
  const [logInput, setLogInput] = useState('');
  const [insight, setInsight] = useState<LogInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = () => {
    if (!logInput.trim()) {
      setError('Please paste or upload logs to analyze');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Simulate async processing
      setTimeout(() => {
        const logs = parseLogInput(logInput);
        if (logs.length === 0) {
          setError('No valid logs found in input');
          setIsLoading(false);
          return;
        }
        const result = analyzeLogs(logs);
        setInsight(result);
        setIsLoading(false);
      }, 500);
    } catch (err) {
      setError(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setLogInput(content);
      setError('');
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>
        Intelligent Log Analyzer
      </div>

      {/* Input Section */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600 }}>Log Input</div>

        <textarea
          value={logInput}
          onChange={(e) => setLogInput(e.target.value)}
          placeholder="Paste logs here (JSON lines, structured logs, or plain text with ERROR/WARN prefixes)..."
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            fontSize: '12px',
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !logInput.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: isLoading || !logInput.trim() ? 'var(--text-muted)' : 'var(--cyan)',
              color: '#000',
              fontWeight: 600,
              cursor: isLoading || !logInput.trim() ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              opacity: isLoading || !logInput.trim() ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Analyzing...' : 'Analyze Logs'}
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Upload File
          </button>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            accept=".log,.txt,.json"
            style={{ display: 'none' }}
            aria-label="Upload log file"
          />

          <button
            onClick={() => {
              setLogInput('');
              setInsight(null);
              setError('');
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Clear
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--red)',
              fontSize: '12px',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Results Section */}
      {insight && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
            <StatCard label="Total Logs" value={insight.totalLogs} accent="var(--cyan)" />
            <StatCard label="Error Rate" value={`${insight.errorRate.toFixed(2)}%`} accent="var(--red)" />
            <StatCard label="Issues Found" value={insight.issuesFound} accent="var(--amber)" />
            <StatCard label="Patterns" value={insight.patterns.length} accent="var(--green, #22c55e)" />
          </div>

          {/* Summary */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            {insight.summary}
          </div>

          {/* Top Issues */}
          {insight.topIssues.length > 0 && (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700 }}>
                Top Issues
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                {insight.topIssues.map((issue) => (
                  <LogIssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            </div>
          )}

          {/* Patterns */}
          {insight.patterns.length > 0 && (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '14px', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700 }}>
                Recurring Patterns
              </div>
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {insight.patterns.slice(0, 5).map((pattern, index) => (
                  <PatternRow key={index} pattern={pattern} index={index} />
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {insight.recommendations.length > 0 && (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700 }}>
                Recommendations
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {insight.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-elevated)',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <span style={{ marginTop: '2px', flexShrink: 0 }}>💡</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
