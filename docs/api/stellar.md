# stellar.ts

Unified Stellar Service Layer providing Horizon and Soroban RPC wrappers with built-in caching, circuit breakers, and rate limiting. This module consolidates functionality from the legacy `stellar.js` and provides a fully typed TypeScript interface.

## Core Features

- **Circuit Breaker**: Automatic failover and protection for Horizon/RPC requests.
- **Intelligent Caching**: Layered memory/persistent cache with tag-based invalidation.
- **Advanced Simulation**: Transaction simulation with fee optimization and success probability.
- **Asset Discovery**: Comprehensive asset search and trustline recommendations.
- **Audit Trail**: Automatic logging of all API calls and errors.

## Functions

### `fetchAccount(publicKey, network?)`

Loads a Stellar account record. Protected by a circuit breaker and cached in L2 (persistent).

```ts
import { fetchAccount } from '@/lib/stellar';
const account = await fetchAccount('GABC...', 'testnet');
```

| Param     | Type          | Default     | Description      |
| --------- | ------------- | ----------- | ---------------- |
| publicKey | string        | required    | G... address     |
| network   | `NetworkName` | `'testnet'` | Network to query |

Returns: `Promise<Horizon.AccountResponse>`

---

### `fetchTransactions(publicKey, network?, limit?, cursor?)`

Fetches paginated transaction history for an account.

```ts
const { records, nextCursor, hasMore } = await fetchTransactions('GABC...', 'testnet', 20);
```

Returns: `Promise<{ records: TransactionRecord[], nextCursor: string | null, hasMore: boolean }>`

---

### `fetchNetworkStats(network?)`

Returns latest ledger info and fee statistics.

```ts
const { latestLedger, feeStats } = await fetchNetworkStats('mainnet');
```

---

### `fetchXLMPrice()`

Fetches current XLM/USD price from CoinGecko with caching.

```ts
const { usd } = await fetchXLMPrice();
```

---

### `runAdvancedTransactionSimulation(params)`

Simulates a transaction with detailed fee analysis and success probability.

```ts
const report = await runAdvancedTransactionSimulation({
  sourceAccount: 'GABC...',
  operations: [...],
  network: 'testnet'
});
```

---

### `getTrustlineRecommendations(accountId, network?)`

Analyzes an account and recommends popular verified assets.

---

### `clearCache(pattern?)`

Clears the internal cache, optionally filtering by prefix.

---

## Configuration

### `NETWORKS`

Supports `mainnet`, `testnet`, `futurenet`, `local`, and `custom`. Use `updateCustomNetworkConfig` to configure the custom network at runtime.

### Cache TTLs

Defined in `src/lib/cache.js` and used automatically by the service layer.

## Concurrent Horizon reads

The Stellar HTTP client coalesces identical in-flight Horizon `GET` requests.
Callers with the same URL, request options, network endpoint, and headers share
one network operation. Each caller receives its own response body, and the
shared operation is removed when it settles, whether it succeeds or fails;
later calls can retry after a failure. This is request coalescing, not a
persistent cache, and it does not apply to writes such as `POST` transactions.

Requests with different headers or options remain separate. In particular,
custom network credentials are part of the request identity and are not shared
between callers with different credentials. When callers provide abort signals,
one caller can stop waiting without cancelling other callers; the underlying
request is aborted when all waiting callers have aborted, where the transport
supports cancellation. In environments without `AbortController`, requests
still coalesce, but the underlying network operation cannot be cancelled.

The helper requires the standard `Promise`, `URL`, and `fetch` APIs for direct
Horizon fetches. It reports a clear error when those APIs are unavailable or a
URL/key is empty or malformed. Stellar SDK reads keep using the SDK's configured
HTTP adapter. Network endpoint, query parameters, request options, and headers
are part of the request identity: mainnet, testnet, custom endpoints, and callers
with different authorization headers never share an in-flight result. Header
values are used only to compare requests and are not persisted by the coalescer.

No caller migration is needed. Existing data fetching hooks continue to call the
same Stellar client APIs; only concurrent identical reads are combined. Mutating
requests and reads with different request context keep their existing behavior.
