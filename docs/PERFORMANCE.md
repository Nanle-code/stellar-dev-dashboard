# Component Performance Guide

Reference for component render budgets, bundle size targets, and optimization patterns.
The interactive version of this guide lives in Storybook: **Design System / Performance**.

---

## Build Budget

| Metric | Target | Enforcement |
|--------|--------|-------------|
| Total bundle (gzipped) | ≤ 500 KB | `scripts/check-coverage.mjs` in CI |
| Lighthouse Performance | ≥ 90 | `npm run test:lighthouse` |
| LCP (largest contentful paint) | < 2.5 s | Lighthouse CI |
| CLS (cumulative layout shift) | < 0.1 | Playwright visual tests |

---

## Bundle Size by Component Group

| Component | Gzipped | Notes |
|-----------|---------|-------|
| Card / StatCard | ~1 KB | Inline styles only |
| CopyableValue | ~1 KB | Single clipboard effect |
| ThemeToggle | ~2 KB | lucide-react icon + Zustand read |
| NetworkIndicator | ~2 KB | Pure display |
| ValidatedInput | ~3 KB | Self-contained validation |
| BottomSheet | ~4 KB | `useResponsive` + touch gestures |
| ResponsiveContainer | ~4 KB | Three exported components |
| AssetCard | ~3 KB | No chart deps |
| NetworkMetricsChart | ~8 KB | Recharts (shared chunk) |
| BalanceHistoryChart | ~6 KB | Recharts (shared chunk) |
| TransactionBuilder | ~28 KB | stellar-sdk; **must be lazy-loaded** |
| ContractInteraction | ~24 KB | soroban-client; **must be lazy-loaded** |
| D3VisualizationSuite | ~35 KB | Full D3 force graph; **lazy-loaded on demand** |

---

## Render Time Targets

| Category | Budget | Examples |
|----------|--------|---------|
| Pure UI components | < 1 ms | Card, StatCard, CopyableValue, ThemeToggle, ValidatedInput |
| Layout components | < 5 ms | Sidebar, MobileHeader, BottomSheet, ResponsiveContainer |
| Chart components | < 50 ms | NetworkMetricsChart, BalanceHistoryChart |
| Feature panels (API-dependent) | < 100 ms to first paint | Overview, Account, Transactions |
| Heavy editors | < 200 ms after lazy load | TransactionBuilder, ContractInteraction |

---

## Optimization Patterns

### 1. Code Split Heavy Components

```jsx
// ✅ Required for any component > 10 KB
const TransactionBuilder = React.lazy(() =>
  import('./components/dashboard/TransactionBuilder')
);

<Suspense fallback={<div className="spinner" />}>
  <TransactionBuilder />
</Suspense>
```

### 2. Virtualize Long Lists

`src/components/common/VirtualList.jsx` is available for lists with > 50 items.

```jsx
import VirtualList from './components/common/VirtualList';

<VirtualList
  items={transactions}
  itemHeight={52}
  renderItem={(tx) => <TransactionRow tx={tx} />}
/>
```

### 3. Memoize Stable References

Only memoize after profiling confirms a performance problem.

```jsx
const chartData = useMemo(
  () => buildChartSeries(rawLedgers),
  [rawLedgers]
);
```

### 4. Debounce Live Queries

```jsx
const debouncedQuery = useDebounce(query, 300);

useEffect(() => {
  if (debouncedQuery) fetchAssets(debouncedQuery);
}, [debouncedQuery]);
```

### 5. Respect prefers-reduced-motion

```jsx
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const duration = prefersReduced ? 0 : tokens.motion.duration.normal;
```

The `AccessibilityContext` exposes a `reducedMotion` flag — use it in components
rather than reading the media query directly.

---

## Profiling

```bash
# Lighthouse CI (requires a local build)
npm run test:lighthouse

# Bundle analysis
npm run build:analyze

# Vitest coverage
npm run test:coverage
```
