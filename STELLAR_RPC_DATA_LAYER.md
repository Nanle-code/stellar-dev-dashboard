# Stellar RPC-First Data Layer Integration Guide

## Overview

The **Stellar RPC-First Data Layer** (`StellarReadSource`) provides unified, RPC-first reading of Stellar ledgers (`getLedgers`), transactions (`getTransactions`), and Soroban contract events (`getEvents`), with seamless fallback to Horizon endpoints when available.

This architecture enables:
1. **RPC-Only Network Deployments**: Support custom Stellar networks and Soroban-heavy workflows running Soroban RPC without Horizon.
2. **Capability-Aware UI**: Automatically hiding or labeling views that an active data source cannot serve (e.g. Account Offers on RPC-only networks).
3. **Retention Limit Awareness**: Showing clear visual badges and banners when queries approach or exceed Stellar RPC's history retention window (~100,000 ledgers limit).

---

## Core Architecture

### Data Access Abstraction (`src/lib/stellar/types.ts`)

To avoid naming collisions with offline caching (`DataSource` in `src/lib/offlineReadOnly.ts`), the data layer abstraction is named `StellarReadSource`:

```typescript
export interface StellarReadSource {
  getLedgers(params?: GetLedgersParams): Promise<GetLedgersResult>;
  getTransactions(params?: GetTransactionsParams): Promise<GetTransactionsResult>;
  getEvents(params?: GetEventsParams): Promise<GetEventsResult>;
  getAccountOffers(accountId: string, params?: GetOffersParams): Promise<GetOffersResult>;
  getCapabilities(): NetworkCapabilities;
}
```

### Implementations

1. **`HorizonReadSource`** (`src/lib/stellar/horizonReadSource.ts`):
   Uses `StellarSdk.Horizon.Server` for full historical access and DEX account offers.
2. **`RpcReadSource`** (`src/lib/stellar/rpcReadSource.ts`):
   Uses `StellarSdk.SorobanRpc.Server` / Stellar RPC JSON-RPC endpoints (`getLedgers`, `getTransactions`, `getEvents`). Enforces retention window awareness (~100,000 ledgers).
3. **`RpcFirstReadSource`** (`src/lib/stellar/rpcFirstReadSource.ts`):
   Attempts RPC calls first for ledgers, transactions, and events. Automatically falls back to Horizon if RPC fails or history precedes the RPC retention window.

---

## Capabilities Matrix

| Feature / Data View | Stellar RPC Source | Stellar Horizon Source | RPC-First (Fallback) |
| :--- | :--- | :--- | :--- |
| **`getLedgers`** | ✅ Supported (Recent window) | ✅ Supported (Full history) | ⚡ RPC-First + Horizon Fallback |
| **`getTransactions`** | ✅ Supported (Recent window) | ✅ Supported (Full history) | ⚡ RPC-First + Horizon Fallback |
| **`getEvents`** | ✅ Supported (Soroban/System) | ✅ Supported | ⚡ RPC-First + Horizon Fallback |
| **Account Offers / DEX** | ❌ Unsupported (Horizon required) | ✅ Supported | 🔄 Horizon Only |
| **Retention Window** | ~100,000 Ledgers | Full Network History | Seamless Fallback |

---

## Network Profiles Integration (`src/lib/environmentProfiles.ts`)

Every network profile declares its data source capabilities via `NetworkCapabilities`:

```typescript
export interface NetworkCapabilities {
  ledgers: boolean;
  transactions: boolean;
  events: boolean;
  accountOffers: boolean;
  fullHistory: boolean;
  defaultReadSource: 'rpc' | 'horizon';
  retentionLimitLedgers?: number;
}
```

### Usage Example

```typescript
import { getStellarReadSource, evaluateReadSourceCapabilities } from './lib/stellar';

// Get RPC-first data source for active network
const dataLayer = getStellarReadSource('testnet', 'rpc-first');

// Fetch recent ledgers
const { ledgers, source, fallbackUsed } = await dataLayer.getLedgers({ limit: 10 });
console.log(`Loaded ${ledgers.length} ledgers using ${source} source (Fallback: ${fallbackUsed})`);

// Inspect active network capabilities
const { capabilities } = evaluateReadSourceCapabilities('testnet');
if (!capabilities.accountOffers) {
  console.warn('Account offers view is disabled on this RPC-only profile');
}
```

---

## UI Components & Retention Messaging

- **`DataSourceCapabilityBadge`** (`src/components/common/DataSourceCapabilityBadge.tsx`):
  Displays active data source (`RPC` vs `Horizon`) and capability indicators in the dashboard toolbar and view headers.
- **`RpcRetentionBanner`** (`src/components/common/RpcRetentionBanner.tsx`):
  Alerts developers when operating in Stellar RPC mode or when pagination reaches the ~100,000 ledgers history boundary.

---

## Developer Testing & Contract Tests

Contract tests verify that both Horizon and RPC implementations produce identical normalized data objects:
- Test Fixtures: `src/fixtures/stellarReadSourceFixtures.ts`
- Contract Tests: `src/lib/__tests__/stellarReadSource.test.ts`

Run contract test suite:
```bash
npx vitest run src/lib/__tests__/stellarReadSource.test.ts
```
