/**
 * RefactoringAdvisor.tsx
 *
 * Dashboard tab that surfaces the AI refactoring recommender results:
 *  • Quality score & impact summary
 *  • Hotspot files ranked by Isolation Forest anomaly score
 *  • Prioritized suggestion list grouped by safety bucket
 *  • Per-file metrics and a download trigger for the full report
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  Hotspot,
  RefactoringSuggestion,
} from '../../lib/refactoring/types';
import { toJSON, toMarkdown } from '../../lib/refactoring/reportGenerator';
import { recommend } from '../../lib/refactoring/recommender';

const PALETTE = ['#06b6d4', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb7185', '#60a5fa', '#facc15'];

const SEVERITY_COLOR: Record<string, string> = {
  info: '#60a5fa',
  warning: '#fbbf24',
  critical: '#f87171',
};

// ---------------------------------------------------------------------------
// Demo sources (illustrative; not linted). The recommender runs on these
// targets so the tab renders meaningful output out of the box.
// ---------------------------------------------------------------------------

export default function RefactoringAdvisor() {
  const [tab, setTab] = useState<'overview' | 'suggestions' | 'hotspots' | 'metrics'>('overview');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'impact' | 'safety'>('priority');
  const [includeRisky, setIncludeRisky] = useState<boolean>(false);

  const result = useMemo(() => runDemoPipeline(), []);
  const stats = useMemo(() => {
    const breakdown = Object.entries(result.report.issueBreakdown)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ kind: k, count: v }));
    return breakdown;
  }, [result]);

  const filteredSuggestions = useMemo(() => {
    let list = result.report.suggestions;
    if (filterSeverity !== 'all') {
      list = list.filter((s) => s.severity === filterSeverity);
    }
    if (!includeRisky) {
      list = list.filter((s) => s.bucket !== 'high-effort' || s.priority > 55);
    }
    list = [...list];
    list.sort((a, b) => {
      if (sortBy === 'priority') return b.priority - a.priority;
      if (sortBy === 'impact') {
        return (
          b.complexityDelta + b.linesSaved + b.maintainabilityDelta -
          (a.complexityDelta + a.linesSaved + a.maintainabilityDelta)
        );
      }
      return b.safety - a.safety;
    });
    return list;
  }, [result, filterSeverity, sortBy, includeRisky]);

  const downloadJson = useCallback(() => {
    const blob = new Blob([toJSON(result.report)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refactor-report-${result.report.generatedAt}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const copyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(result.report));
    } catch {
      /* clipboard unsupported */
    }
  }, [result]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>🛠️ AI Refactoring Advisor</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Suggestions ranked by impact, validated for safety, prioritised by ML confidence.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={copyMarkdown}
            style={btnStyle('secondary')}
          >
            📋 Copy Markdown
          </button>
          <button
            onClick={downloadJson}
            style={btnStyle('primary')}
          >
            ⬇️ Download JSON
          </button>
        </div>
      </header>

      <section style={cardStyle()}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
          <ScoreTile
            label="Code Quality"
            value={result.report.codeQualityScore}
            accent="#06b6d4"
            helper="/ 100"
          />
          <ScoreTile
            label="Suggestions"
            value={result.report.totalSuggestions}
            accent="#a78bfa"
            helper="ranked by priority"
          />
          <ScoreTile
            label="Acceptance Probability"
            value={result.report.averageAcceptanceProbability}
            accent="#34d399"
            helper="% avg"
          />
          <ScoreTile
            label="Quick Wins"
            value={result.quickWins.length}
            accent="#fbbf24"
            helper="≤ 25 min effort"
          />
        </div>
      </section>

      <nav style={tabsStyle()}>
        {(['overview', 'suggestions', 'hotspots', 'metrics'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={tab === t ? tabActiveStyle() : tabStyle()}
          >
            {tabLabel(t)}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <OverviewPane
          stats={stats}
          hotspots={result.report.hotspots}
          impact={result.report.impact}
          qualityScore={result.report.codeQualityScore}
        />
      )}

      {tab === 'suggestions' && (
        <SuggestionsPane
          suggestions={filteredSuggestions}
          filterSeverity={filterSeverity}
          onFilter={setFilterSeverity}
          sortBy={sortBy}
          onSort={setSortBy}
          includeRisky={includeRisky}
          onIncludeRisky={setIncludeRisky}
        />
      )}

      {tab === 'hotspots' && <HotspotsPane hotspots={result.report.hotspots} />}

      {tab === 'metrics' && <MetricsPane files={result.metrics} />}

      <Banner totalAcceptance={result.report.averageAcceptanceProbability} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreTile({
  label,
  value,
  accent,
  helper,
}: {
  label: string;
  value: number;
  accent: string;
  helper?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card, #1a1d24)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 10px)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1.1 }}>
        {value}
        {helper && <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>{helper}</span>}
      </div>
    </div>
  );
}

function OverviewPane({
  stats,
  hotspots,
  impact,
  qualityScore,
}: {
  stats: { kind: string; count: number }[];
  hotspots: Hotspot[];
  impact: { totalLinesSaved: number; totalComplexityReduction: number; totalMaintainabilityGain: number };
  qualityScore: number;
}) {
  const pieData = stats.slice(0, 8);
  const impactData = [
    { name: 'Lines saved', value: impact.totalLinesSaved },
    { name: 'Complexity ↓', value: impact.totalComplexityReduction },
    { name: 'Maintainability ↑', value: impact.totalMaintainabilityGain },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 16,
      }}
    >
      <section style={cardStyle()}>
        <h3 style={sectionTitle()}>📊 Suggestion Mix</h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="count"
                nameKey="kind"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card, #1a1d24)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                }}
              />
              <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>No suggestions yet.</p>
        )}
      </section>

      <section style={cardStyle()}>
        <h3 style={sectionTitle()}>🎯 Estimated Impact</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={impactData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
            <YAxis stroke="var(--text-secondary)" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card, #1a1d24)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
              }}
            />
            <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section style={cardStyle()}>
        <h3 style={sectionTitle()}>🔥 Top Hotspots</h3>
        {hotspots.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No outliers detected.</p>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {hotspots.slice(0, 5).map((h) => (
            <li
              key={h.file}
              style={{
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                marginBottom: 8,
                background: 'var(--bg-elevated, rgba(255,255,255,0.02))',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <code style={{ fontSize: 12, color: 'var(--cyan, #06b6d4)' }}>{h.file}</code>
                <span style={badgeStyle('#f87171')}>{h.anomalyScore}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {h.contributingFactors.join(' · ')}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section style={cardStyle()}>
        <h3 style={sectionTitle()}>💎 Quality Gauge</h3>
        <QualityGauge score={qualityScore} />
      </section>
    </div>
  );
}

function QualityGauge({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="170" height="170" viewBox="0 0 170 170">
        <circle
          cx="85"
          cy="85"
          r={radius}
          stroke="var(--border)"
          strokeWidth={12}
          fill="none"
        />
        <circle
          cx="85"
          cy="85"
          r={radius}
          stroke={score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171'}
          strokeWidth={12}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 85 85)"
        />
        <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill="var(--text-primary)" fontSize={28} fontWeight={700}>
          {score}
        </text>
        <text x="50%" y="68%" textAnchor="middle" fill="var(--text-muted)" fontSize={11}>
          QUALITY SCORE
        </text>
      </svg>
      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center' }}>
        {score >= 70 ? 'Healthy codebase. Maintain vigilance.' : score >= 45 ? 'Reasonable, with targeted improvement opportunities.' : 'Significant improvement opportunities. Prioritise the top suggestions.'}
      </p>
    </div>
  );
}

function SuggestionsPane({
  suggestions,
  filterSeverity,
  onFilter,
  sortBy,
  onSort,
  includeRisky,
  onIncludeRisky,
}: {
  suggestions: (RefactoringSuggestion & { rank: number; bucket: string })[];
  filterSeverity: 'all' | 'info' | 'warning' | 'critical';
  onFilter: (v: 'all' | 'info' | 'warning' | 'critical') => void;
  sortBy: 'priority' | 'impact' | 'safety';
  onSort: (v: 'priority' | 'impact' | 'safety') => void;
  includeRisky: boolean;
  onIncludeRisky: (v: boolean) => void;
}) {
  const groups: Record<string, typeof suggestions> = {
    'safe-now': [],
    'review-needed': [],
    'high-effort': [],
  };
  for (const s of suggestions) {
    groups[s.bucket]?.push(s);
  }

  return (
    <section style={cardStyle()}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Severity:
          <select
            value={filterSeverity}
            onChange={(e) => onFilter(e.target.value as 'all' | 'info' | 'warning' | 'critical')}
            style={selectStyle()}
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Sort by:
          <select
            value={sortBy}
            onChange={(e) => onSort(e.target.value as 'priority' | 'impact' | 'safety')}
            style={selectStyle()}
          >
            <option value="priority">Priority</option>
            <option value="impact">Impact</option>
            <option value="safety">Safety</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={includeRisky}
            onChange={(e) => onIncludeRisky(e.target.checked)}
          />
          Include high-effort suggestions
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'}
        </span>
      </div>

      {(['safe-now', 'review-needed', 'high-effort'] as const).map((bucket) => {
        const items = groups[bucket];
        if (!items?.length) return null;
        return (
          <div key={bucket} style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '6px 0 8px', color: bucketColor(bucket), fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {bucketLabel(bucket)} · {items.length}
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {items.map((s) => (
                <li
                  key={s.id}
                  style={{
                    padding: 14,
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    marginBottom: 8,
                    background: 'var(--bg-elevated, rgba(255,255,255,0.02))',
                    transition: 'transform 120ms ease, border-color 120ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.borderColor = SEVERITY_COLOR[s.severity];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = '';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      #{s.rank} · {s.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={badgeStyle(SEVERITY_COLOR[s.severity])}>{s.severity}</span>
                      <span style={badgeStyle('#a78bfa')}>priority {s.priority}</span>
                      <span style={badgeStyle('#34d399')}>safety {s.safety}</span>
                    </div>
                  </div>
                  <p style={{ margin: '6px 0', color: 'var(--text-secondary)', fontSize: 13 }}>{s.description}</p>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <code style={{ color: 'var(--cyan, #06b6d4)' }}>{s.file}:{s.startLine}-{s.endLine}</code>
                    {' · '} effort {s.effortMinutes}m
                    {' · '} lines saved {s.linesSaved}
                    {' · '} complexity ↓ {s.complexityDelta}
                    {' · '} maintainability ↑ {s.maintainabilityDelta}
                    {' · '} confidence {Math.round(s.confidence * 100)}%
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Rationale: {s.rationale}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {suggestions.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
          No suggestions match the current filters.
        </p>
      )}
    </section>
  );
}

function HotspotsPane({ hotspots }: { hotspots: Hotspot[] }) {
  const data = hotspots.map((h) => ({
    file: h.file.split('/').pop()?.slice(0, 16) ?? h.file,
    anomaly: h.anomalyScore,
    fullPath: h.file,
  }));
  return (
    <section style={cardStyle()}>
      <h3 style={sectionTitle()}>🔥 Hotspot Anomaly Scores</h3>
      <ResponsiveContainer width="100%" height={Math.max(260, hotspots.length * 36)}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" domain={[0, 1]} stroke="var(--text-secondary)" fontSize={11} />
          <YAxis type="category" dataKey="file" width={140} stroke="var(--text-secondary)" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card, #1a1d24)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
            }}
            formatter={(value: number, _name: string, item: { fullPath?: string }) => [
              String(value),
              item?.fullPath ?? '',
            ]}
          />
          <Bar dataKey="anomaly" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {hotspots.map((h) => (
          <div
            key={h.file}
            style={{
              padding: 12,
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg-elevated, rgba(255,255,255,0.02))',
            }}
          >
            <code style={{ color: 'var(--cyan, #06b6d4)' }}>{h.file}</code>
            <span style={{ ...badgeStyle('#f87171'), marginLeft: 8 }}>
              anomaly {h.anomalyScore}
            </span>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Factors: {h.contributingFactors.join(' · ')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Baseline averages: LOC {h.baseline.avgLoc} · complexity {h.baseline.avgComplexity} · params {h.baseline.avgParams}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricsPane({ files }: { files: { path: string; loc: number; averageFunctionComplexity: number; averageParameters: number; anyUsage: number; maxLineLength: number; duplicateLiteralScore: number }[] }) {
  const bars = files.map((f) => ({
    name: f.path.split('/').pop()?.slice(0, 18) ?? f.path,
    LOC: f.loc,
    Complexity: f.averageFunctionComplexity,
    Params: f.averageParameters,
  }));
  return (
    <section style={cardStyle()}>
      <h3 style={sectionTitle()}>📏 Per-File Quality Metrics</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={bars}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
          <YAxis stroke="var(--text-secondary)" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card, #1a1d24)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
            }}
          />
          <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 11 }} />
          <Bar dataKey="LOC" fill="#06b6d4" />
          <Bar dataKey="Complexity" fill="#a78bfa" />
          <Bar dataKey="Params" fill="#fbbf24" />
        </BarChart>
      </ResponsiveContainer>
      <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={th()}>File</th>
            <th style={th()}>LOC</th>
            <th style={th()}>Avg complexity</th>
            <th style={th()}>Avg params</th>
            <th style={th()}>any</th>
            <th style={th()}>Max line</th>
            <th style={th()}>Dup literals</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.path} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={td()}><code>{f.path}</code></td>
              <td style={td()}>{f.loc}</td>
              <td style={td()}>{f.averageFunctionComplexity}</td>
              <td style={td()}>{f.averageParameters}</td>
              <td style={td()}>{f.anyUsage}</td>
              <td style={td()}>{f.maxLineLength}</td>
              <td style={td()}>{f.duplicateLiteralScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Banner({ totalAcceptance }: { totalAcceptance: number }) {
  return (
    <section
      style={{
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated, rgba(255,255,255,0.02))',
        borderRadius: 'var(--radius-md, 10px)',
        padding: 16,
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}
    >
      <strong style={{ color: 'var(--text-primary)' }}>How suggestions are ranked:</strong> priority combines ML confidence × impact (lines saved, complexity reduction, maintainability gain), scaled by safety (test coverage, coupling, public-API footprint, presence of any typing). The composite is intentionally weighted so that <em>safe + high-impact</em> actions bubble up — the average acceptance probability is {totalAcceptance}% across the corpus.
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tiny style helpers
// ---------------------------------------------------------------------------

function btnStyle(variant: 'primary' | 'secondary'): React.CSSProperties {
  return {
    padding: '8px 14px',
    border: `1px solid ${variant === 'primary' ? '#06b6d4' : 'var(--border)'}`,
    background: variant === 'primary' ? 'rgba(6,182,212,0.12)' : 'var(--bg-elevated, rgba(255,255,255,0.02))',
    color: variant === 'primary' ? '#06b6d4' : 'var(--text-primary)',
    borderRadius: 'var(--radius-md, 10px)',
    cursor: 'pointer',
    fontSize: 13,
    transition: 'transform 100ms ease',
  };
}

function cardStyle(): React.CSSProperties {
  return {
    border: '1px solid var(--border)',
    background: 'var(--bg-card, #1a1d24)',
    borderRadius: 'var(--radius-md, 10px)',
    padding: 18,
  };
}

function tabsStyle(): React.CSSProperties {
  return {
    display: 'flex',
    gap: 4,
    padding: 4,
    background: 'var(--bg-elevated, rgba(255,255,255,0.02))',
    borderRadius: 'var(--radius-md, 10px)',
    border: '1px solid var(--border)',
    alignSelf: 'flex-start',
  };
}

function tabStyle(): React.CSSProperties {
  return {
    padding: '8px 14px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 13,
    borderRadius: 'var(--radius-sm, 6px)',
    cursor: 'pointer',
  };
}

function tabActiveStyle(): React.CSSProperties {
  return {
    ...tabStyle(),
    background: 'rgba(6,182,212,0.18)',
    color: '#06b6d4',
  };
}

function selectStyle(): React.CSSProperties {
  return {
    marginLeft: 6,
    padding: '4px 8px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm, 6px)',
    fontSize: 12,
  };
}

function badgeStyle(color: string): React.CSSProperties {
  return {
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.04)',
    color,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  };
}

function sectionTitle(): React.CSSProperties {
  return {
    margin: '0 0 12px',
    fontSize: 14,
    color: 'var(--text-primary)',
    fontWeight: 600,
  };
}

function th(): React.CSSProperties {
  return { textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 500 };
}

function td(): React.CSSProperties {
  return { padding: '8px 10px', color: 'var(--text-primary)' };
}

function bucketColor(b: string): string {
  return b === 'safe-now' ? '#34d399' : b === 'review-needed' ? '#fbbf24' : '#a78bfa';
}

function bucketLabel(b: string): string {
  return b === 'safe-now' ? '⚡ Safe to Apply' : b === 'review-needed' ? '🔎 Review Needed' : '⏳ Strategic / High Effort';
}

function tabLabel(t: string): string {
  return t === 'overview' ? 'Overview' : t === 'suggestions' ? 'Suggestions' : t === 'hotspots' ? 'Hotspots' : 'Metrics';
}

// ---------------------------------------------------------------------------
// Demo corpus integration
// ---------------------------------------------------------------------------

function runDemoPipeline() {
  const targets = [
    safeTarget('src/lib/stellar/riskWhitelist.js', 'ts', RISK_WHITELIST_SRC),
    safeTarget('src/components/dashboard/Analytics.tsx', 'tsx', ANALYTICS_SRC),
    safeTarget('src/lib/notifications/bulkOperations.ts', 'ts', BULK_OPS_SRC),
    safeTarget('src/utils/dataValidation.ts', 'ts', VALIDATION_SRC),
  ];
  return recommend({ files: targets });
}

function safeTarget(path: string, language: 'ts' | 'tsx' | 'js' | 'jsx', source: string) {
  return { path, language, source };
}

// ---------------------------------------------------------------------------
// Demo sources (illustrative; not linted). The recommender runs on these
// targets so the tab renders meaningful output out of the box.
// ---------------------------------------------------------------------------

const RISK_WHITELIST_SRC = `
import { logEvent } from '../logging';

export function evaluateRisk(profile, holder, asset) {
  let score = 0;
  const reasons = [];
  if (!profile) reasons.push('no-profile');
  if (profile?.kyc?.level < 2) reasons.push('kyc-low');
  if (holder?.balance > 50000) reasons.push('high-balance');
  if (holder?.balance > 50000 || profile?.region === 'restricted') {
    score += 30;
  }
  if (asset?.volatility > 0.8) score += 20;
  if (asset?.spread > 0.05) {
    score += 25;
    if (asset?.spread > 0.1) score += 10;
  }
  if (asset?.issuer && !asset.issuer.trusted) score += 15;
  console.info('evaluating risk', score);
  return { score, reasons };
}

export function applyWhitelist(holder, list) {
  const result = [];
  for (const entry of list) {
    if (!entry.active) continue;
    if (entry.expires && entry.expires < Date.now()) continue;
    const score = evaluateRisk(holder, entry);
    if (score.score > 50) {
      result.push({ ...entry, score });
    }
  }
  return result;
}

export function auditEntry(entry) {
  // TODO: enrich with attribution analysis
  return entry;
}
`.trim();

const ANALYTICS_SRC = `
import React, { useState } from 'react';

export default function Analytics({ data, filters }) {
  const [tab, setTab] = useState('overview');

  function reduceSeries(series) {
    return series.reduce((acc, point) => acc + (point.value || 0), 0);
  }

  function pickTrend(series) {
    return series
      .map((p, i) => ({ ...p, idx: i }))
      .filter((p) => p.value !== null)
      .sort((a, b) => b.value - a.value)[0];
  }

  function renderTrendChart() {
    const series = filters ? data : data;
    const reduced = reduceSeries(series);
    return reduced > 0 ? <Chart {...{ series }} /> : null;
  }

  return (
    <section>
      {renderTrendChart()}
    </section>
  );
}

export function renderHeatmap(rows) {
  const cells = rows.map((row) => row.cells);
  return cells.flat().length;
}
`.trim();

const BULK_OPS_SRC = `
import { pushNotification } from './push';

export async function bulkSendNotifications(records, ctx) {
  const grouped = {};
  for (const r of records) {
    if (!grouped[r.recipient]) grouped[r.recipient] = [];
    grouped[r.recipient].push(r);
  }
  for (const recipient of Object.keys(grouped)) {
    await pushNotification(recipient, grouped[recipient], ctx);
  }
}

export function groupByRecipient(records) {
  const map = {};
  for (const r of records) {
    const k = r.recipient;
    map[k] = map[k] ? [...map[k], r] : [r];
  }
  return map;
}
`.trim();

const VALIDATION_SRC = `
import { logger } from '../logging';

export function validatePayload(payload, schema) {
  const errors = [];
  if (!payload) return [{ msg: 'empty' }];
  for (const key of Object.keys(schema)) {
    const rule = schema[key];
    const value: any = payload[key];
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({ path: key, message: 'required', suggestion: 'provide a value' });
    }
    if (rule.type && typeof value !== rule.type) {
      errors.push({ path: key, message: 'type-mismatch', suggestion: \`use \${rule.type}\` });
    }
  }
  return errors;
}

export function formatErrors(errs) {
  return errs.map((e) => \`\${e.path}: \${e.message} → \${e.suggestion || ''}\`).join('; ');
}

export function recoverFromError(err) {
  const fallback = { ok: false };
  if (err?.code === 'EAGAIN') return { ok: true, retry: true };
  return fallback;
}
`.trim();
