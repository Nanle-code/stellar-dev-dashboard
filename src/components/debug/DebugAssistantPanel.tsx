import React, { useState, useEffect, useCallback } from 'react';
import {
  Bug,
  Lightbulb,
  HelpCircle,
  History,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Wrench,
  TrendingUp,
  FileText,
  ExternalLink,
  Search,
} from 'lucide-react';
import { useStore } from '../../lib/store';
import type { AnalysisResult } from '../../lib/debugAssistant/ErrorPatternAnalyzer';
import type { RecommendedSolution } from '../../lib/debugAssistant/SolutionRecommender';
import type { HelpSuggestion } from '../../lib/debugAssistant/ContextualHelpProvider';
import type { FixRecord } from '../../lib/debugAssistant/FixHistoryStore';

type PanelTab = 'analysis' | 'solutions' | 'help' | 'history';

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '14px',
  marginBottom: '12px',
};

interface DebugAssistantPanelProps {
  onClose: () => void;
}

export default function DebugAssistantPanel({ onClose }: DebugAssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('analysis');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [solutions, setSolutions] = useState<RecommendedSolution[]>([]);
  const [helpSuggestions, setHelpSuggestions] = useState<HelpSuggestion[]>([]);
  const [fixHistory, setFixHistory] = useState<FixRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);

  const { network, activeTab: storeActiveTab, connectedAddress } = useStore();

  const loadAssistantData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { getErrorTrends },
        { getContextualHelp },
        { getRecentFixes },
        { getRecommendations },
      ] = await Promise.all([
        import('../../lib/debugAssistant/ErrorPatternAnalyzer'),
        import('../../lib/debugAssistant/ContextualHelpProvider'),
        import('../../lib/debugAssistant/FixHistoryStore'),
        import('../../lib/debugAssistant/SolutionRecommender'),
      ]);

      const [trends, help, history] = await Promise.all([
        getErrorTrends(),
        Promise.resolve(getContextualHelp(storeActiveTab, network)),
        getRecentFixes(10),
      ]);

      setHelpSuggestions(help);
      setFixHistory(history);

      if (trends && trends.totalErrors > 0) {
        const topPattern = trends.topPatterns[0];
        if (topPattern) {
          const recs = await getRecommendations(
            new Error(topPattern.message),
            Object.keys(trends.byCategory)[0] || 'unknown',
            'assistant-auto',
          );
          setSolutions(recs);
        }
      }
    } catch (err) {
      console.error('[DebugAssistant] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [network, storeActiveTab]);

  useEffect(() => {
    loadAssistantData();
  }, [loadAssistantData]);

  const handleSolutionFeedback = async (solutionId: string, wasHelpful: boolean) => {
    setFeedbackLoading(solutionId);
    try {
      const { recordSolutionFeedback } = await import('../../lib/debugAssistant/SolutionRecommender');
      const solution = solutions.find((s) => s.id === solutionId);
      if (solution) {
        await recordSolutionFeedback(
          solution.title,
          'assistant',
          storeActiveTab,
          solution.title,
          wasHelpful,
          { network, activeTab: storeActiveTab },
        );
      }
      setSolutions((prev) =>
        prev.map((s) =>
          s.id === solutionId ? { ...s, confidence: wasHelpful ? Math.min(s.confidence + 0.1, 0.99) : Math.max(s.confidence - 0.1, 0.1) } : s,
        ),
      );
    } catch (err) {
      console.error('[DebugAssistant] Feedback failed:', err);
    } finally {
      setFeedbackLoading(null);
    }
  };

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '420px',
    maxWidth: '100vw',
    height: '100vh',
    background: 'var(--bg-surface)',
    borderLeft: '1px solid var(--border)',
    zIndex: 1060,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.3)',
    animation: 'slideInRight 200ms ease',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  };

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-base)',
  };

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '12px 8px',
    border: 'none',
    background: isActive ? 'var(--bg-surface)' : 'transparent',
    color: isActive ? 'var(--cyan)' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 600,
    borderBottom: isActive ? '2px solid var(--cyan)' : '2px solid transparent',
    transition: 'var(--transition)',
  });

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
  };

  return (
    <div style={panelStyle}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bug size={20} color="var(--cyan)" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
            Debug Assistant
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadAssistantData}
            title="Refresh"
            style={{
              width: '32px', height: '32px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={onClose}
            title="Close"
            style={{
              width: '32px', height: '32px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div style={tabBarStyle}>
        {[
          { id: 'analysis' as PanelTab, label: 'Analysis', icon: TrendingUp },
          { id: 'solutions' as PanelTab, label: 'Solutions', icon: Lightbulb },
          { id: 'help' as PanelTab, label: 'Help', icon: HelpCircle },
          { id: 'history' as PanelTab, label: 'History', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={tabButtonStyle(activeTab === tab.id)}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div style={contentStyle}>
        {loading ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '48px 0', gap: '16px',
          }}>
            <div className="spinner" style={{ width: '32px', height: '32px' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Analyzing patterns...
            </span>
          </div>
        ) : (
          <>
            {activeTab === 'analysis' && (
              <AnalysisTab
                analysisResult={analysisResult}
                solutions={solutions}
              />
            )}
            {activeTab === 'solutions' && (
              <SolutionsTab
                solutions={solutions}
                feedbackLoading={feedbackLoading}
                onFeedback={handleSolutionFeedback}
              />
            )}
            {activeTab === 'help' && (
              <HelpTab suggestions={helpSuggestions} />
            )}
            {activeTab === 'history' && (
              <HistoryTab history={fixHistory} />
            )}
          </>
        )}
      </div>

      {connectedAddress && (
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <Search size={12} />
          Monitoring account: {connectedAddress.slice(0, 8)}...{connectedAddress.slice(-4)}
        </div>
      )}
    </div>
  );
}

function AnalysisTab({
  analysisResult,
  solutions,
}: {
  analysisResult: AnalysisResult | null;
  solutions: RecommendedSolution[];
}) {
  if (!analysisResult) {
    return (
      <OverviewCards solutions={solutions} />
    );
  }

  const sevColor = {
    low: 'var(--green)',
    medium: 'var(--amber)',
    high: 'var(--red)',
    critical: 'var(--red)',
  }[analysisResult.severity] || 'var(--text-secondary)';

  return (
    <div>
      <div style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${sevColor}40`,
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <AlertTriangle size={18} color={sevColor} />
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
            {analysisResult.category.toUpperCase()} Error
          </span>
          <span style={{
            marginLeft: 'auto',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: `${sevColor}20`,
            color: sevColor,
            fontWeight: 600,
          }}>
            {(analysisResult.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <StatBadge label="Pattern" value={analysisResult.temporalPattern} color="var(--cyan)" />
          <StatBadge label="Recurring" value={analysisResult.isRecurring ? `Yes (${analysisResult.frequency}x)` : 'No'} color={analysisResult.isRecurring ? 'var(--amber)' : 'var(--green)'} />
          <StatBadge label="Anomaly Score" value={`${analysisResult.anomalyScore}/100`} color={analysisResult.anomalyScore > 50 ? 'var(--red)' : 'var(--green)'} />
          <StatBadge label="Similar Incidents" value={`${analysisResult.similarPastIncidents}`} color={analysisResult.similarPastIncidents > 0 ? 'var(--cyan)' : 'var(--text-muted)'} />
        </div>

        {analysisResult.mlInsights.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              ML Insights
            </div>
            {analysisResult.mlInsights.map((insight, i) => (
              <div key={i} style={{
                fontSize: '12px', color: 'var(--text-secondary)',
                padding: '6px 10px', background: 'var(--bg-base)',
                borderRadius: 'var(--radius-sm)', marginBottom: '6px',
                borderLeft: '3px solid var(--cyan)',
              }}>
                {insight}
              </div>
            ))}
          </div>
        )}

        {analysisResult.suggestedActions.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Suggested Actions
            </div>
            {analysisResult.suggestedActions.map((action, i) => (
              <div key={i} style={{
                fontSize: '12px', color: 'var(--text-primary)',
                padding: '6px 10px', marginBottom: '4px',
                display: 'flex', alignItems: 'flex-start', gap: '6px',
              }}>
                <ChevronRight size={12} style={{ marginTop: '2px', flexShrink: 0 }} color="var(--cyan)" />
                {action}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewCards({ solutions }: { solutions: RecommendedSolution[] }) {
  const [trendData, setTrendData] = useState<{
    totalErrors: number;
    resolvedRate: number;
    topPatterns: { fingerprint: string; message: string; count: number }[];
  } | null>(null);

  useEffect(() => {
    import('../../lib/debugAssistant/ErrorPatternAnalyzer')
      .then((m) => m.getErrorTrends())
      .then(setTrendData)
      .catch(() => {});
  }, []);

  return (
    <div>
      {trendData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          <MetricCard label="Total Errors" value={String(trendData.totalErrors)} icon={AlertTriangle} color="var(--red)" />
          <MetricCard label="Resolved Rate" value={`${Math.round(trendData.resolvedRate * 100)}%`} icon={CheckCircle2} color="var(--green)" />
        </div>
      )}

      {trendData && trendData.topPatterns.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Top Error Patterns
          </div>
          {trendData.topPatterns.slice(0, 5).map((p, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
              fontSize: '12px',
            }}>
              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {p.message.length > 50 ? p.message.slice(0, 50) + '...' : p.message}
              </span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '8px', flexShrink: 0 }}>{p.count}x</span>
            </div>
          ))}
        </div>
      )}

      {solutions.length > 0 && (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Recommended Solutions
          </div>
          {solutions.slice(0, 3).map((sol) => (
            <div key={sol.id} style={{
              ...cardStyle,
              borderLeft: `3px solid ${sol.confidence > 0.7 ? 'var(--cyan)' : 'var(--amber)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {sol.title}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {(sol.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {sol.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {!trendData && !solutions.length && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p style={{ fontSize: '14px', marginBottom: '4px' }}>No issues detected</p>
          <p style={{ fontSize: '12px' }}>The assistant will analyze errors as they occur</p>
        </div>
      )}
    </div>
  );
}

function SolutionsTab({
  solutions,
  feedbackLoading,
  onFeedback,
}: {
  solutions: RecommendedSolution[];
  feedbackLoading: string | null;
  onFeedback: (id: string, helpful: boolean) => Promise<void>;
}) {
  if (solutions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
        <Lightbulb size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
        <p style={{ fontSize: '14px' }}>No solutions yet</p>
        <p style={{ fontSize: '12px' }}>Solutions appear when errors are analyzed</p>
      </div>
    );
  }

  return (
    <div>
      {solutions.map((solution) => (
        <div key={solution.id} style={{
          ...cardStyle,
          borderLeft: `3px solid ${
            solution.source === 'ml' ? 'var(--cyan)' :
            solution.source === 'pattern' ? 'var(--green)' :
            solution.source === 'historical' ? 'var(--amber)' :
            'var(--text-muted)'
          }`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Wrench size={14} color="var(--cyan)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {solution.title}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {solution.description}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <span style={{
              fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-base)', color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}>
              {solution.source}
            </span>
            <span style={{
              fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-base)', color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}>
              {solution.effort} effort
            </span>
            <span style={{
              fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-base)', color: solution.confidence > 0.7 ? 'var(--green)' : 'var(--amber)',
              border: `1px solid ${solution.confidence > 0.7 ? 'var(--green)' : 'var(--amber)'}`,
            }}>
              {(solution.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>

          {solution.steps.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Steps:
              </div>
              {solution.steps.map((step, i) => (
                <div key={i} style={{
                  fontSize: '11px', color: 'var(--text-primary)',
                  padding: '3px 0', display: 'flex', alignItems: 'flex-start', gap: '4px',
                }}>
                  <span style={{ color: 'var(--cyan)', flexShrink: 0 }}>{i + 1}.</span>
                  {step}
                </div>
              ))}
            </div>
          )}

          {solution.relatedDocs.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Related Docs:
              </div>
              {solution.relatedDocs.map((doc, i) => (
                <a
                  key={i}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '11px', color: 'var(--cyan)', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '2px 0',
                  }}
                >
                  <BookOpen size={10} />
                  {doc.label}
                  <ExternalLink size={10} />
                </a>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: 'auto' }}>
              Was this helpful?
            </span>
            <button
              onClick={() => onFeedback(solution.id, true)}
              disabled={feedbackLoading === solution.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-base)', color: 'var(--green)', cursor: 'pointer',
                fontSize: '11px', transition: 'var(--transition)',
                opacity: feedbackLoading === solution.id ? 0.5 : 1,
              }}
            >
              <ThumbsUp size={12} /> Yes
            </button>
            <button
              onClick={() => onFeedback(solution.id, false)}
              disabled={feedbackLoading === solution.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-base)', color: 'var(--red)', cursor: 'pointer',
                fontSize: '11px', transition: 'var(--transition)',
                opacity: feedbackLoading === solution.id ? 0.5 : 1,
              }}
            >
              <ThumbsDown size={12} /> No
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function HelpTab({ suggestions }: { suggestions: HelpSuggestion[] }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery
    ? suggestions.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : suggestions;

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '8px 12px',
        marginBottom: '16px',
      }}>
        <Search size={14} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search help topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            border: 'none', background: 'transparent', color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)', fontSize: '13px', width: '100%',
            outline: 'none',
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <HelpCircle size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p style={{ fontSize: '14px' }}>No help suggestions</p>
          <p style={{ fontSize: '12px' }}>Contextual help appears based on your active tab</p>
        </div>
      ) : (
        filtered.map((suggestion) => (
          <div key={suggestion.id} style={{
            ...cardStyle,
            borderLeft: `3px solid ${
              suggestion.type === 'warning' ? 'var(--red)' :
              suggestion.type === 'action' ? 'var(--amber)' :
              suggestion.type === 'doc' ? 'var(--cyan)' :
              'var(--green)'
            }`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              {suggestion.type === 'warning' ? <AlertTriangle size={14} color="var(--red)" /> :
               suggestion.type === 'action' ? <Wrench size={14} color="var(--amber)" /> :
               suggestion.type === 'doc' ? <BookOpen size={14} color="var(--cyan)" /> :
               <Lightbulb size={14} color="var(--green)" />}
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {suggestion.title}
              </span>
              <span style={{
                marginLeft: 'auto', fontSize: '10px', padding: '1px 6px',
                borderRadius: 'var(--radius-sm)', background: 'var(--bg-base)',
                color: 'var(--text-muted)', border: '1px solid var(--border)',
              }}>
                {suggestion.type}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '6px' }}>
              {suggestion.description}
            </p>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-base)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>
                {suggestion.category}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                relevance: {Math.round(suggestion.relevance * 100)}%
              </span>
              {suggestion.url && (
                <a
                  href={suggestion.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Open <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function HistoryTab({ history }: { history: FixRecord[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
        {history.length} recent fixes recorded
      </div>

      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <History size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p style={{ fontSize: '14px' }}>No fix history yet</p>
          <p style={{ fontSize: '12px' }}>When solutions are marked helpful, they appear here</p>
        </div>
      ) : (
        history.map((record) => (
          <div key={record.id} style={cardStyle}>
            <div
              onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {record.wasHelpful === true ? (
                    <CheckCircle2 size={14} color="var(--green)" />
                  ) : record.wasHelpful === false ? (
                    <X size={14} color="var(--red)" />
                  ) : (
                    <FileText size={14} color="var(--text-muted)" />
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {record.errorMessage.length > 40 ? record.errorMessage.slice(0, 40) + '...' : record.errorMessage}
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {new Date(record.appliedAt).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10px', padding: '1px 6px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}>
                  {record.errorCategory}
                </span>
                <span style={{ fontSize: '10px', padding: '1px 6px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}>
                  {record.solutionSource}
                </span>
              </div>
            </div>

            {expandedId === record.id && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Solution: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{record.solution}</span>
                </div>
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Network: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{record.network}</span>
                </div>
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Context: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{record.context}</span>
                </div>
                {record.wasHelpful !== null && (
                  <div style={{ fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Outcome: </span>
                    <span style={{ color: record.wasHelpful ? 'var(--green)' : 'var(--red)' }}>
                      {record.wasHelpful ? 'Resolved' : 'Not helpful'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)',
      padding: '8px 10px', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', color, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
      padding: '12px', border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
        background: `${color}15`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {value}
        </div>
      </div>
    </div>
  );
}
