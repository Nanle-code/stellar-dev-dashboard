import React from 'react';
import { Sparkles, Activity, FileJson, CheckCircle, BarChart3, Database } from 'lucide-react';
import { AggregationRecommendation, QualityMetrics } from '../../lib/dataAggregation';

interface DataAggregationOptimizerProps {
  recommendation: AggregationRecommendation;
  quality: QualityMetrics;
  selectedInterval: string;
  onIntervalChange: (interval: any) => void;
  rawCount: number;
  aggregatedCount: number;
}

export default function DataAggregationOptimizer({
  recommendation,
  quality,
  selectedInterval,
  onIntervalChange,
  rawCount,
  aggregatedCount
}: DataAggregationOptimizerProps) {
  const intervals = [
    { value: 'none', label: 'Raw Data' },
    { value: 'hour', label: 'Hourly' },
    { value: 'day', label: 'Daily' },
    { value: 'week', label: 'Weekly' },
    { value: 'month', label: 'Monthly' }
  ];

  const qualityColor = quality.score >= 85 ? 'var(--green)' : quality.score >= 65 ? 'var(--amber)' : 'var(--red)';

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      marginTop: '20px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={18} style={{ color: 'var(--cyan)' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
              AI Aggregation Optimizer
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Heuristics-guided data rollup & client-side compression
            </div>
          </div>
        </div>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: qualityColor,
          border: `1px solid ${qualityColor}`,
          borderRadius: '999px',
          padding: '2px 10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Quality: {quality.score}/100
        </div>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Recommendation Panel */}
        <div style={{
          background: 'rgba(var(--cyan-glow-rgb, 0, 180, 216), 0.05)',
          border: '1px solid var(--cyan-dim)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <Sparkles size={20} style={{ color: 'var(--cyan)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cyan)', marginBottom: '4px' }}>
              Recommendation: Rollup to {intervals.find(i => i.value === recommendation.interval)?.label}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {recommendation.reasoning}
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Confidence: <strong>{Math.round(recommendation.confidence * 100)}%</strong></span>
              <span>Expected Compression: <strong>{recommendation.expectedCompression}x</strong></span>
            </div>
          </div>
        </div>

        {/* Aggregation Control */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
            Current Aggregation Strategy
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {intervals.map((int) => (
              <button
                key={int.value}
                onClick={() => onIntervalChange(int.value)}
                style={{
                  padding: '8px 14px',
                  background: selectedInterval === int.value ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                  border: `1px solid ${selectedInterval === int.value ? 'var(--cyan-dim)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  color: selectedInterval === int.value ? 'var(--cyan)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  fontWeight: selectedInterval === int.value ? 700 : 400,
                  transition: 'var(--transition)'
                }}
              >
                {int.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quality metrics grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          marginTop: '6px'
        }}>
          {[
            { label: 'Data Points', val: `${aggregatedCount} / ${rawCount}`, sub: `Ratio: ${quality.compressionRatio}x`, icon: <Database size={14} style={{ color: 'var(--cyan)' }} /> },
            { label: 'Variance Retained', val: `${quality.varianceRetainedPct}%`, sub: 'Target: >75%', icon: <Activity size={14} style={{ color: 'var(--green)' }} /> },
            { label: 'Information Loss', val: `${quality.informationLossPct}%`, sub: 'Target: <15%', icon: <BarChart3 size={14} style={{ color: 'var(--amber)' }} /> },
            { label: 'Outliers Kept', val: `${quality.outliersPreservedPct}%`, sub: 'Preservation', icon: <CheckCircle size={14} style={{ color: 'var(--cyan)' }} /> }
          ].map((stat, idx) => (
            <div key={idx} style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {stat.icon}
                <span>{stat.label}</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {stat.val}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {stat.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Qualitative description */}
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          Assessment: {quality.explanation}
        </div>
      </div>
    </div>
  );
}
