---
id: rate-limit
title: Handling Rate Limits (HTTP 429)
sidebar_label: Rate Limit
---

# Handling Rate Limits — HTTP 429

Horizon and CoinGecko return `429 Too Many Requests` when you exceed their rate limits. Always implement exponential backoff with jitter when retrying.

## JavaScript — retry with backoff

```js title="retry-with-backoff.mjs"
/**
 * Retry an async function with exponential backoff.
 *
 * @param {Function} fn          - Async function to retry
 * @param {object}   options
 * @param {number}   options.maxAttempts  - Max retry attempts (default 5)
 * @param {number}   options.baseDelay   - Initial delay in ms (default 500)
 * @param {number}   options.maxDelay    - Max delay cap in ms (default 30_000)
 */
async function retryWithBackoff(fn, { maxAttempts = 5, baseDelay = 500, maxDelay = 30_000 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const status = err.response?.status;
      const isRetryable = status === 429 || status === 503 || status === 504 || !status;

      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }

      // Exponential backoff with full jitter
      const exponential = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
      const delay = Math.random() * exponential;

      // Respect Retry-After header if present
      const retryAfterHeader = err.response?.headers?.['retry-after'];
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader) * 1000 : delay;

      const waitMs = Math.max(delay, retryAfter);
      console.warn(`Rate limited. Retrying in ${Math.round(waitMs)}ms (attempt ${attempt}/${maxAttempts})`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  throw lastError;
}

// Usage
const account = await retryWithBackoff(
  () => server.loadAccount('GABC...PUBLIC_KEY'),
  { maxAttempts: 5, baseDelay: 1000 }
);
```

## Python — retry with backoff

```python title="retry_with_backoff.py"
import time
import random
from functools import wraps


def retry_with_backoff(max_attempts=5, base_delay=0.5, max_delay=30.0):
    """
    Decorator that retries on HTTP 429 / 503 / 504 with exponential backoff + jitter.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            last_error = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except Exception as exc:
                    last_error = exc
                    status = getattr(getattr(exc, "response", None), "status_code", None)
                    retryable = status in (429, 503, 504) or status is None

                    if not retryable or attempt == max_attempts:
                        raise

                    exponential = min(base_delay * (2 ** (attempt - 1)), max_delay)
                    jitter = random.uniform(0, exponential)
                    print(f"Rate limited. Retrying in {jitter:.1f}s (attempt {attempt}/{max_attempts})")
                    time.sleep(jitter)

            raise last_error

        return wrapper
    return decorator


@retry_with_backoff(max_attempts=5, base_delay=1.0)
def fetch_account_with_retry(server, public_key):
    return server.accounts().account_id(public_key).call()
```

## Using the dashboard's built-in rate limiter

The dashboard routes all API calls through `src/lib/rateLimiter.js`, which uses a token-bucket with priority queuing — so you never hit 429 under normal usage:

```ts
import { rateLimiter } from '@/lib/rateLimiter';

// Queue a high-priority request
const account = await rateLimiter.queueRequest(
  () => fetch(`https://horizon-testnet.stellar.org/accounts/${publicKey}`),
  { priority: 'high', endpoint: '/accounts' }
);
```

And `src/lib/errorHandling.ts` provides `retryWithBackoff` for one-off use:

```ts
import { retryWithBackoff } from '@/lib/errorHandling';

const result = await retryWithBackoff(
  () => server.submitTransaction(tx),
  { maxAttempts: 4, baseDelay: 1000 }
);
```
