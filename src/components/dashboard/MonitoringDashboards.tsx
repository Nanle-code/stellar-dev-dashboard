import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getAllMetrics, getMetricStats, detectAnomalies, subscribeMetrics,
  type MetricSeries, type AnomalyResult,
} from '../../utils/metricsCollector'
import {
  getAllTemplates, saveTemplate, deleteTemplate, exportTemplate, importTemplate,
  type DashboardTemplate,
} from '../../lib/alertChannels'
import { useMonitoring } from '../../hooks/useMonitoring'
import { computeHealthScore } from '../../utils/monitoring'

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: accent ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

function MiniSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const w = 120; const h = 32
  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline fill="none" stroke="var(--cyan)" strokeWidth="1.5" points={pts.join(' ')} />
    </svg>
  )
}

function MetricRow({ series }: { series: MetricSeries }) {
  const stats = getMetricStats(series.name)
  const recent = series.points.slice(-30).map(p => p.value)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{series.name}</div>
        {series.description && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{series.description}</div>}
      </div>
      <MiniSparkline points={recent} />
      <div style={{ minWidth: '140px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginLeft: '12px', textAlign: 'center', fontSize: '11px' }}>
        {stats ? (
          <>
            <div><div style={{ color: 'var(--text-muted)' }}>avg</div><div style={{ fontWeight: 600 }}>{stats.mean.toFixed(1)}</div></div>
            <div><div style={{ color: 'var(--text-muted)' }}>p95</div><div style={{ fontWeight: 600 }}>{stats.p95.toFixed(1)}</div></div>
            <div><div style={{ color: 'var(--text-muted)' }}>count</div><div style={{ fontWeight: 600 }}>{stats.count}</div></div>
          </>
        ) : <div style={{ color: 'var(--text-muted)', gridColumn: '1/-1' }}>no data</div>}
      </div>
    </div>
  )
}

function AnomalyCard({ anomaly }: { anomaly: AnomalyResult }) {
  return (
    <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>{anomaly.metric}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>z={anomaly.zScore.toFixed(2)}</span>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
        Value: <strong>{anomaly.value.toFixed(2)}</strong> · Mean: {anomaly.mean.toFixed(2)} ± {anomaly.stdDev.toFixed(2)}
      </div>
    </div>
  )
}

function TemplateCard({ template, onLoad, onDelete, onExport }: {
  template: DashboardTemplate
  onLoad: (t: DashboardTemplate) => void
  onDelete: (id: string) => void
  onExport: (t: DashboardTemplate) => void
}) {
  const isBuiltIn = !template.id.startsWith('imported-') && !template.id.startsWith('custom-')
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>{template.name}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{template.description}</div>
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{template.widgets.length} widgets</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={() => onLoad(template)} style={{ flex: 1, padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-dim)', background: 'var(--cyan-glow)', color: 'var(--cyan)', fontSize: '11px', cursor: 'pointer' }}>Load</button>
        <button onClick={() => onExport(template)} style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }}>Export</button>
        {!isBuiltIn && <button onClick={() => onDelete(template.id)} style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--red-dim)', background: 'var(--red-glow)', color: 'var(--red)', fontSize: '11px', cursor: 'pointer' }}>Delete</button>}
      </div>
    </div>
  )
}

