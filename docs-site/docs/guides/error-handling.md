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
