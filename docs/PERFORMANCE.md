# Component & Route Performance Guide

Reference for component render budgets, bundle size targets, optimization patterns, and automated Lighthouse CI performance budgets across Mobile and Desktop routes.
The interactive version of this guide lives in Storybook: **Design System / Performance**.

---

## Build & CI Performance Budgets

| Metric                           | Target                               | Enforcement                                |
| -------------------------------- | ------------------------------------ | ------------------------------------------ |
| Total bundle (gzipped)           | ≤ 500 KB                             | `scripts/check-bundle-budgets.mjs` in CI   |
| Route chunk (gzipped)            | ≤ 150 KB                             | `scripts/check-bundle-budgets.mjs` in CI   |
| Lighthouse Performance (Desktop) | ≥ 70 (error) / ≥ 80 (warn)           | Lighthouse CI (`lighthouserc.desktop.cjs`) |
| Lighthouse Performance (Mobile)  | ≥ 65 (error) / ≥ 75 (warn)           | Lighthouse CI (`lighthouserc.mobile.cjs`)  |
| LCP (Largest Contentful Paint)   | < 2.5s (Desktop) / < 3.5s (Mobile)   | Lighthouse CI (`lighthouserc.cjs`)         |
| CLS (Cumulative Layout Shift)    | < 0.10 (Desktop & Mobile)            | Lighthouse CI & Playwright visual tests    |
| TBT (Total Blocking Time)        | < 300ms (Desktop) / < 500ms (Mobile) | Lighthouse CI (`lighthouserc.cjs`)         |
| Accessibility Score              | ≥ 90                                 | Lighthouse CI (`axe-core` & LHCI audit)    |

---

## Lighthouse CI Performance Budgets (Mobile & Desktop)

Lighthouse CI budgets are defined in `scripts/lighthouse-budgets.cjs` and exported to standard Lighthouse budget manifests (`budgets-desktop.json` and `budgets-mobile.json`).

Budgets are enforced per route across Core Web Vitals to account for route complexity, data density, and visualization dependencies:

### 1. Route-Level Timing Budgets

| Route                   | Viewport | Target LCP | Target CLS | Target TBT | Target FCP | Profile Notes                                 |
| ----------------------- | -------- | ---------- | ---------- | ---------- | ---------- | --------------------------------------------- |
| `/*` (Default Baseline) | Desktop  | < 2500 ms  | < 0.10     | < 300 ms   | < 2000 ms  | Baseline fallback for general routes          |
| `/*` (Default Baseline) | Mobile   | < 3500 ms  | < 0.10     | < 500 ms   | < 2500 ms  | Mobile 4x CPU slowdown & simulated 4G         |
| `/connect`              | Desktop  | < 1800 ms  | < 0.05     | < 150 ms   | < 1200 ms  | Lightweight entrance & wallet connection      |
| `/connect`              | Mobile   | < 2500 ms  | < 0.05     | < 250 ms   | < 1800 ms  | Mobile wallet onboarding flow                 |
| `/overview`             | Desktop  | < 2500 ms  | < 0.10     | < 300 ms   | < 2000 ms  | Main dashboard overview cards & summary       |
| `/overview`             | Mobile   | < 3500 ms  | < 0.10     | < 500 ms   | < 2500 ms  | Mobile dashboard view                         |
| `/analytics`            | Desktop  | < 3000 ms  | < 0.10     | < 400 ms   | < 2200 ms  | Recharts time-series data & volume trends     |
| `/analytics`            | Mobile   | < 4000 ms  | < 0.10     | < 600 ms   | < 2800 ms  | Heavy chart rendering under mobile throttling |
| `/transactions`         | Desktop  | < 2800 ms  | < 0.10     | < 350 ms   | < 2000 ms  | Live transaction feed & virtualized ledger    |
| `/transactions`         | Mobile   | < 3800 ms  | < 0.10     | < 550 ms   | < 2600 ms  | Mobile transaction list view                  |
| `/network`              | Desktop  | < 2600 ms  | < 0.10     | < 300 ms   | < 2000 ms  | Network validator stats & node health         |
| `/network`              | Mobile   | < 3500 ms  | < 0.10     | < 500 ms   | < 2500 ms  | Mobile network stats overview                 |
| `/contracts`            | Desktop  | < 2800 ms  | < 0.10     | < 350 ms   | < 2000 ms  | Soroban workspace & contract interface        |
| `/contracts`            | Mobile   | < 3800 ms  | < 0.10     | < 550 ms   | < 2600 ms  | Mobile contract interaction view              |
| `/performance`          | Desktop  | < 2700 ms  | < 0.10     | < 300 ms   | < 2000 ms  | Internal telemetry & latency monitor          |
| `/performance`          | Mobile   | < 3600 ms  | < 0.10     | < 500 ms   | < 2500 ms  | Mobile telemetry monitor                      |

