/**
 * D-028 — Performance documentation story.
 *
 * Documents bundle size, render budget, and component-level performance
 * guidance. Uses static content — no live measurements at story-render time.
 */
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Design System/Performance',
  parameters: {
    docs: {
      description: {
        component:
          'Component performance guidelines — bundle budgets, render targets, and optimization patterns for the Stellar Dev Dashboard.',
      },
    },
  },
};
export default meta;

// ─── Shared helpers ───────────────────────────────────────────────────────────

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2
    style={{
      fontFamily: 'var(--font-display)',
      fontSize: '18px',
      fontWeight: 700,
      color: 'var(--text-primary)',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '1px solid var(--border)',
    }}
  >
    {children}
  </h2>
);

const statusColor = (status: 'good' | 'warn' | 'fail') => {
  if (status === 'good') return 'var(--green)';
  if (status === 'warn') return 'var(--amber)';
  return 'var(--red)';
};

// ─── Bundle Size ──────────────────────────────────────────────────────────────

export const BundleSize: StoryObj = {
  name: 'Bundle Size',
  render: () => {
    const rows: { component: string; gzip: string; status: 'good' | 'warn' | 'fail'; note: string }[] = [
      { component: 'Card / StatCard', gzip: '~1 KB', status: 'good', note: 'Inline styles only, no external deps' },
      { component: 'CopyableValue', gzip: '~1 KB', status: 'good', note: 'Single effect, one clipboard write' },
      { component: 'ThemeToggle', gzip: '~2 KB', status: 'good', note: 'lucide-react icon + Zustand read' },
      { component: 'NetworkIndicator', gzip: '~2 KB', status: 'good', note: 'Pure display, no subscriptions' },
      { component: 'ValidatedInput', gzip: '~3 KB', status: 'good', note: 'Self-contained validation logic' },
      { component: 'BottomSheet', gzip: '~4 KB', status: 'good', note: 'useResponsive hook + touch gestures' },
      { component: 'ResponsiveContainer / Grid / Flex', gzip: '~4 KB', status: 'good', note: 'Three exported components' },
      { component: 'AssetCard', gzip: '~3 KB', status: 'good', note: 'No chart deps' },
      { component: 'NetworkMetricsChart', gzip: '~8 KB', status: 'warn', note: 'Recharts AreaChart (shared via code split)' },
      { component: 'BalanceHistoryChart', gzip: '~6 KB', status: 'warn', note: 'Recharts BarChart + PieChart' },
      { component: 'TransactionBuilder', gzip: '~28 KB', status: 'warn', note: 'stellar-sdk + fee logic; lazy-loaded' },
      { component: 'ContractInteraction', gzip: '~24 KB', status: 'warn', note: 'soroban-client + ABI parsing; lazy-loaded' },
      { component: 'D3VisualizationSuite', gzip: '~35 KB', status: 'warn', note: 'Full D3 force graph; lazy-loaded on demand' },
    ];

    return (
      <div style={{ maxWidth: 800, fontFamily: 'var(--font-sans)' }}>
        <SectionTitle>Bundle Size per Component</SectionTitle>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
          The overall build target is <strong style={{ color: 'var(--text-primary)' }}>500 KB gzipped</strong> (enforced in CI via{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>scripts/check-coverage.mjs</code>).
          Large components are code-split with{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>React.lazy()</code>.
          Sizes below are per-component estimates excluding shared chunks (Recharts, stellar-sdk, etc. are bundled once).
        </p>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            overflow: 'hidden',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 70px auto',
              padding: '8px 16px',
              background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border)',
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              gap: '12px',
            }}
          >
            <span>Component</span>
            <span>Gzipped</span>
            <span>Status</span>
            <span>Notes</span>
          </div>
          {rows.map((row, i) => (
            <div
              key={row.component}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 70px auto',
                padding: '10px 16px',
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                fontSize: '12px',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                }}
              >
                {row.component}
              </code>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}
              >
                {row.gzip}
              </span>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: 700,
                  background: `${statusColor(row.status)}22`,
                  color: statusColor(row.status),
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  width: 'fit-content',
                }}
              >
                {row.status}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.note}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {(
            [
              ['good', '< 5 KB', 'Target for pure UI components'],
              ['warn', '5–40 KB', 'Acceptable for feature components; must be lazy-loaded'],
              ['fail', '> 40 KB', 'Requires code splitting or dependency audit'],
            ] as const
          ).map(([status, range, label]) => (
            <div
              key={status}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '11px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '2px',
                  background: statusColor(status),
                  flexShrink: 0,
                }}
              />
              <strong style={{ color: statusColor(status), fontFamily: 'var(--font-mono)' }}>{range}</strong>
              <span style={{ color: 'var(--text-muted)' }}>— {label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
  parameters: { layout: 'padded' },
};

// ─── Render Time ──────────────────────────────────────────────────────────────

export const RenderTime: StoryObj = {
  name: 'Render Time Targets',
  render: () => (
    <div style={{ maxWidth: 680, fontFamily: 'var(--font-sans)' }}>
      <SectionTitle>Render Time Targets</SectionTitle>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
        Measured with{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>React.Profiler</code>{' '}
        in development builds on a mid-range device. Production builds are faster due to minification and
        disabled dev warnings. Run{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>npm run test:lighthouse</code> for
        full Lighthouse metrics.
      </p>

      {[
        {
          category: 'Pure UI Components',
          budget: '< 1 ms',
          examples: ['Card', 'StatCard', 'CopyableValue', 'ThemeToggle', 'NetworkIndicator', 'ValidatedInput'],
          note: 'No side effects on mount. Should never exceed budget.',
        },
        {
          category: 'Layout Components',
          budget: '< 5 ms',
          examples: ['Sidebar', 'MobileHeader', 'BottomSheet', 'ResponsiveContainer'],
          note: 'May run useResponsive hook; acceptable cost.',
        },
        {
          category: 'Chart Components',
          budget: '< 50 ms',
          examples: ['NetworkMetricsChart', 'BalanceHistoryChart', 'AccountActivityChart'],
          note: 'Recharts layout pass is CPU-bound. Virtualize data to ≤ 500 points.',
        },
        {
          category: 'Feature Panels (API-dependent)',
          budget: '< 100 ms to first paint; data via Suspense/loading state',
          examples: ['Overview', 'Account', 'Transactions', 'Contracts', 'DEXExplorer'],
          note: 'Show skeleton or spinner immediately. Data fetches are async.',
        },
        {
          category: 'Heavy Editors',
          budget: 'Lazy-load; < 200 ms to interactive after load',
          examples: ['TransactionBuilder', 'ContractInteraction', 'D3VisualizationSuite'],
          note: 'Must use React.lazy() + Suspense. Never eager-import.',
        },
      ].map(({ category, budget, examples, note }) => (
        <div
          key={category}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '14px 16px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>{category}</div>
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--green)',
                background: 'rgba(34,197,94,0.08)',
                padding: '2px 6px',
                borderRadius: '4px',
                flexShrink: 0,
              }}
            >
              {budget}
            </code>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {examples.map((ex) => (
              <code
                key={ex}
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--cyan)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '1px 5px',
                }}
              >
                {ex}
              </code>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{note}</div>
        </div>
      ))}
    </div>
  ),
  parameters: { layout: 'padded' },
};

