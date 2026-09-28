# Route-Level Error Boundaries & Standardized Diagnostic Messaging

This document details the route error boundary architecture and recovery patterns implemented across dashboard views in accordance with Issue #822.

---

## 1. Overview & Architecture

When rendering complex dashboards and data visualizations (Soroban contracts, liquidity pools, transaction graph simulations), unhandled exceptions in a single view must not crash the entire application.

The `RouteErrorBoundary` component (`src/components/routes/RouteErrorBoundary.tsx`) isolates failures to the active route, presenting users with:
1. **Clear Route Context:** Displays the human-readable route title and URL path.
2. **Prominent Diagnostic Tracking Reference:** Generates an `ERR-ROUTE-[NAME]-[TIMESTAMP]-[HASH]` identifier for immediate support and triage.
3. **Consistent Recovery Actions:**
   - **🔄 Retry Route:** Re-executes view initialization up to `maxRetries` (default: 2).
   - **📊 Return to Overview:** Safely navigates the user back to `/overview` to prevent dead-end states.
   - **📋 Copy Diagnostic ID / Report:** Copies a structured JSON diagnostic payload to the system clipboard for bug reports.

---

## 2. Component Usage

```tsx
import RouteErrorBoundary from '../components/routes/RouteErrorBoundary';

<RouteErrorBoundary
  routeName="Contracts"
  routePath="/contracts"
  onRetry={handleRetry}
  onNavigateHome={() => navigate('/overview')}
  maxRetries={2}
>
  <Suspense fallback={<TabLoadingFallback />}>
    <ContractsView />
  </Suspense>
</RouteErrorBoundary>
```

### Props Reference

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `routeName` | `string` | `'View'` | Friendly title of the current view (e.g. `'Contracts'`, `'Analytics'`). |
| `routePath` | `string` | Current pathname | URL path corresponding to the active view. |
| `onRetry` | `() => Promise<void> \| void` | `undefined` | Callback invoked when the user clicks "Retry Route". |
| `onNavigateHome` | `() => void` | Navigates to `/overview` | Callback to navigate the user back to the primary dashboard. |
| `maxRetries` | `number` | `2` | Number of allowable retry attempts before the button is disabled. |

---

## 3. Diagnostic Report Format

When the user clicks **Copy Diagnostic ID**, the clipboard is populated with:

```json
{
  "diagnosticId": "ERR-CONTRACTS-MUIKKF-A9D2",
  "routeName": "Contracts",
  "routePath": "/contracts",
  "errorMessage": "Contract invocation RPC timeout",
  "timestamp": "2026-09-26T15:53:00.000Z",
  "userAgent": "Mozilla/5.0..."
}
```

---

## 4. Accessibility & Screen Reader Standards

- Uses `role="alert"` and `aria-live="assertive"` on the error boundary container.
- Fires an accessibility announcement upon error capture:
  `"An error occurred while loading the [routeName] view. Diagnostic reference: [diagnosticId]"`
