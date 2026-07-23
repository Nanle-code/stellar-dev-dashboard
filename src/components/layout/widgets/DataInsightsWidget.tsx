import React, { useEffect } from 'react';
import WidgetBase from './WidgetBase';
import { useStore } from '../../../lib/store';

interface DataInsightsWidgetProps {
  onRefresh?: () => void;
}

export default function DataInsightsWidget({ onRefresh }: DataInsightsWidgetProps) {
  const {
    analytics,
    isGeneratingInsights,
    generateDataInsights,
    transactions,
    operations,
    connectedAddress
  } = useStore();

  useEffect(() => {
    if (connectedAddress && (transactions.length > 0 || operations.length > 0)) {
      generateDataInsights();
    }
  }, [connectedAddress, transactions, operations, generateDataInsights]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'var(--red)';
      case 'medium': return 'var(--amber)';
      case 'low': return 'var(--green)';
      default: return 'var(--cyan)';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'high': return 'var(--red-glow-sm)';
      case 'medium': return 'var(--amber-glow-sm)';
      case 'low': return 'var(--green-glow-sm)';
      default: return 'var(--cyan-glow-sm)';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'trend': return '📈';
      case 'outlier': return '⚠️';
      case 'summary': return 'ℹ️';
      default: return '💡';
    }
  };

  return (
    <WidgetBase
      title="Intelligent Insights"
      subtitle="AI-driven summary of your recent data"
      icon="🧠"
      loading={isGeneratingInsights}
      onRefresh={() => {
        generateDataInsights();
        if (onRefresh) onRefresh();
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!analytics || analytics.insights.length === 0 ? (
          <div style={{ 
            padding: '24px', 
            textAlign: 'center', 
            color: 'var(--text-muted)', 
            fontSize: '13px' 
          }}>
            Waiting for sufficient data to generate insights...
          </div>
        ) : (
          <>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              padding: '12px', 
              background: 'var(--bg-elevated)', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-bright)'
            }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Txs Analysed</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--cyan)' }}>{analytics.stats.totalTransactions}</div>
              </div>
              <div style={{ width: '1px', background: 'var(--border)' }}></div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Fee</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--amber)' }}>{analytics.stats.avgFee}</div>
              </div>
              <div style={{ width: '1px', background: 'var(--border)' }}></div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Success Rate</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: analytics.stats.successRate > 90 ? 'var(--green)' : 'var(--red)' }}>
                  {analytics.stats.successRate}%
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '-4px' }}>
                Key Findings
              </div>
              {analytics.insights.map((insight) => (
                <div key={insight.id} style={{
                  padding: '12px',
                  background: getSeverityBg(insight.severity),
                  border: `1px solid ${getSeverityColor(insight.severity)}`,
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ fontSize: '18px', lineHeight: 1 }}>
                    {getIcon(insight.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: 600, 
                      color: 'var(--text-primary)', 
                      marginBottom: '4px' 
                    }}>
                      {insight.title}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5
                    }}>
                      {insight.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </WidgetBase>
  );
}