// ─── Patterns ─────────────────────────────────────────────────────────────────

export const OptimizationPatterns: StoryObj = {
  name: 'Optimization Patterns',
  render: () => (
    <div style={{ maxWidth: 680, fontFamily: 'var(--font-sans)' }}>
      <SectionTitle>Optimization Patterns</SectionTitle>

      {[
        {
          title: 'Code Split Heavy Components',
          code: `// ✅ Do
const TransactionBuilder = React.lazy(() =>
  import('./components/dashboard/TransactionBuilder')
);

// Inside render:
<Suspense fallback={<div className="spinner" />}>
  <TransactionBuilder />
</Suspense>`,
          note: 'Required for any component > 10 KB. The app-level router already splits by route.',
        },
        {
          title: 'Virtualize Long Lists',
          code: `// ✅ Do — use VirtualList for > 50 items
import VirtualList from './components/common/VirtualList';

<VirtualList
  items={transactions}
  itemHeight={52}
  renderItem={(tx) => <TransactionRow tx={tx} />}
/>

// ❌ Don't — map 1000+ items unconditionally
transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)`,
          note: 'VirtualList is already available at src/components/common/VirtualList.jsx.',
        },
        {
          title: 'Memoize Expensive Renders',
          code: `// ✅ Do — stable reference for chart data
const chartData = useMemo(
  () => buildChartSeries(rawLedgers),
  [rawLedgers]
);

// ✅ Do — pure display component
const StatCard = React.memo(({ label, value, sub, accent }: StatCardProps) => { ... });`,
          note: 'Only memoize when profiling confirms a perf problem. Premature memoization adds cognitive overhead.',
        },
        {
          title: 'Debounce Live Search / API Calls',
          code: `// ✅ Do — debounce asset search
const [query, setQuery] = useState('');
const debouncedQuery = useDebounce(query, 300);

useEffect(() => {
  if (debouncedQuery) fetchAssets(debouncedQuery);
}, [debouncedQuery]);`,
          note: 'Avoid firing Horizon requests on every keystroke.',
        },
        {
          title: 'Respect prefers-reduced-motion',
          code: `// ✅ Do — check the media query
const prefersReduced = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

const duration = prefersReduced
  ? 0
  : tokens.motion.duration.normal; // '180ms'`,
          note: 'The AccessibilityContext exposes a reducedMotion flag — use it instead of reading the media query directly.',
        },
      ].map(({ title, code, note }) => (
        <div
          key={title}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border)',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </div>
          <pre
            style={{
              margin: 0,
              padding: '14px 16px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              overflowX: 'auto',
              lineHeight: 1.7,
              borderBottom: '1px solid var(--border)',
              background: 'transparent',
            }}
          >
            {code}
          </pre>
          <div
            style={{
              padding: '8px 14px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            {note}
          </div>
        </div>
      ))}
    </div>
  ),
  parameters: { layout: 'padded' },
};
