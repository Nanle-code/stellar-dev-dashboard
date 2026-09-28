import React, { useState, useEffect } from 'react';
import { getMetrics, getResourceTimings, getBundleStats } from '../../lib/performanceMonitoring';

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadMetrics = () => {
      setMetrics(getMetrics());
      setResources(getResourceTimings().slice(0, 20));
    };
    loadMetrics();
    const interval = setInterval(loadMetrics, 5000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10b981';
    if (score >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const calculatePerformanceScore = () => {
    if (!metrics) return 0;
    const lcp = metrics.LCP?.[0]?.value || 0;
    const fid = metrics.FID?.[0]?.value || 0;
    const cls = metrics.CLS?.[0]?.value || 0;
    
    let score = 100;
    if (lcp > 2500) score -= 30;
    else if (lcp > 4000) score -= 50;
    if (fid > 100) score -= 20;
    else if (fid > 300) score -= 40;
    if (cls > 0.1) score -= 20;
    else if (cls > 0.25) score -= 40;
    
    return Math.max(0, score);
  };

  const score = calculatePerformanceScore();

  return (
    <div style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Performance Dashboard</h2>
        <button onClick={() => setRefreshKey(k => k + 1)} style={{ padding: '6px 12px' }}>Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Performance Score</div>
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: getScoreColor(score) }}>{score}</div>
        </div>

        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>LCP (Largest Contentful Paint)</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {metrics?.LCP?.[0]?.value ? `${Math.round(metrics.LCP[0].value)}ms` : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Target: &lt; 2500ms</div>
        </div>

        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>FID (First Input Delay)</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {metrics?.FID?.[0]?.value ? `${Math.round(metrics.FID[0].value)}ms` : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Target: &lt; 100ms</div>
        </div>

        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>CLS (Cumulative Layout Shift)</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {metrics?.CLS?.[0]?.value ? metrics.CLS[0].value.toFixed(3) : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Target: &lt; 0.1</div>
        </div>

        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>FCP (First Contentful Paint)</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {metrics?.FCP?.[0]?.value ? `${Math.round(metrics.FCP[0].value)}ms` : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Target: &lt; 1800ms</div>
        </div>

        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>TTFB (Time to First Byte)</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {metrics?.TTFB?.[0]?.value ? `${Math.round(metrics.TTFB[0].value)}ms` : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Target: &lt; 600ms</div>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '12px' }}>Resource Timings</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Resource</th>
                <th style={{ padding: '12px' }}>Type</th>
                <th style={{ padding: '12px' }}>Duration</th>
                <th style={{ padding: '12px' }}>Size</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource, idx) => (
                <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {resource.name.split('/').pop() || resource.name}
                  </td>
                  <td style={{ padding: '12px' }}>{resource.type}</td>
                  <td style={{ padding: '12px' }}>{Math.round(resource.duration)}ms</td>
                  <td style={{ padding: '12px' }}>{(resource.size / 1024).toFixed(1)} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