### 2. Category Score Thresholds

| Category       | Desktop (Error) | Desktop (Warn) | Mobile (Error) | Mobile (Warn) |
| -------------- | --------------- | -------------- | -------------- | ------------- |
| Performance    | ≥ 0.70          | ≥ 0.80         | ≥ 0.65         | ≥ 0.75        |
| Accessibility  | ≥ 0.90          | ≥ 0.95         | ≥ 0.90         | ≥ 0.95        |
| Best Practices | ≥ 0.85          | ≥ 0.90         | ≥ 0.85         | ≥ 0.90        |
| SEO            | ≥ 0.85          | ≥ 0.90         | ≥ 0.85         | ≥ 0.90        |

### 3. Resource Size Budgets

| Resource Type                  | Desktop Budget | Mobile Budget |
| ------------------------------ | -------------- | ------------- |
| JavaScript (`script`)          | ≤ 400 KB       | ≤ 350 KB      |
| Total Page Size (`total`)      | ≤ 800 KB       | ≤ 700 KB      |
| CSS Stylesheets (`stylesheet`) | ≤ 100 KB       | ≤ 80 KB       |
| HTML Document (`document`)     | ≤ 50 KB        | ≤ 40 KB       |
| Web Fonts (`font`)             | ≤ 150 KB       | ≤ 120 KB      |

---

## Running Lighthouse CI Locally

```bash
# 1. Build the production bundle
pnpm run build

# 2. Run Lighthouse CI on Desktop
pnpm run test:lighthouse:desktop

# 3. Run Lighthouse CI on Mobile
pnpm run test:lighthouse:mobile

# 4. Enforce budgets against the latest audit reports
pnpm run test:lighthouse:enforce

# Or run complete verification in one command:
pnpm run test:lighthouse
```

### CLI Options for Budget Enforcement

The enforcement CLI (`scripts/enforce-lighthouse-budgets.mjs`) provides flexible reporting:

```bash
# Evaluate specific profile
node scripts/enforce-lighthouse-budgets.mjs --device=desktop
node scripts/enforce-lighthouse-budgets.mjs --device=mobile

# Strict enforcement (warnings treated as failures)
node scripts/enforce-lighthouse-budgets.mjs --strict

# Output machine-readable JSON for CI integration
node scripts/enforce-lighthouse-budgets.mjs --json
```

Exit codes:

- `0`: All performance budgets passed.
- `1`: Budget violation(s) detected (prints actual vs budget, delta, and remediation).
- `2`: Invalid CLI input or arguments.
- `3`: Unsupported environment (missing `dist`, missing reports, unreadable manifest).

---

## Compatibility, Security & Migration Notes

### Compatibility

- **Node.js**: Requires Node.js `>=22 <27` (compatible with `>=20` in CI environments).
- **Chrome / Chromium**: Lighthouse requires Chrome or Chromium with modern DevTools protocol support. Headless mode uses `--headless=new` with sandbox flags (`--no-sandbox`, `--disable-dev-shm-usage`) to ensure zero crashes in Docker containers and GitHub Actions runners.
- **Single Page Application Routing**: The LHCI static server utilizes `isSinglePageApplication: true` to route all dynamic tabs (`/connect`, `/overview`, `/analytics`, `/transactions`, etc.) to `dist/index.html` without 404 errors.

### Security

- **Local Isolation**: Lighthouse CI audits are executed against a locally bound HTTP server (`localhost` on a random ephemeral port). No traffic is transmitted outside the host environment.
- **Zero Token Leakage**: Artifact upload is configured to public temporary storage only when secrets (`LHCI_GITHUB_APP_TOKEN`) are explicitly defined in repository settings. No wallet private keys or user credentials are ever touched by LHCI.
- **Strict Input Validation**: Route names, device identifiers, and metric values are sanitized and strictly validated against boundary limits to prevent command or path injection.

### Migration Notes

- **From Legacy Configuration**: Legacy `lighthouserc.cjs` audited only the root URL `/` on a desktop preset with flat assertions. The new system introduces:
  - Multi-route auditing via `url` array covering all primary dashboard tabs.
  - Dedicated desktop (`lighthouserc.desktop.cjs`) and mobile (`lighthouserc.mobile.cjs`) configurations.
  - Granular `assertMatrix` defining route-specific budgets.
  - Standard `budgets-desktop.json` and `budgets-mobile.json` files for external Lighthouse tooling compatibility.

---

## Failure Paths & Remediation

When a performance budget is breached, LHCI or `enforce-lighthouse-budgets.mjs` identifies the exact metric, actual value, budget threshold, and delta:

### LCP Breaches (> Budget Limit)

