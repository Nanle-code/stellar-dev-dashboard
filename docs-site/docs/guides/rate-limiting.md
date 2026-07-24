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

## Server-side Horizon rate limits

If you exceed Horizon's limits despite the client-side throttle, you'll receive HTTP `429`. The dashboard's error handler automatically retries these with exponential backoff. You can check Horizon's published limits at [developers.stellar.org](https://developers.stellar.org/api/horizon).

:::tip CoinGecko API key
The free CoinGecko tier allows ~10–30 requests/min. Add `VITE_COINGECKO_API_KEY` to your `.env` for the Pro tier with higher limits.
:::
