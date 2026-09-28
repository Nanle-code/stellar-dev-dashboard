import React, { useState, useEffect, useMemo } from 'react';
import { useErrorAnalytics } from '../../hooks/useErrorAnalytics';
import { ErrorCategory } from '../../lib/errorHandling';

export default function ErrorAnalyticsDashboard() {
  const { analytics, trends, topErrors, clearAnalytics } = useErrorAnalytics();
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');

  const filteredAnalytics = useMemo(() => {
    const now = Date.now();
    const ranges = { '1h': 3600000, '24h': 86400000, '7d': 604800000 };
    const cutoff = now - ranges[timeRange];
    return analytics.filter(e => e.timestamp >= cutoff);
  }, [analytics, timeRange]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredAnalytics.forEach(e => {
      stats[e.category] = (stats[e.category] || 0) + 1;
    });
    return Object.entries(stats).sort(([, a], [, b]) => b - a);
  }, [filteredAnalytics]);

  return (
    <div style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Error Analytics Dashboard</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={timeRange} onChange={e => setTimeRange(e.target.value as any)} style={{ padding: '6px 12px' }}>
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <button onClick={clearAnalytics} style={{ padding: '6px 12px' }}>Clear</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Errors</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{filteredAnalytics.length}</div>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Unique Categories</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{categoryStats.length}</div>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Retryable Errors</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {filteredAnalytics.filter(e => e.retryable).length}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Errors by Category</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {categoryStats.map(([category, count]) => (
            <div key={category} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '120px', fontSize: '14px' }}>{category}</div>
              <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: '4px', height: '24px', position: 'relative' }}>
                <div style={{
                  width: `${(count / filteredAnalytics.length) * 100}%`,
                  background: 'var(--color-primary)',
                  height: '100%',
                  borderRadius: '4px',
                  transition: 'width 0.3s'
                }} />
              </div>
              <div style={{ width: '50px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>{count}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '12px' }}>Recent Errors</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflow: 'auto' }}>
          {filteredAnalytics.slice(0, 20).map((error, idx) => (
            <div key={idx} style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--color-error)' }}>{error.category}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {new Date(error.timestamp).toLocaleString()}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>{error.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