1. **Defer Non-Critical Scripts**: Check `dist/stats.html` (`pnpm run build:analyze`) to identify bloated vendor bundles.
2. **Prioritize Critical Elements**: Preload hero fonts or critical SVG icons used above the fold.
3. **Lazy-Load Route Subcomponents**: Ensure heavy components (e.g. `TransactionBuilder`, `D3VisualizationSuite`) remain strictly lazy-loaded via `React.lazy`.

### CLS Breaches (> 0.10)

1. **Reserve Aspect Ratios**: Assign explicit CSS `aspect-ratio` or `min-height` on cards, chart containers, and skeleton placeholders.
2. **Avoid Uncontained DOM Injections**: Ensure live notification banners or status toasts animate with `transform`/`opacity` rather than height shifts.

### TBT Breaches (> Budget Limit)

1. **Slice Main Thread Work**: Break long analytical loops using `requestIdleCallback`, `requestAnimationFrame`, or microtask yields.
2. **Offload Heavy Calculations**: For predictive ML models (TensorFlow.js or statistical regressors), run inference asynchronously or inside Web Workers.

---

## Bundle Size by Component Group

| Component            | Gzipped | Notes                                          |
| -------------------- | ------- | ---------------------------------------------- |
| Card / StatCard      | ~1 KB   | Inline styles only                             |
| CopyableValue        | ~1 KB   | Single clipboard effect                        |
| ThemeToggle          | ~2 KB   | lucide-react icon + Zustand read               |
| NetworkIndicator     | ~2 KB   | Pure display                                   |
| ValidatedInput       | ~3 KB   | Self-contained validation                      |
| BottomSheet          | ~4 KB   | `useResponsive` + touch gestures               |
| ResponsiveContainer  | ~4 KB   | Three exported components                      |
| AssetCard            | ~3 KB   | No chart deps                                  |
| NetworkMetricsChart  | ~8 KB   | Recharts (shared chunk)                        |
| BalanceHistoryChart  | ~6 KB   | Recharts (shared chunk)                        |
| TransactionBuilder   | ~28 KB  | stellar-sdk; **must be lazy-loaded**           |
| ContractInteraction  | ~24 KB  | soroban-client; **must be lazy-loaded**        |
| D3VisualizationSuite | ~35 KB  | Full D3 force graph; **lazy-loaded on demand** |

---

## Render Time Targets

| Category                       | Budget                   | Examples                                                   |
| ------------------------------ | ------------------------ | ---------------------------------------------------------- |
| Pure UI components             | < 1 ms                   | Card, StatCard, CopyableValue, ThemeToggle, ValidatedInput |
| Layout components              | < 5 ms                   | Sidebar, MobileHeader, BottomSheet, ResponsiveContainer    |
| Chart components               | < 50 ms                  | NetworkMetricsChart, BalanceHistoryChart                   |
| Feature panels (API-dependent) | < 100 ms to first paint  | Overview, Account, Transactions                            |
| Heavy editors                  | < 200 ms after lazy load | TransactionBuilder, ContractInteraction                    |

---

## Optimization Patterns

### 1. Code Split Heavy Components

```jsx
// Required for any component > 10 KB
const TransactionBuilder = React.lazy(() => import('./components/dashboard/TransactionBuilder'));

<Suspense fallback={<div className="spinner" />}>
  <TransactionBuilder />
</Suspense>;
```

### 2. Virtualize Long Lists

`src/components/common/VirtualList.jsx` is available for lists with > 50 items.

```jsx
import VirtualList from './components/common/VirtualList';

<VirtualList
  items={transactions}
  itemHeight={52}
  renderItem={(tx) => <TransactionRow tx={tx} />}
/>;
```

### 3. Memoize Stable References

Only memoize after profiling confirms a performance problem.

```jsx
const chartData = useMemo(() => buildChartSeries(rawLedgers), [rawLedgers]);
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

## Profiling Commands

```bash
# Lighthouse CI (requires a local build)
npm run test:lighthouse

# Desktop and Mobile specific audits
npm run test:lighthouse:desktop
npm run test:lighthouse:mobile

# Budget enforcement
npm run test:lighthouse:enforce

# Bundle analysis
npm run build:analyze

# Vitest coverage
npm run test:coverage
```
## Subscription leak audit

The development toolbar includes a **Subscriptions** panel that reports active
SSE, polling, interval, and listener resources while switching dashboard views.
Each long-lived resource must register with `src/lib/subscriptionRegistry.ts`
and call the returned idempotent cleanup function when it is stopped. Use the
panel while repeatedly entering and leaving a view; active counts should return
to their baseline after every switch.

For a deeper investigation, capture a browser heap snapshot before and after
repeating the switch sequence. Compare retained `EventSource`, timer, and
listener objects, and verify that their count does not grow between cycles.
