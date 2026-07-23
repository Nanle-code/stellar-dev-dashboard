/**
 * DependencyManagement.tsx
 * Issue #602: Intelligent Dependency Management dashboard.
 */

import React, { useMemo, useState, useCallback } from 'react'
import {
  Package,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  GitBranch,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  analyzeDependencies,
  type DependencyAnalysisResult,
  type DependencyPackage,
  type Severity,
  type UpdateRecommendation,
  type VersionConflict,
} from '../../lib/dependencyManagement'
import {
  SAMPLE_AUDIT,
  SAMPLE_LOCK_PACKAGES,
  SAMPLE_MANIFEST,
  SAMPLE_REGISTRY,
} from '../../data/dependencySample'

type ViewFilter = 'all' | 'vulnerable' | 'outdated' | 'conflicts'

function severityColor(s: Severity): string {
  if (s === 'critical') return 'var(--red, #ef4444)'
  if (s === 'high') return '#f97316'
  if (s === 'medium') return 'var(--amber, #eab308)'
  if (s === 'low') return 'var(--cyan, #06b6d4)'
  return 'var(--text-muted)'
}

function severityBg(s: Severity): string {
  if (s === 'critical') return 'rgba(239,68,68,0.1)'
  if (s === 'high') return 'rgba(249,115,22,0.1)'
  if (s === 'medium') return 'rgba(234,179,8,0.1)'
  if (s === 'low') return 'rgba(6,182,212,0.1)'
  return 'var(--bg-elevated)'
}

function Badge({ label, variant }: { label: string; variant: Severity | 'pass' | 'safe' | 'breaking' }) {
  const color =
    variant === 'pass' || variant === 'safe'
      ? '#22c55e'
      : variant === 'breaking'
        ? 'var(--red, #ef4444)'
        : severityColor(variant as Severity)
  const bg =
    variant === 'pass' || variant === 'safe'
      ? 'rgba(34,197,94,0.1)'
      : variant === 'breaking'
        ? 'rgba(239,68,68,0.1)'
        : severityBg(variant as Severity)
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        background: bg,
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {label}
    </span>
  )
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: string | number
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  )
}

function ScoreRing({ score, status }: { score: number; status: string }) {
  const r = 34
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c
  const color = status === 'good' ? '#22c55e' : status === 'warning' ? '#eab308' : '#ef4444'
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text
        x="44"
        y="50"
        textAnchor="middle"
        fill={color}
        fontSize="18"
        fontWeight="700"
        style={{ transform: 'rotate(90deg)', transformOrigin: '44px 44px', fontFamily: 'var(--font-mono)' }}
      >
        {score}
      </text>
    </svg>
  )
}

