# Sandbox Analytics Datasets (#908)

Provides production-grade, anonymized Stellar Horizon account and DEX trade datasets designed for sandbox demos, offline simulation, and educational materials without requiring live Mainnet credentials, secret keys, or active network connectivity.

## Overview

Live Stellar dashboard analytics previously relied on querying live Horizon RPC nodes with active credentials. For workshops, offline development, public demos, and unit test suites, this introduced rate limiting, credential exposure risks, and unpredictable network latency.

The sandbox analytics module (`src/fixtures/sandboxDatasets.ts` and `src/lib/sandboxAnalytics.ts`) introduces deterministic, synthetic account and market trade fixtures with comprehensive analytics calculation and strict environment safeguards.

## Architecture & Modules

```
src/
├── fixtures/
│   └── sandboxDatasets.ts      # Anonymized accounts & trade datasets
├── lib/
│   ├── sandboxAnalytics.ts     # Service with validation, metrics, & env guards
│   └── __tests__/
│       └── sandboxAnalytics.test.ts  # 30+ tests covering primary, boundary & failure cases
├── components/
│   └── dashboard/
│       └── SandboxAnalyticsDemo.tsx  # Interactive UI demo tab
tests/
└── __factories__/
    └── sandboxFixtures.js      # Test factories & builders for external test suites
```

---

## Datasets Provided

### 1. Account Archetypes

| Archetype                    | Public Key (`id`) | Holdings             | Purpose                                              |
| ---------------------------- | ----------------- | -------------------- | ---------------------------------------------------- |
| `retail_active`              | `GA7QY...TAX`     | XLM, USDC, AQUA      | Active retail trader with diversified token balances |
| `institutional_market_maker` | `GBRPY...X2H`     | XLM, USDC, EURT, BTC | High-volume market maker with 2-of-3 multisig policy |
| `soroban_dapp_treasury`      | `GCKFJ...EMO`     | XLM, USDC, AQUA      | Smart contract protocol treasury with high reserves  |
| `new_onboarded_sandbox`      | `GD3Y6...BRD`     | Native XLM (10,000)  | Clean onboarding account funded via Friendbot        |

### 2. Trade Datasets (Chronological Time Series)

- **`XLM / USDC`**: Orderbook and AMM trades exhibiting normal market progression, price variance, and buy/sell pressure.
- **`AQUA / XLM`**: Community asset DEX trades combining orderbook fills and liquidity pool swaps.
- **`BTC / USDC`**: Cross-asset synthetic pairs for multi-currency analytics testing.

---

## API Reference

### Account Retrieval

```ts
import { getSandboxAccounts, getSandboxAccountById } from '../lib/sandboxAnalytics';

// Fetch all accounts or filter by archetype / asset
const retail = getSandboxAccounts({ archetype: 'retail_active' });
const withAqua = getSandboxAccounts({ assetCode: 'AQUA' });

// Fetch by specific public key
const account = getSandboxAccountById('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVTAX');
```

### Trade Retrieval & Analytics Aggregation

```ts
import { getSandboxTrades, calculateTradeMetrics } from '../lib/sandboxAnalytics';

// Query trade flow
const trades = getSandboxTrades({
  baseAsset: 'XLM',
  counterAsset: 'USDC',
  tradeType: 'orderbook', // or 'liquidity_pool'
  limit: 20,
});

// Compute market analytics
const metrics = calculateTradeMetrics(trades);
// -> { tradeCount, totalVolumeBase, vwap, openPrice, closePrice, highPrice, lowPrice, ... }
```

### Portfolio Valuation & Diversification

```ts
import { calculatePortfolioMetrics } from '../lib/sandboxAnalytics';

const portfolio = calculatePortfolioMetrics(account);
// -> { totalValueUsd, allocations, diversificationScore, concentrationRisks }
```

---

## Error Handling & Failure Paths

The service implements clear error handling via `SandboxDatasetError` with typed error codes:

| Error Code                | Trigger Condition                                                                                             | Handling / Behavior                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `UNSUPPORTED_ENVIRONMENT` | Invoking queries when `environment` is `mainnet`, `production`, or `public` without `allowMainnetDemo: true`. | Fails closed to avoid confusing mock data with live mainnet balances. |
| `INVALID_INPUT`           | Negative `limit` or `offset`, `startTime > endTime`, invalid date format, or malformed public key format.     | Throws `SandboxDatasetError` with descriptive validation message.     |
| `DATASET_NOT_FOUND`       | Valid public key queried that does not exist in the sandbox registry.                                         | Throws `SandboxDatasetError('DATASET_NOT_FOUND')`.                    |
| `VALIDATION_FAILED`       | Ingesting malformed datasets lacking required Horizon properties or numeric amounts.                          | Throws `SandboxDatasetError('VALIDATION_FAILED')`.                    |

---

## Compatibility

- **Environments**: Supported on `testnet`, `futurenet`, `local`, `standalone`, `sandbox`, `development`, and `test`. Blocked on `mainnet`/`production` unless explicitly permitted with `allowMainnetDemo: true`.
- **Runtimes**: Node.js `>=22.0.0` (tested on Node 22, 24, 26) and modern ES2020+ browser runtimes.
- **Dependencies**: Zero external runtime network dependencies; fully self-contained in TypeScript.

---

## Security Notes

1. **Zero Secret Keys**: All public keys are deterministic, synthetic Ed25519 addresses. No private keys (`S...` seed format) exist or are exposed.
2. **Mainnet Safeguards**: The built-in environment guard prevents accidental leakage or presentation of mock figures in live Mainnet sessions.
3. **No PII or External Linking**: Account names, archetypes, and transactions are purely fictionalized and decoupled from real-world wallet identities.

---

## Migration

1. Replace ad-hoc mock objects in test files with standard fixtures from `tests/__factories__/sandboxFixtures.js`.
2. Update dashboard components to use `getSandboxAccounts` and `getSandboxTrades` when running in offline or sandbox mode.
3. Use `calculateTradeMetrics` for consistent Volume-Weighted Average Price (VWAP) and OHLC calculations across charts.

---

## Example Usage

```ts
import {
  getSandboxTrades,
  calculateTradeMetrics,
  getSandboxAccountById,
  calculatePortfolioMetrics,
} from '../lib/sandboxAnalytics';
import { ANONYMIZED_ADDRESSES } from '../fixtures/sandboxDatasets';

// 1. Load institutional account and inspect diversification
const mmAccount = getSandboxAccountById(ANONYMIZED_ADDRESSES.MARKET_MAKER);
const portfolio = calculatePortfolioMetrics(mmAccount);

console.log(`Total Portfolio Value: $${portfolio.totalValueUsd}`);
console.log(`Diversification Score: ${portfolio.diversificationScore}/100`);

// 2. Fetch trade history and calculate VWAP
const trades = getSandboxTrades({ baseAsset: 'XLM', counterAsset: 'USDC' });
const marketMetrics = calculateTradeMetrics(trades);

console.log(`VWAP: $${marketMetrics.vwap}`);
console.log(`Price Change: ${marketMetrics.priceChangePercent}%`);
```
