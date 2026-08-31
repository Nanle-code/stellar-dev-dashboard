---
id: error-handling
title: Error Handling
sidebar_label: Error Handling
---

# Error Handling

The dashboard's error handling layer (`src/lib/errorHandling.ts`) normalizes all API errors into a unified structure with automatic retry, circuit-breaking, and user-friendly messages.

## Error categories

```ts
enum ErrorCategory {
  VALIDATION    = 'VALIDATION',    // 400 — bad input
  AUTHENTICATION = 'AUTHENTICATION', // 401 — not connected
  AUTHORIZATION  = 'AUTHORIZATION',  // 403 — access denied
  NOT_FOUND     = 'NOT_FOUND',     // 404 — resource missing
  CONFLICT      = 'CONFLICT',      // 409 — state conflict
  RATE_LIMIT    = 'RATE_LIMIT',    // 429 — throttled
  SERVER_ERROR  = 'SERVER_ERROR',  // 5xx — remote failure
  NETWORK       = 'NETWORK',       // no connectivity
  TIMEOUT       = 'TIMEOUT',       // request timed out
}
```

## Using `classifyError`

```ts
import { classifyError, ErrorCategory } from '@/lib/errorHandling';

try {
  const account = await server.loadAccount(publicKey);
} catch (err) {
  const ctx = classifyError(err);

  console.log('Category:', ctx.category);
  console.log('Retryable:', ctx.retryable);
  console.log('User message:', ctx.userMessage);

  switch (ctx.category) {
    case ErrorCategory.NOT_FOUND:
      showToast('Account not found. Check the public key.');
      break;
    case ErrorCategory.RATE_LIMIT:
      scheduleRetry(); // safe to retry
      break;
    case ErrorCategory.NETWORK:
      showOfflineBanner();
      break;
    default:
      console.error('Unexpected error:', ctx);
  }
}
```

## Automatic retry with backoff

```ts
import { retryWithBackoff } from '@/lib/errorHandling';

const account = await retryWithBackoff(
  () => server.loadAccount(publicKey),
  {
    maxAttempts: 4,
    baseDelay: 500,   // ms
    maxDelay: 15_000, // ms cap
  }
);
```

Retries automatically on `RATE_LIMIT`, `SERVER_ERROR`, `NETWORK`, and `TIMEOUT` categories. Throws immediately on `VALIDATION`, `NOT_FOUND`, and `AUTHENTICATION`.

## Circuit breaker

The circuit breaker (`src/lib/errorHandling/CircuitBreaker.ts`) prevents cascading failures. After a configurable number of consecutive failures, the circuit opens and requests fail immediately until a cooldown period elapses.

```ts
import { getCircuitBreaker } from '@/lib/errorHandling/CircuitBreaker';

const breaker = getCircuitBreaker('horizon', {
  failureThreshold: 5,      // open after 5 consecutive failures
  successThreshold: 2,      // close after 2 successes in HALF_OPEN
  timeout: 30_000,          // ms before trying HALF_OPEN
});

try {
  const result = await breaker.execute(() => server.loadAccount(publicKey));
} catch (err) {
  if (err.message.includes('Circuit breaker OPEN')) {
    showServiceDownBanner('Horizon', breaker.getState());
  }
}
```

## Circuit states

```
CLOSED → normal, requests pass through
  ↓ (threshold failures)
OPEN → requests fail immediately
  ↓ (timeout elapsed)
HALF_OPEN → one test request allowed
  ↓ (success)                 ↓ (failure)
CLOSED                       OPEN
```

## User-friendly error messages

`src/lib/errorHandling/ErrorMessages.ts` maps error categories and Stellar result codes to human-readable strings:

```ts
import { getErrorMessage, getStellarErrorMessage } from '@/lib/errorHandling/ErrorMessages';

const message = getErrorMessage('RATE_LIMIT');
// → "Too many requests. Please wait a moment and try again."

const txMessage = getStellarErrorMessage('tx_bad_seq');
// → "Transaction sequence number is out of date. Please reload and try again."
```

## Offline queue

Operations attempted while offline are automatically queued and replayed when connectivity returns:

