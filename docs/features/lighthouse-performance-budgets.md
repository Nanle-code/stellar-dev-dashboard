# Lighthouse Performance Budgets (Mobile & Desktop)

Feature specification and developer guide for route-level Lighthouse performance budgets on Stellar Dev Dashboard.

---

## Overview

Issue **#904** introduces automated Lighthouse CI performance budgets enforcing Core Web Vitals (Largest Contentful Paint, Cumulative Layout Shift, Total Blocking Time) across key application routes on both **Desktop** and **Mobile** viewports.

---

## Monitored Routes & Targets

| Route           | Viewport | Target LCP | Target CLS | Target TBT | Primary Component / Dependencies         |
| --------------- | -------- | ---------- | ---------- | ---------- | ---------------------------------------- |
| `/*`            | Desktop  | < 2500 ms  | < 0.10     | < 300 ms   | Base application shell                   |
| `/*`            | Mobile   | < 3500 ms  | < 0.10     | < 500 ms   | Base application shell (4x CPU slowdown) |
| `/connect`      | Desktop  | < 1800 ms  | < 0.05     | < 150 ms   | `WalletConnect` (lightweight onboarding) |
| `/connect`      | Mobile   | < 2500 ms  | < 0.05     | < 250 ms   | `WalletConnect` mobile view              |
| `/overview`     | Desktop  | < 2500 ms  | < 0.10     | < 300 ms   | `Overview`, stat cards, balance feeds    |
| `/overview`     | Mobile   | < 3500 ms  | < 0.10     | < 500 ms   | `Overview` mobile view                   |
| `/analytics`    | Desktop  | < 3000 ms  | < 0.10     | < 400 ms   | `Analytics`, `Recharts` charts           |
| `/analytics`    | Mobile   | < 4000 ms  | < 0.10     | < 600 ms   | `Analytics` under simulated 4G           |
| `/transactions` | Desktop  | < 2800 ms  | < 0.10     | < 350 ms   | `Transactions`, virtualized list         |
| `/transactions` | Mobile   | < 3800 ms  | < 0.10     | < 550 ms   | `Transactions` mobile view               |
| `/network`      | Desktop  | < 2600 ms  | < 0.10     | < 300 ms   | `NetworkStats`, node health indicators   |
| `/network`      | Mobile   | < 3500 ms  | < 0.10     | < 500 ms   | `NetworkStats` mobile view               |
| `/contracts`    | Desktop  | < 2800 ms  | < 0.10     | < 350 ms   | `Contracts`, Soroban workspace           |
| `/contracts`    | Mobile   | < 3800 ms  | < 0.10     | < 550 ms   | `Contracts` mobile view                  |
| `/performance`  | Desktop  | < 2700 ms  | < 0.10     | < 300 ms   | `PerformanceMonitor` telemetry panel     |
| `/performance`  | Mobile   | < 3600 ms  | < 0.10     | < 500 ms   | `PerformanceMonitor` mobile view         |

---

## Configuration Architecture

1. **`scripts/lighthouse-budgets.cjs`**: Central definition of budgets, input validators, assertion matrix builder, and evaluation engine.
2. **`budgets-desktop.json` & `budgets-mobile.json`**: Standard Lighthouse budget files usable by Lighthouse CLI, PageSpeed Insights, or LHCI.
3. **`lighthouserc.cjs`**: Master LHCI configuration dynamically switching between desktop and mobile via `LHCI_PRESET`.
4. **`lighthouserc.desktop.cjs`**: Dedicated desktop audit configuration.
5. **`lighthouserc.mobile.cjs`**: Dedicated mobile audit configuration with mobile device emulation (Moto G4, 412x823, 4x CPU slowdown).
6. **`scripts/enforce-lighthouse-budgets.mjs`**: CLI enforcement utility with actionable violation reporting and exit codes.

---

## Local Development & Testing

```bash
# Build production bundle
pnpm run build

# Run desktop Lighthouse audit
pnpm run test:lighthouse:desktop

# Run mobile Lighthouse audit
pnpm run test:lighthouse:mobile

# Enforce budgets
pnpm run test:lighthouse:enforce

# Run automated tests
pnpm exec vitest run tests/ci/lighthouse-budgets.test.mjs
```

---

## CI/CD Integration

In `.github/workflows/testing.yml`, the `lighthouse-ci` job:

1. Builds the production bundle with bundle budget checks.
2. Runs Lighthouse CI on Desktop (`lighthouserc.desktop.cjs`).
3. Runs Lighthouse CI on Mobile (`lighthouserc.mobile.cjs`).
4. Enforces performance budgets across all collected runs (`scripts/enforce-lighthouse-budgets.mjs`).
5. Passes artifacts to predictive regression detection.
