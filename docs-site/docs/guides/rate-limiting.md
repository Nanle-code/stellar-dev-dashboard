---
id: rate-limiting
title: Rate Limiting
sidebar_label: Rate Limiting
---

# Rate Limiting

The dashboard routes all outbound API requests through a client-side **token-bucket rate limiter** (`src/lib/rateLimiter.js`) to prevent hitting Horizon's and CoinGecko's server-side limits.

## How it works

```
UI Request → Rate Limiter → Token available? → Execute immediately
                         → No token?        → Priority Queue → Execute when token refills
```

Token buckets refill at a configured rate per endpoint. When a bucket is empty, requests are queued by priority instead of dropped.

## Configured limits

| Endpoint | Max requests/min | Priority |
|---|---|---|
| `/accounts` | 20 | High |
| `/transactions` | 15 | Medium |
| `/operations` | 25 | Medium |
| `/assets` | 10 | Low |
| Soroban `/contracts` | 5 | High |
| Default | 30 | Medium |

## Priority tiers

| Priority | Used for | Timeout |
|---|---|---|
| `high` | Contract simulations, wallet connection, Friendbot | No timeout |
| `medium` | Tab switches, "Load More", order book refreshes | 30 seconds |
| `low` | Price tickers, portfolio recalculations, logs | No hard timeout |

## Using the rate limiter directly

```ts
import { rateLimiter } from '@/lib/rateLimiter';

// Queue a request with explicit priority
const response = await rateLimiter.queueRequest(
  () => fetch(`https://horizon-testnet.stellar.org/accounts/${publicKey}`),
  { priority: 'high', endpoint: '/accounts' }
);
const data = await response.json();
```

## Throttle modes

```ts
// Switch to conservative mode for low-bandwidth networks
rateLimiter.setThrottleMode('conservative');
// Caps throughput to 1/3 normal, limits queue to 100 items

// Return to default
rateLimiter.setThrottleMode('aggressive');
```

## Monitoring queue depth

```ts
const stats = rateLimiter.getStats();
console.log('Queue depths:', stats.queueDepths);
// → { high: 0, medium: 3, low: 12 }

console.log('Requests in last minute:', stats.requestsLastMinute);
```

## Server-side API rate limiting

The API server (`api/server.js`) applies its own rate limiter middleware (`api/middleware/rateLimiter.js`) to every incoming request.  This protects the backend from excessive load and ensures fair resource distribution across clients.

### How it works

```
Incoming request → Extract client IP → Validate → Check sliding-window count
                                              ↓
                              Under limit → 200 + X-RateLimit-* headers
                              Over limit  → 429 + Retry-After header
```

### Response headers

All responses include rate-limit metadata:

| Header                  | Meaning                                     |
|-------------------------|---------------------------------------------|
| `X-RateLimit-Limit`     | Max requests allowed in the current window  |
| `X-RateLimit-Remaining` | Requests remaining in the current window    |
| `X-RateLimit-Reset`     | Epoch ms when the window fully resets       |
| `Retry-After`           | Seconds until the next request is allowed *(429 only)* |

### Shared store (production)

By default the rate limiter uses an **in-memory store** — fast, but limits are not shared across API instances.  For multi-instance or load-balanced deployments, configure a **Redis** store so every process enforces the same ceiling.

**Environment variables**

| Variable           | Default         | Description                                   |
|--------------------|-----------------|-----------------------------------------------|
| `REDIS_URL`        | –               | Redis connection string (e.g. `redis://localhost:6379`) |
| `RATE_LIMIT_STORE` | `memory`        | `"redis"` to force Redis, `"memory"` to force in-memory |
| `RATE_LIMIT_MAX`   | `100`           | Max requests per window                       |
| `RATE_LIMIT_WINDOW`| `60000`         | Sliding window duration in milliseconds       |

**Using Docker Compose**

A Redis service is included in the `docker-compose.yml` under the `production` profile:

```bash
# Start app + Redis
docker compose --profile production up -d
```

**Manual setup**

```bash
# Install the optional Redis dependency
npm install ioredis

# Start the API with Redis backing
export REDIS_URL=redis://your-redis-host:6379
node api/server.js
```

:::info Graceful fallback
If Redis is configured but unreachable at startup, the server automatically falls back to the in-memory store and logs a warning.  During operation, transient Redis failures cause the middleware to **allow** the request (fail-open) so the API remains available.
:::

### Client IP resolution

The middleware reads the client address from:
1. `X-Forwarded-For` header (left-most entry) — trusted proxy required
2. `req.ip` — populated by Express when `trust proxy` is enabled
3. `req.socket.remoteAddress` — fallback

Requests with a missing or malformed client address receive **HTTP 400**.

## Server-side Horizon rate limits

If you exceed Horizon's limits despite the client-side throttle, you'll receive HTTP `429`. The dashboard's error handler automatically retries these with exponential backoff. You can check Horizon's published limits at [developers.stellar.org](https://developers.stellar.org/api/horizon).

:::tip CoinGecko API key
The free CoinGecko tier allows ~10–30 requests/min. Add `VITE_COINGECKO_API_KEY` to your `.env` for the Pro tier with higher limits.
:::