```ts
import { offlineQueue } from '@/lib/errorHandling/RetryManager';

// Queue a Horizon write for later
await offlineQueue.enqueue(
  'submit-tx-abc123',
  () => server.submitTransaction(signedTx),
  'Submit payment transaction'
);

// Flush manually (also fires automatically on 'online' event)
await offlineQueue.flush();
```

## Chunk Load Error Recovery (Post-Deployment Stale Chunks)

When a new version of the dashboard is deployed, old JavaScript chunk files are removed from the CDN. Users who have the app open from before the deploy may encounter `ChunkLoadError` or "Failed to fetch dynamically imported module" errors when navigating to a route that hasn't been loaded yet.

### Automatic Detection

The `ChunkLoadErrorBoundary` component (`src/components/ChunkLoadErrorBoundary.tsx`) wraps the lazy-loaded route layer and specifically detects chunk load failures by matching against known error patterns:

- `Failed to fetch dynamically imported module` (Vite)
- `Loading chunk` / `Loading CSS chunk` (webpack)
- `ChunkLoadError` (standard)
- `NetworkError when attempting to fetch dynamic import`
- `Failed to load module script`
- Errors with `name === 'ChunkLoadError'`

This detection is **distinct from general runtime errors** — only chunk-load failures trigger the recovery UI. Other errors bubble up to the standard `ErrorBoundary` for appropriate handling.

### Recovery UI

When a chunk load failure is detected, a non-intrusive banner appears at the bottom of the viewport (matching the `OfflineBanner` and `SWUpdatePrompt` visual style):

- **First occurrence**: "New Version Available — A new version of the dashboard has been deployed. The page needs to be refreshed to load the latest changes." with a "Reload Now" button.
- **Subsequent occurrences**: "Update Required — Unable to load the latest version. Please refresh the page to try again." with retry count display.
- **Dismiss button**: Allows the user to hide the banner and continue using the currently loaded parts of the app.

The reload action calls `window.location.reload()` by default, or a custom `onReload` callback if provided. In environments without `window.location` (SSR, tests), it degrades gracefully with a console warning.

### Integration

The boundary is integrated in `src/App.tsx` around the `Suspense` that wraps lazy routes:

```tsx
import ChunkLoadErrorBoundary from './components/ChunkLoadErrorBoundary';

<ChunkLoadErrorBoundary>
  <Suspense fallback={<AppLoadingFallback />}>
    <Routes>
      <Route path="/connect" element={<DashboardLayout />} />
      <Route path="/*" element={<DashboardLayout />} />
    </Routes>
  </Suspense>
</ChunkLoadErrorBoundary>
```

### Testing

Simulate a chunk load failure in tests by throwing an error matching the detection patterns:

```tsx
const ThrowChunkLoadError = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Failed to fetch dynamically imported module: /assets/dashboard-[hash].js');
  }
  return <div>Content</div>;
};

render(
  <ChunkLoadErrorBoundary>
    <ThrowChunkLoadError shouldThrow={true} />
  </ChunkLoadErrorBoundary>
);

expect(screen.getByText('New Version Available')).toBeInTheDocument();
```

Verify that generic runtime errors are **not** caught by this boundary:

```tsx
const ThrowGenericError = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error('Random runtime error');
  return <div>Content</div>;
};

render(
  <ChunkLoadErrorBoundary>
    <ThrowGenericError shouldThrow={true} />
  </ChunkLoadErrorBoundary>
);

// Banner should NOT appear — error bubbles to parent ErrorBoundary
expect(screen.queryByText('New Version Available')).not.toBeInTheDocument();
```

### Compatibility Notes

- **Browsers without dynamic import()**: The app targets modern browsers (ES2020+ per `vite.config.js`). Dynamic imports are natively supported. No polyfill is provided.
- **SSR/Node environments**: The boundary checks for `window.location` existence before calling reload. In SSR or test environments, it logs a warning and no-ops instead of crashing.
- **Infinite reload prevention**: The banner shows retry count. After multiple failed reloads, a hint suggests checking network connectivity. No automatic reload loop is implemented.
- **Network vs. stale chunk distinction**: The boundary cannot definitively distinguish "stale chunk after deploy" from "genuinely offline" — both manifest as failed dynamic imports. The UI message assumes the stale-chunk case (most common post-deploy), but the reload action works for both. If the user is truly offline, the reload will fail and they'll see the banner again with incremented retry count.
