import React, { useEffect } from 'react';
import { useStore } from '../../../lib/store';
import WidgetBase from './WidgetBase';
import { generateOverallSummary } from '../../../lib/aiSummarizer';
import { useErrorHandler } from '../../../hooks/useErrorHandler';

export default function AiSummaryWidget({ onRefresh }) {
  const {
    accountData,
    transactions,
    networkStats,
    aiSummaryLoading,
    aiSummaryData,
    setAiSummaryLoading,
    setAiSummaryData
  } = useStore();

  const { handleError } = useErrorHandler('AiSummaryWidget');

  const generateInsights = async () => {
    try {
      if (!accountData || transactions.length === 0) return;
      setAiSummaryLoading(true);

      // Simulate a small delay for "AI processing" to avoid blocking UI abruptly
      await new Promise(resolve => setTimeout(resolve, 600));

      const summary = generateOverallSummary(accountData, transactions, networkStats);
      setAiSummaryData(summary);
    } catch (error) {
      handleError(error);
    } finally {
      setAiSummaryLoading(false);
    }
  };

  useEffect(() => {
    generateInsights();
  }, [accountData, transactions, networkStats]);

  const handleRefresh = () => {
    generateInsights();
    onRefresh?.();
  };

  // Ensure there's data to display
  if (!accountData || transactions.length === 0) {
    return (
      <WidgetBase title="AI Insights" icon="✨" loading={aiSummaryLoading}>
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          Connect an account with transactions to see AI-generated insights.
        </div>
      </WidgetBase>
    );
  }

  return (
    <WidgetBase
      title="AI Insights"
      subtitle="Data Summarization"
      icon="✨"
      onRefresh={handleRefresh}
      loading={aiSummaryLoading}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height: '100%',
        overflowY: 'auto',
        paddingRight: '4px'
      }}>
        {aiSummaryData ? (
          <>
            <div style={{
              padding: '12px',
              background: 'var(--cyan-glow-sm)',
              border: '1px solid var(--cyan)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              color: 'var(--text-primary)',
              lineHeight: '1.5'
            }}>
              <strong>Overview:</strong> {aiSummaryData.text}
            </div>

            {aiSummaryData.txAnalysis?.bulletPoints?.map((point, i) => {
              let icon = '🔹';
              let color = 'var(--text-secondary)';
              
              if (point.includes('anomalous') || point.includes('Warning')) {
                icon = '⚠️';
                color = 'var(--amber)';
              } else if (point.includes('upward trend')) {
                icon = '📈';
                color = 'var(--green)';
              } else if (point.includes('downwards')) {
                icon = '📉';
                color = 'var(--cyan)';
              } else if (point.includes('Flawless')) {
                icon = '✅';
                color = 'var(--green)';
              }

              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: color
                }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>{icon}</span>
                  <span style={{ lineHeight: '1.4' }}>{point}</span>
                </div>
              );
            })}
          </>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No insights available.
          </div>
        )}
      </div>
    </WidgetBase>
  );
}
