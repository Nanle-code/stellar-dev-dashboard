/**
 * DataStorytelling.tsx
 * Issue #608: Intelligent Data Storytelling dashboard tab.
 */

import React, { useCallback, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Target,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { TOOLTIP_STYLE, AXIS_TICK_STYLE } from '../../lib/chartUtils'
import {
  ACCURACY_TARGET,
  buildDataStory,
  FAST_GENERATION_MS,
  generateSyntheticVizSeries,
  sliceSeriesForChapter,
  storyEngagementScore,
  type DataStory,
  type StoryMetricKind,
} from '../../lib/dataStorytelling'

const METRICS: Array<{ id: StoryMetricKind; label: string }> = [
  { id: 'operations', label: 'Operations' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'fees', label: 'Fees' },
  { id: 'successRate', label: 'Success Rate' },
  { id: 'load', label: 'Network Load' },
]

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string
  value: string
  sub?: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function severityColor(sev: string): string {
  if (sev === 'critical' || sev === 'high') return '#ef4444'
  if (sev === 'medium') return '#eab308'
  if (sev === 'low') return 'var(--cyan, #06b6d4)'
  return 'var(--text-muted)'
}

function runStory(metric: StoryMetricKind): DataStory {
  const series = generateSyntheticVizSeries({ metric, points: 48, seed: 608 + METRICS.findIndex((m) => m.id === metric) })
  return buildDataStory({
    series,
    metric,
    metricLabel: METRICS.find((m) => m.id === metric)?.label,
    title: `Intelligent story · ${METRICS.find((m) => m.id === metric)?.label ?? metric}`,
  })
}

export default function DataStorytelling() {
  const [metric, setMetric] = useState<StoryMetricKind>('operations')
  const [story, setStory] = useState<DataStory>(() => runStory('operations'))
  const [chapterIdx, setChapterIdx] = useState(0)
  const [busy, setBusy] = useState(false)

  const activeChapter = story.chapters[chapterIdx] ?? story.chapters[0]
  const engagement = useMemo(() => storyEngagementScore(story), [story])

  const chartSeries = useMemo(() => {
    if (!activeChapter) return story.series
    const slice = sliceSeriesForChapter(story.series, activeChapter)
    return slice.length >= 3 ? slice : story.series
  }, [story, activeChapter])

  const chartData = useMemo(
    () =>
      chartSeries.map((p, i) => ({
        label: p.label,
        value: p.value,
        secondary: p.secondary ?? null,
        highlight: activeChapter?.highlightIndex === story.series.indexOf(p) || i === chartSeries.length - 1,
      })),
    [chartSeries, activeChapter, story.series]
  )

  const highlightPoint = useMemo(() => {
    if (!activeChapter) return null
    const globalIdx = activeChapter.highlightIndex
    const point = story.series[globalIdx]
    if (!point) return null
    const localIdx = chartSeries.findIndex((p) => p.timestamp === point.timestamp)
    if (localIdx < 0) return null
    return { index: localIdx, value: point.value, label: point.label }
  }, [activeChapter, story.series, chartSeries])

  const refresh = useCallback(() => {
    setBusy(true)
    window.setTimeout(() => {
      const next = runStory(metric)
      setStory(next)
      setChapterIdx(0)
      setBusy(false)
    }, 350)
  }, [metric])

  const changeMetric = useCallback((next: StoryMetricKind) => {
    setMetric(next)
    setBusy(true)
    window.setTimeout(() => {
      const nextStory = runStory(next)
      setStory(nextStory)
      setChapterIdx(0)
      setBusy(false)
    }, 250)
  }, [])

  const goPrev = () => setChapterIdx((i) => Math.max(0, i - 1))
  const goNext = () => setChapterIdx((i) => Math.min(story.chapters.length - 1, i + 1))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <BookOpen size={22} color="var(--cyan, #06b6d4)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, margin: 0 }}>
              Data Storytelling
            </h1>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              #608
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', maxWidth: '680px', lineHeight: 1.5 }}>
            AI-style narratives from your visualization data — statistical insight detection, template NLG, and an
            interactive chapter-by-chapter storytelling experience integrated with chart series.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--cyan, #06b6d4)',
            background: 'rgba(6,182,212,0.12)',
            color: 'var(--cyan, #06b6d4)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          <RefreshCw size={14} />
          {busy ? 'Generating…' : 'Regenerate Story'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => changeMetric(m.id)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${metric === m.id ? 'var(--cyan, #06b6d4)' : 'var(--border)'}`,
              background: metric === m.id ? 'rgba(6,182,212,0.12)' : 'var(--bg-elevated)',
              color: metric === m.id ? 'var(--cyan, #06b6d4)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <StatCard
          label="Insights"
          value={String(story.insightCount)}
          sub={`${story.relevantInsightCount} highly relevant`}
          color="var(--cyan, #06b6d4)"
          icon={<Sparkles size={16} />}
        />
        <StatCard
          label="Narrative Accuracy"
          value={`${(story.accuracyScore * 100).toFixed(0)}%`}
          sub={story.meetsAccuracyTarget ? `Meets ≥${ACCURACY_TARGET * 100}% target` : `Below ${ACCURACY_TARGET * 100}% target`}
          color={story.meetsAccuracyTarget ? '#22c55e' : '#eab308'}
          icon={story.meetsAccuracyTarget ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        />
        <StatCard
          label="Generation Time"
          value={`${story.generationMs}ms`}
          sub={story.generationMs <= FAST_GENERATION_MS ? 'Fast generation' : 'Within budget'}
          color="#22c55e"
          icon={<Zap size={16} />}
        />
        <StatCard
          label="Engagement"
          value={`${(engagement * 100).toFixed(0)}%`}
          sub={`${story.chapters.length} interactive chapters`}
          color="var(--amber, #eab308)"
          icon={<Target size={16} />}
        />
        <StatCard
          label="Data Quality"
          value={story.dataQuality.toUpperCase()}
          sub={`${story.series.length} points`}
          color="var(--text-primary)"
          icon={<Clock size={16} />}
        />
      </div>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Story summary</div>
        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>{story.title}</div>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{story.summary}</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1fr) minmax(300px, 1.1fr)',
          gap: '14px',
        }}
      >
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: '13px' }}>
              Chapter {activeChapter?.order ?? 0} / {story.chapters.length}
            </strong>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={goPrev}
                disabled={chapterIdx === 0}
                aria-label="Previous chapter"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  borderRadius: '6px',
                  padding: '6px',
                  cursor: chapterIdx === 0 ? 'not-allowed' : 'pointer',
                  opacity: chapterIdx === 0 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={chapterIdx >= story.chapters.length - 1}
                aria-label="Next chapter"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  borderRadius: '6px',
                  padding: '6px',
                  cursor: chapterIdx >= story.chapters.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: chapterIdx >= story.chapters.length - 1 ? 0.4 : 1,
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {activeChapter && (
            <>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{activeChapter.headline}</h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {activeChapter.body}
              </p>
              {activeChapter.callToAction && (
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--cyan, #06b6d4)',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '10px',
                  }}
                >
                  → {activeChapter.callToAction}
                </div>
              )}
            </>
          )}

          <div style={{ display: 'grid', gap: '8px', marginTop: '4px' }}>
            {story.chapters.map((ch, idx) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChapterIdx(idx)}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${idx === chapterIdx ? 'var(--cyan, #06b6d4)' : 'var(--border)'}`,
                  background: idx === chapterIdx ? 'rgba(6,182,212,0.1)' : 'transparent',
                  color: idx === chapterIdx ? 'var(--cyan, #06b6d4)' : 'var(--text-secondary)',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                {ch.order}. {ch.headline}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Linked visualization · chapter window
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="storyValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={AXIS_TICK_STYLE} interval="preserveStartEnd" />
                <YAxis tick={AXIS_TICK_STYLE} width={48} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="value" stroke="#06b6d4" fill="url(#storyValue)" strokeWidth={2} />
                {highlightPoint && (
                  <ReferenceDot
                    x={highlightPoint.label}
                    y={highlightPoint.value}
                    r={5}
                    fill="#eab308"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Sparkles size={14} color="var(--cyan, #06b6d4)" />
          <strong style={{ fontSize: '13px' }}>Detected insights</strong>
        </div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {story.insights.map((insight) => (
            <div
              key={insight.id}
              style={{
                borderLeft: `3px solid ${severityColor(insight.severity)}`,
                paddingLeft: '12px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>{insight.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {insight.narrative}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {insight.type} · {(insight.confidence * 100).toFixed(0)}% confidence · {insight.severity}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
