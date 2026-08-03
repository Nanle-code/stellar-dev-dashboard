import React, { useEffect, useState, useCallback } from 'react'
import {
  loadPersonalizationProfile,
  savePersonalizationProfile,
  computeWidgetRecommendations,
  computePersonalizationStats,
  recordInteraction,
  recordSuggestionAccepted,
  recordSuggestionDismissed,
  resetPersonalization,
  identifyPeakUsageHours,
  detectPowerUser,
  detectCasualUser,
  computeLayoutCompactnessScore,
  type PersonalizationProfile,
  type PersonalizationStats,
  type WidgetScore,
} from '../../lib/personalizationEngine'
import { useStore } from '../../lib/store'
import { addBreadcrumb } from '../../lib/errorReporting'

const AVAILABLE_WIDGET_TYPES = ['balance', 'assets', 'transactions', 'networkStats', 'accountStats', 'quickActions', 'priceTicker', 'ledgerStats']

const WIDGET_LABELS: Record<string, string> = {
  balance: 'XLM Balance',
  assets: 'Asset Holdings',
  transactions: 'Recent Transactions',
  networkStats: 'Network Stats',
  accountStats: 'Account Stats',
  quickActions: 'Quick Actions',
  priceTicker: 'Price Ticker',
  ledgerStats: 'Ledger Statistics',
}

const WIDGET_ICONS: Record<string, string> = {
  balance: '💰',
  assets: '💎',
  transactions: '⇄',
  networkStats: '🌐',
  accountStats: '👤',
  quickActions: '⚡',
  priceTicker: '💹',
  ledgerStats: '📡',
}