export default function MonitoringDashboards() {
  const { snapshot, score, alerts } = useMonitoring() as { snapshot: Record<string, unknown>; score: number; alerts: unknown[] }
  const [metrics, setMetrics] = useState<MetricSeries[]>(getAllMetrics())
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([])
  const [templates, setTemplates] = useState<DashboardTemplate[]>(getAllTemplates())
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'anomalies' | 'templates'>('overview')
  const [metricFilter, setMetricFilter] = useState('')

  const refresh = useCallback(() => {
    setMetrics(getAllMetrics())
    setAnomalies(detectAnomalies())
  }, [])

  useEffect(() => {
    const unsub = subscribeMetrics(() => refresh())
    const id = setInterval(refresh, 5000)
    return () => { unsub(); clearInterval(id) }
  }, [refresh])

  const filteredMetrics = useMemo(() =>
    metricFilter
      ? metrics.filter(m => m.name.toLowerCase().includes(metricFilter.toLowerCase()))
      : metrics,
    [metrics, metricFilter]
  )

  const handleLoadTemplate = (t: DashboardTemplate) => {
    alert(`Template "${t.name}" loaded! Widgets: ${t.widgets.map(w => w.title).join(', ')}`)
  }

  const handleExportTemplate = (t: DashboardTemplate) => {
    const json = exportTemplate(t)
    const a = document.createElement('a')
    a.href = `data:application/json,${encodeURIComponent(json)}`
    a.download = `dashboard-${t.id}.json`
    a.click()
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = e => {
        try {
          importTemplate(String(e.target?.result))
          setTemplates(getAllTemplates())
        } catch (err) {
          alert(`Import failed: ${err instanceof Error ? err.message : 'Invalid format'}`)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Monitoring Dashboards</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Custom metrics, anomaly detection, alerting, and dashboard templates</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {anomalies.length > 0 && (
            <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.1)', border: '1px solid var(--amber)', color: 'var(--amber)' }}>
              ⚠ {anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'}
            </span>
          )}
          {alerts.length > 0 && (
            <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', color: 'var(--red)' }}>
              🔴 {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'metrics', label: `Metrics (${metrics.length})` },
          { id: 'anomalies', label: `Anomalies${anomalies.length ? ` (${anomalies.length})` : ''}` },
          { id: 'templates', label: 'Templates' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)} style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--cyan)' : '2px solid transparent', color: activeTab === tab.id ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <StatBox label="Health Score" value={`${score}/100`} accent={score < 60 ? 'var(--red)' : score < 80 ? 'var(--amber)' : 'var(--green)'} />
            <StatBox label="Active Metrics" value={metrics.length} />
            <StatBox label="Anomalies" value={anomalies.length} accent={anomalies.length > 0 ? 'var(--amber)' : undefined} />
            <StatBox label="Active Alerts" value={alerts.length} accent={alerts.length > 0 ? 'var(--red)' : undefined} />
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>Business Metrics Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {['business.tx.total', 'business.tx.success', 'business.tx.failure'].map(name => {
                const m = metrics.find(s => s.name === name)
                const latest = m?.points[m.points.length - 1]?.value ?? 0
                return <StatBox key={name} label={name.split('.').pop()!.replace('_', ' ')} value={latest} accent={name.includes('failure') && latest > 0 ? 'var(--red)' : undefined} />
              })}
            </div>
          </div>
          {anomalies.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>Recent Anomalies</div>
              {anomalies.slice(0, 3).map((a, i) => <AnomalyCard key={i} anomaly={a} />)}
            </div>
          )}
        </div>
      )}

      {activeTab === 'metrics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input value={metricFilter} onChange={e => setMetricFilter(e.target.value)} placeholder="Filter metrics…" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px' }} />
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border)', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 700 }}>
              <span>Metric</span><span style={{ textAlign: 'center' }}>Trend</span><span style={{ textAlign: 'center' }}>Avg / P95 / Count</span>
            </div>
            {filteredMetrics.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No metrics recorded yet</div>}
            {filteredMetrics.map(s => <MetricRow key={s.name} series={s} />)}
          </div>
        </div>
      )}

      {activeTab === 'anomalies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {anomalies.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              ✓ No anomalies detected. System is operating normally.
            </div>
          ) : anomalies.map((a, i) => <AnomalyCard key={i} anomaly={a} />)}
        </div>
      )}

      {activeTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleImport} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-dim)', background: 'var(--cyan-glow)', color: 'var(--cyan)', fontSize: '12px', cursor: 'pointer' }}>Import Template</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {templates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                onLoad={handleLoadTemplate}
                onDelete={id => { deleteTemplate(id); setTemplates(getAllTemplates()) }}
                onExport={handleExportTemplate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