function RecommendationCard({ rec }: { rec: UpdateRecommendation }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        background: rec.safe ? 'rgba(34,197,94,0.06)' : 'rgba(249,115,22,0.06)',
        border: `1px solid ${rec.safe ? 'rgba(34,197,94,0.3)' : 'rgba(249,115,22,0.3)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          width: '100%',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '10px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <strong style={{ fontSize: '13px' }}>{rec.package}</strong>
            <Badge label={rec.safe ? 'safe' : rec.risk} variant={rec.safe ? 'safe' : rec.breakingChangeLikely ? 'breaking' : 'medium'} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {rec.fromVersion} → {rec.toVersion}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{rec.reason}</p>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <ol style={{ margin: '10px 0 0', paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {rec.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
          <li style={{ color: 'var(--text-muted)' }}>Confidence: {Math.round(rec.confidence * 100)}% · Risk score: {rec.riskScore}/100</li>
        </ol>
      )}
    </div>
  )
}

function ConflictCard({ conflict }: { conflict: VersionConflict }) {
  return (
    <div
      style={{
        background: severityBg(conflict.severity),
        border: `1px solid ${severityColor(conflict.severity)}44`,
        borderLeft: `3px solid ${severityColor(conflict.severity)}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <GitBranch size={14} color={severityColor(conflict.severity)} />
        <strong style={{ fontSize: '13px' }}>{conflict.package}</strong>
        <Badge label={conflict.severity} variant={conflict.severity} />
      </div>
      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '6px' }}>
        Installed: {conflict.installedVersions.join(', ')}
      </div>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{conflict.resolution}</p>
      {conflict.conflictingRanges.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {conflict.conflictingRanges.map((r) => (
            <span
              key={`${r.parent}-${r.range}`}
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              {r.parent}: {r.range}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function PackageRow({ pkg }: { pkg: DependencyPackage }) {
  const statusVariant: Severity | 'pass' =
    pkg.vulnerabilities.length > 0 ? 'critical' : pkg.outdated ? 'medium' : 'pass'
  const statusLabel =
    pkg.vulnerabilities.length > 0 ? 'Vulnerable' : pkg.outdated ? 'Outdated' : 'OK'

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '10px 14px', fontWeight: 600 }}>
        {pkg.name}
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>{pkg.kind}</div>
      </td>
      <td style={{ padding: '10px 14px', color: pkg.outdated ? '#eab308' : 'var(--text-secondary)' }}>{pkg.version}</td>
      <td style={{ padding: '10px 14px', color: '#22c55e' }}>{pkg.latestVersion}</td>
      <td style={{ padding: '10px 14px' }}>
        {pkg.vulnerabilities.length > 0 ? (
          <Badge label={`${pkg.vulnerabilities.length} vuln`} variant="high" />
        ) : (
          <span style={{ color: '#22c55e' }}>✓</span>
        )}
      </td>
      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{pkg.license}</td>
      <td style={{ padding: '10px 14px' }}>
        <Badge label={statusLabel} variant={statusVariant} />
      </td>
    </tr>
  )
}

function runSampleAnalysis(): DependencyAnalysisResult {
  return analyzeDependencies({
    manifest: SAMPLE_MANIFEST,
    lockPackages: SAMPLE_LOCK_PACKAGES,
    audit: SAMPLE_AUDIT,
    registry: SAMPLE_REGISTRY,
  })
}

export default function DependencyManagement() {
  const [result, setResult] = useState<DependencyAnalysisResult>(() => runSampleAnalysis())
  const [analyzing, setAnalyzing] = useState(false)
  const [filter, setFilter] = useState<ViewFilter>('all')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'packages' | 'recommendations' | 'conflicts' | 'insights'>('packages')

  const reanalyze = useCallback(() => {
    setAnalyzing(true)
    // Simulate async analysis pipeline (CI audit + local heuristics)
    window.setTimeout(() => {
      setResult(runSampleAnalysis())
      setAnalyzing(false)
    }, 700)
  }, [])

  const filteredPackages = useMemo(() => {
    return result.packages.filter((p) => {
      if (filter === 'vulnerable' && p.vulnerabilities.length === 0) return false
      if (filter === 'outdated' && !p.outdated) return false
      if (filter === 'conflicts') {
        const conflictNames = new Set(result.conflicts.map((c) => c.package))
        if (!conflictNames.has(p.name)) return false
      }
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [result, filter, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Sparkles size={22} color="var(--cyan, #06b6d4)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, margin: 0 }}>
              Intelligent Dependency Management
            </h1>
            <Badge label="#602" variant="info" />
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', maxWidth: '640px', lineHeight: 1.5 }}>
            Analyzes the dependency tree for vulnerabilities, safe updates, version conflicts, and overall health —
            with risk-aware recommendations.
          </p>
        </div>
        <button
          type="button"
          onClick={reanalyze}
          disabled={analyzing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--cyan, #06b6d4)',
            background: analyzing ? 'var(--bg-elevated)' : 'rgba(6,182,212,0.12)',
            color: 'var(--cyan, #06b6d4)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: analyzing ? 'wait' : 'pointer',
          }}
        >
          <RefreshCw size={14} style={{ animation: analyzing ? 'spin 1s linear infinite' : 'none' }} />
          {analyzing ? 'Analyzing…' : 'Re-run Analysis'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        <StatCard label="Packages" value={result.packageCount} color="var(--cyan, #06b6d4)" icon={<Package size={16} />} />
        <StatCard
          label="Vulnerable"
          value={result.vulnerableCount}
          color={result.vulnerableCount ? '#ef4444' : '#22c55e'}
          icon={<ShieldAlert size={16} />}
        />
        <StatCard
          label="Outdated"
          value={result.outdatedCount}
          color={result.outdatedCount ? '#eab308' : '#22c55e'}
          icon={<AlertTriangle size={16} />}
        />
        <StatCard
          label="Conflicts"
          value={result.conflictCount}
          color={result.conflictCount ? '#f97316' : '#22c55e'}
          icon={<GitBranch size={16} />}
        />
        <StatCard
          label="Detection"
          value={`${Math.round(result.detectionRate * 100)}%`}
          color={result.detectionRate >= 0.9 ? '#22c55e' : '#eab308'}
          icon={<CheckCircle2 size={16} />}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <ScoreRing score={result.health.overall} status={result.health.status} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>Health Score</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{result.health.status}</div>
          </div>
          <div style={{ width: '100%', display: 'grid', gap: '6px', marginTop: '4px' }}>
            {[
              ['Vulns', result.health.vulnerabilityScore],
              ['Freshness', result.health.freshnessScore],
              ['Conflicts', result.health.conflictScore],
              ['License', result.health.licenseScore],
            ].map(([label, score]) => (
              <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{score}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Info size={14} color="var(--cyan, #06b6d4)" />
            <strong style={{ fontSize: '13px' }}>AI Insights</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '8px' }}>
            {result.insights.map((insight) => (
              <li key={insight} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {insight}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {result.health.tips.map((tip) => (
              <span
                key={tip}
                style={{
                  fontSize: '10px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                {tip}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 0,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        {(
          [
            ['packages', 'Packages'],
            ['recommendations', 'Updates'],
            ['conflicts', 'Conflicts'],
            ['insights', 'Vuln Details'],
          ] as const
        ).map(([id, label], idx, arr) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              cursor: 'pointer',
              background: tab === id ? 'rgba(6,182,212,0.12)' : 'transparent',
              borderRight: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
              borderBottom: tab === id ? '2px solid var(--cyan, #06b6d4)' : '2px solid transparent',
              color: tab === id ? 'var(--cyan, #06b6d4)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'packages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search
                size={12}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter packages…"
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 30px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {(['all', 'vulnerable', 'outdated', 'conflicts'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  background: filter === f ? 'rgba(6,182,212,0.15)' : 'var(--bg-elevated)',
                  border: `1px solid ${filter === f ? 'var(--cyan, #06b6d4)' : 'var(--border)'}`,
                  color: filter === f ? 'var(--cyan, #06b6d4)' : 'var(--text-secondary)',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-canvas)', borderBottom: '1px solid var(--border)' }}>
                    {['Package', 'Current', 'Latest', 'Vulns', 'License', 'Status'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          fontSize: '10px',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPackages.map((pkg) => (
                    <PackageRow key={`${pkg.name}-${pkg.version}-${pkg.kind}`} pkg={pkg} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'recommendations' && (
        <div style={{ display: 'grid', gap: '10px' }}>
          {result.recommendations.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No updates recommended — tree is current.</p>
          ) : (
            result.recommendations.map((rec) => <RecommendationCard key={`${rec.package}-${rec.toVersion}`} rec={rec} />)
          )}
        </div>
      )}

      {tab === 'conflicts' && (
        <div style={{ display: 'grid', gap: '10px' }}>
          {result.conflicts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No version conflicts detected.</p>
          ) : (
            result.conflicts.map((c) => <ConflictCard key={`${c.package}-${c.resolution}`} conflict={c} />)
          )}
        </div>
      )}

      {tab === 'insights' && (
        <div style={{ display: 'grid', gap: '10px' }}>
          {result.vulnerabilities.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No vulnerabilities identified.</p>
          ) : (
            result.vulnerabilities.map((v) => (
              <div
                key={`${v.id}-${v.title}`}
                style={{
                  background: severityBg(v.severity),
                  border: `1px solid ${severityColor(v.severity)}44`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <Badge label={v.severity} variant={v.severity} />
                  <strong style={{ fontSize: '13px' }}>{v.title}</strong>
                  {v.cve && (
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{v.cve}</span>
                  )}
                  <Badge label={v.source} variant="info" />
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{v.description}</p>
                {v.fixedIn && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
                    Fixed in {v.fixedIn}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        Analyzed at {new Date(result.analyzedAt).toLocaleString()} · {result.recommendations.filter((r) => r.safe).length} safe
        recommendations · detection {(result.detectionRate * 100).toFixed(0)}%
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