export default function PersonalizationPanel() {
  const [profile, setProfile] = useState<PersonalizationProfile | null>(null)
  const [stats, setStats] = useState<PersonalizationStats | null>(null)
  const [recommendations, setRecommendations] = useState<WidgetScore[]>([])
  const [activeTab, setActiveTab] = useState<'insights' | 'recommendations' | 'settings'>('insights')
  const [loading, setLoading] = useState(true)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const { activeTab: storeActiveTab } = useStore()

  useEffect(() => {
    addBreadcrumb('Personalization panel opened', 'navigation')
  }, [])

  useEffect(() => {
    loadPersonalizationProfile().then((p) => {
      setProfile(p)
      setStats(computePersonalizationStats(p))
      const recs = computeWidgetRecommendations(p, AVAILABLE_WIDGET_TYPES, [])
      setRecommendations(recs)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (profile && stats) {
      const recs = computeWidgetRecommendations(profile, AVAILABLE_WIDGET_TYPES, [])
      setRecommendations(recs)
    }
  }, [profile, stats])

  const handleRecordInteraction = useCallback(async (type: string, target: string, metadata?: Record<string, unknown>) => {
    if (!profile) return
    const updated = await recordInteraction(profile, { type, target, metadata } as any)
    setProfile(updated)
  }, [profile])

  useEffect(() => {
    if (profile && storeActiveTab) {
      handleRecordInteraction('tab_visit', storeActiveTab)
    }
  }, [storeActiveTab, profile, handleRecordInteraction])

  const handleAcceptSuggestion = useCallback(async (widgetType: string) => {
    if (!profile) return
    const updated = await recordSuggestionAccepted(profile, widgetType)
    setProfile(updated)
    setStats(computePersonalizationStats(updated))
    setSavedMessage(`Added "${WIDGET_LABELS[widgetType] || widgetType}" to your layout`)
    setTimeout(() => setSavedMessage(null), 3000)
  }, [profile])

  const handleDismissSuggestion = useCallback(async (widgetType: string) => {
    if (!profile) return
    const updated = await recordSuggestionDismissed(profile, widgetType)
    setProfile(updated)
    setStats(computePersonalizationStats(updated))
    setSavedMessage(`"${WIDGET_LABELS[widgetType] || widgetType}" dismissed`)
    setTimeout(() => setSavedMessage(null), 3000)
  }, [profile])

  const handleToggleLearning = useCallback(async () => {
    if (!profile) return
    const updated = { ...profile, learningEnabled: !profile.learningEnabled }
    await savePersonalizationProfile(updated)
    setProfile(updated)
    setStats(computePersonalizationStats(updated))
  }, [profile])

  const handleSetTransparency = useCallback(async (level: 'full' | 'summary' | 'minimal') => {
    if (!profile) return
    const updated = { ...profile, transparencyLevel: level }
    await savePersonalizationProfile(updated)
    setProfile(updated)
  }, [profile])

  const handleReset = useCallback(async () => {
    const fresh = await resetPersonalization()
    setProfile(fresh)
    setStats(computePersonalizationStats(fresh))
    setResetConfirm(false)
    setSavedMessage('Personalization data has been reset')
    setTimeout(() => setSavedMessage(null), 3000)
  }, [])

  const peakHours = profile ? identifyPeakUsageHours(profile) : []
  const isPowerUser = profile ? detectPowerUser(profile) : false
  const isCasualUser = profile ? detectCasualUser(profile) : false
  const compactness = profile ? computeLayoutCompactnessScore(profile) : 0.5

  const containerStyle: React.CSSProperties = {
    padding: '24px',
    maxWidth: '900px',
    margin: '0 auto',
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    marginBottom: '16px',
  }

  const badgeStyle = (color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
    background: `${color}20`,
    color,
    border: `1px solid ${color}40`,
  })

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${isActive ? 'var(--cyan)' : 'var(--border)'}`,
    background: isActive ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
    color: isActive ? 'var(--cyan)' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 400,
    transition: 'var(--transition)',
  })

  const buttonStyle: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'var(--transition)',
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>🧠</div>
          <div>Analyzing your dashboard behavior...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>
          AI Dashboard Personalization
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
          Your dashboard learns from your behavior to optimize layout, recommend widgets, and improve your workflow.
        </p>
      </div>

      {savedMessage && (
        <div style={{
          ...cardStyle,
          background: 'var(--green-glow)',
          borderColor: 'var(--green)',
          color: 'var(--green)',
          padding: '12px 20px',
          marginBottom: '16px',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          {savedMessage}
        </div>
      )}

      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}>
          {[
            { label: 'Efficiency Gain', value: `${stats.estimatedEfficiencyGain}%`, icon: '📈', color: 'var(--green)' },
            { label: 'Interactions', value: stats.totalInteractions.toString(), icon: '🖱️', color: 'var(--cyan)' },
            { label: 'Tabs Visited', value: stats.uniqueTabsVisited.toString(), icon: '📑', color: 'var(--amber)' },
            { label: 'Widgets Used', value: stats.uniqueWidgetsUsed.toString(), icon: '🧩', color: 'var(--text-secondary)' },
            { label: 'Suggestions Taken', value: stats.suggestionsAccepted.toString(), icon: '✅', color: 'var(--green)' },
            { label: 'Learning', value: profile?.learningEnabled ? 'Active' : 'Paused', icon: profile?.learningEnabled ? '🧠' : '⏸️', color: profile?.learningEnabled ? 'var(--green)' : 'var(--text-muted)' },
          ].map((stat) => (
            <div key={stat.label} style={{
              ...cardStyle,
              marginBottom: 0,
              textAlign: 'center',
              padding: '16px 12px',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{stat.icon}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: stat.color, marginBottom: '4px' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button style={tabStyle(activeTab === 'insights')} onClick={() => setActiveTab('insights')}>
          Insights
        </button>
        <button style={tabStyle(activeTab === 'recommendations')} onClick={() => setActiveTab('recommendations')}>
          Recommendations
        </button>
        <button style={tabStyle(activeTab === 'settings')} onClick={() => setActiveTab('settings')}>
          Settings
        </button>
      </div>

      {activeTab === 'insights' && profile && (
        <div>
          <div style={cardStyle}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Your Usage Profile
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {isPowerUser && <span style={badgeStyle('var(--amber)')}>⚡ Power User</span>}
              {isCasualUser && <span style={badgeStyle('var(--cyan)')}>🌱 Getting Started</span>}
              {compactness > 0.6 && <span style={badgeStyle('var(--green)')}>📊 Dense Layout Preferred</span>}
              {compactness < 0.4 && <span style={badgeStyle('var(--text-secondary)')}>✨ Spacious Layout Preferred</span>}
              <span style={badgeStyle('var(--cyan)')}>
                🕐 Peak: {peakHours.map(h => `${h}:00`).join(', ')}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Most Visited Tabs
                </h4>
                {stats?.topTabs.slice(0, 5).map((tab) => (
                  <div key={tab.tab} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{tab.tab}</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{tab.count}x</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Most Used Widgets
                </h4>
                {stats?.topWidgets.slice(0, 5).map((widget) => (
                  <div key={widget.widget} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{WIDGET_LABELS[widget.widget] || widget.widget}</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{widget.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {profile.transparencyLevel !== 'minimal' && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                How Personalization Works
              </h3>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <p style={{ margin: '0 0 12px' }}>
                  The AI personalization engine analyzes your interaction patterns — which tabs you visit,
                  which widgets you use, and how you arrange your dashboard.
                </p>
                <ul style={{ margin: '0 0 8px', paddingLeft: '20px' }}>
                  <li>Tab visits and widget usage are tracked to identify preferences</li>
                  <li>Widget recommendations are ranked by relevance to your workflow</li>
                  <li>Layout optimization places frequently used widgets front and center</li>
                  <li>Dismissed suggestions teach the system what you don&apos;t need</li>
                  <li>All data stays on your device — nothing is sent to external servers</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div>
          <div style={cardStyle}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Recommended Widgets
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Based on your usage patterns and preferences
            </p>

            {recommendations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
                <div style={{ fontSize: '14px' }}>
                  No recommendations yet. Continue using your dashboard and check back for personalized suggestions.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recommendations.map((rec) => {
                  return (
                    <div
                      key={rec.widgetType}
                      style={{
                        ...cardStyle,
                        marginBottom: 0,
                        padding: '16px',
                        borderColor: rec.score > 70 ? 'var(--cyan-dim)' : 'var(--border)',
                        background: rec.score > 70 ? 'var(--cyan-glow-sm)' : 'var(--bg-card)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '28px' }}>{WIDGET_ICONS[rec.widgetType] || '📦'}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {WIDGET_LABELS[rec.widgetType] || rec.widgetType}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {rec.reason}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '60px' }}>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 700,
                            color: rec.score > 70 ? 'var(--green)' : rec.score > 40 ? 'var(--amber)' : 'var(--text-secondary)',
                          }}>
                            {Math.round(rec.score)}%
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Match
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleAcceptSuggestion(rec.widgetType)}
                            style={{
                              ...buttonStyle,
                              background: 'var(--green-glow)',
                              borderColor: 'var(--green)',
                              color: 'var(--green)',
                            }}
                            title="Add this widget"
                          >
                            + Add
                          </button>
                          <button
                            onClick={() => handleDismissSuggestion(rec.widgetType)}
                            style={{
                              ...buttonStyle,
                              background: 'transparent',
                              color: 'var(--text-muted)',
                            }}
                            title="Dismiss suggestion"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Layout Optimization
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Suggestions to improve your dashboard layout based on your workflow
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats && stats.topTabs.length > 0 && (
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Consider grouping related widgets</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Your most visited tab is <strong>{stats.topTabs[0].tab}</strong>. Place related widgets nearby for faster access.
                  </div>
                </div>
              )}
              {isPowerUser && (
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Try compact layout</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    As a power user, switching to compact mode could save you{' '}
                    <strong>~{Math.round(compactness * 100)}%</strong> screen space.
                  </div>
                </div>
              )}
              {isCasualUser && (
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Start with essential widgets</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Begin with Balance and Network Stats widgets to monitor your account at a glance.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && profile && (
        <div>
          <div style={cardStyle}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Personalization Controls
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Learning Mode</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    When enabled, the system learns from your behavior to personalize the dashboard
                  </div>
                </div>
                <button
                  onClick={handleToggleLearning}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '999px',
                    background: profile.learningEnabled ? 'var(--green-glow)' : 'var(--bg-elevated)',
                    color: profile.learningEnabled ? 'var(--green)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: `1px solid ${profile.learningEnabled ? 'var(--green)' : 'var(--border)'}`,
                  }}
                >
                  {profile.learningEnabled ? 'Active' : 'Paused'}
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>Transparency Level</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['full', 'summary', 'minimal'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => handleSetTransparency(level)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${profile.transparencyLevel === level ? 'var(--cyan)' : 'var(--border)'}`,
                        background: profile.transparencyLevel === level ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                        color: profile.transparencyLevel === level ? 'var(--cyan)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: profile.transparencyLevel === level ? 600 : 400,
                        textTransform: 'capitalize',
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {profile.transparencyLevel === 'full' && 'Shows detailed insights about how personalization works'}
                  {profile.transparencyLevel === 'summary' && 'Shows only key metrics and recommendations'}
                  {profile.transparencyLevel === 'minimal' && 'Hides explanations, shows only controls'}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Reset Personalization</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Clear all learned data and start fresh
                    </div>
                  </div>
                  {!resetConfirm ? (
                    <button
                      onClick={() => setResetConfirm(true)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--red)',
                        background: 'transparent',
                        color: 'var(--red)',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Reset
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Are you sure?</span>
                      <button
                        onClick={handleReset}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: 'none',
                          background: 'var(--red)',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Yes, Reset
                      </button>
                      <button
                        onClick={() => setResetConfirm(false)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>Data Privacy</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  All personalization data is stored locally in your browser using IndexedDB.
                  No usage data, preferences, or behavioral information is sent to external servers.
                  You can reset or delete this data at any time using the controls above.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


