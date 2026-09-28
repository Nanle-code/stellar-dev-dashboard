---
id: rate-limiting
title: Rate Limiting
sidebar_label: Rate Limiting
---

# Rate Limiting

The dashboard's client-side rate limiter (`src/lib/rateLimiter.js`) uses a **token-bucket** algorithm with **priority queuing** to stay within Horizon's and CoinGecko's server-side limits.

## Token-bucket architecture

```
Request → Bucket has tokens? → Yes → Execute immediately
                             → No  → Priority Queue (high/medium/low)
                                         ↓ token refilled after window
                                     Execute from queue
```

A single time window is **60,000 ms (1 minute)**. Tokens refill at the start of each window.

## Limits table

| Endpoint target | Max req/min | Priority tier |
|---|---|---|
| `/accounts` | 20 | High |
| `/transactions` | 15 | Medium |
| `/operations` | 25 | Medium |
| `/assets` | 10 | Low |
| Soroban `/contracts` | 5 | High |
| Default (all others) | 30 | Medium |

## Priority tier details

### High priority
Processed first when a token becomes available.
- Contract simulations and invocations
- Transaction submissions
- Friendbot faucet requests
- Initial wallet connection

### Medium priority
Processed after high-priority queue is empty. Dropped if queued for more than **30 seconds**.
- Tab-switch data loads
- "Load More" pagination
- DEX order book refreshes

### Low priority
Processed only when both high and medium queues are empty.
- Price ticker updates
- Portfolio value recalculations
- Diagnostic logging

## Throttle modes

| Mode | Throughput | Max queue | Processing interval |
|---|---|---|---|
| `aggressive` (default) | Full capacity | Unlimited | 50ms |
| `conservative` | 1/3 of normal | 100 requests | 150ms |

Switch modes at runtime:

```ts
import { rateLimiter } from '@/lib/rateLimiter';
rateLimiter.setThrottleMode('conservative'); // for low-bandwidth environments
rateLimiter.setThrottleMode('aggressive');   // default
```

## Integration pattern

All fetch calls to external resources should go through the rate limiter:

```ts
import { rateLimiter } from '@/lib/rateLimiter';

// Instead of calling fetch() directly:
const data = await rateLimiter.queueRequest(
  () => fetch('https://horizon-testnet.stellar.org/accounts/' + publicKey),
  { priority: 'high', endpoint: '/accounts' }
);
```

This ensures requests are automatically scheduled, queued on excess, and retried on 429 responses.
