# Fee Strategy Dry-Run Comparison Guide

## Overview
The **Fee Strategy Dry-Run Comparison** feature in Stellar Dev Dashboard enables developers and traders to simulate and compare transaction outcomes across **Low (Economy)**, **Medium (Standard)**, and **High (Priority)** fee strategies *before signing or submitting to the network*.

## Objectives & Benefits
- **Success Likelihood Prediction**: Model probability of successful transaction inclusion under varying network congestion levels.
- **Cost vs. Latency Optimization**: Quantify exact stroop and XLM cost differences against estimated inclusion times.
- **Pre-Flight Safety**: Validate operation payloads, destination accounts, and balance sufficiency prior to ledger submission.
- **One-Click Strategy Selection**: Seamlessly apply optimized fee strategies directly into the Transaction Builder.

---

## Strategy Tier Breakdown

| Strategy Tier | Fee Multiplier / Base Fee | Target Latency | Congestion Resilience | Recommended Scenario |
| :--- | :--- | :--- | :--- | :--- |
| **Low (Economy)** | 100 stroops (Minimum base) | ~15–30s (2–3 ledgers) | Low–Moderate | Non-urgent batch ops, off-peak hours (<40% network load) |
| **Medium (Standard)** | Dynamic load-adjusted rate | ~5–10s (Next ledger) | Moderate | Default everyday transactions, reliable regular operations |
| **High (Priority)** | +35% to +75% surge buffer | <5s (Immediate priority) | High (Surge protected) | Critical DeFi actions, arbitrage, peak congestion (>85% load) |

---

## Developer API: `compareFeeStrategiesDryRun`

### Import
```typescript
import {
  compareFeeStrategiesDryRun,
  type CompareFeeStrategiesParams,
  type FeeStrategyComparisonReport
} from '@/lib/stellar';
```

### Method Signature
```typescript
async function compareFeeStrategiesDryRun(
  params: CompareFeeStrategiesParams
): Promise<FeeStrategyComparisonReport>
```

### Parameters
```typescript
interface CompareFeeStrategiesParams {
  sourceAccount?: string;                         // Valid Ed25519 public key (G...)
  operations?: Array<Record<string, unknown>>;    // Array of operation payloads
  memo?: string;                                  // Optional memo
  timeBounds?: Record<string, unknown> | null;    // Optional time bounds
  network?: string;                               // 'testnet' | 'mainnet' | 'futurenet' | 'local' | 'custom'
  currentLedgerLoad?: number;                     // Network congestion factor: 0.0 to 1.5 (default: 0.55)
  accountBalance?: number | string;               // Account balance in stroops or XLM to check coverage
  customFeeOverrides?: {                          // Optional manual fee overrides per tier
    low?: number;
    medium?: number;
    high?: number;
  };
  isOffline?: boolean;                            // Explicit offline simulation mode flag
}
```

### Return Structure: `FeeStrategyComparisonReport`
```typescript
interface FeeStrategyComparisonReport {
  valid: boolean;
  isUnsupportedEnvironment: boolean;
  environmentError?: string;
  validationErrors: string[];
  validationWarnings: string[];
  strategies: {
    low: FeeStrategyDryRunResult;
    medium: FeeStrategyDryRunResult;
    high: FeeStrategyDryRunResult;
  };
  strategyList: FeeStrategyDryRunResult[];
  recommendedTier: 'low' | 'medium' | 'high';
  currentLedgerLoad: number;
  operationCount: number;
  baseSimulationSuccess: boolean;
  executionTrace: ExecutionTraceStep[];
  timestamp: string;
}
```

---

## Edge Cases & Error Handling

### 1. Invalid Input Handling
- **Missing / Malformed Public Keys**: Validated against Ed25519 checksum. Returns clear error: `"Source account is not a valid ed25519 public key."`
- **Empty Operations**: Requires at least one operation. Returns: `"At least one operation is required for fee strategy comparison."`
- **Operation Validation**: Validates destination addresses, positive payment amounts, and minimum starting balances (1 XLM minimum for `createAccount`).

### 2. Unsupported Environments
- **Offline Mode**: Automatically detects `navigator.onLine === false` or `isOffline: true`. Flags `isUnsupportedEnvironment: true` and informs developer that simulation is operating in estimation-only offline mode.
- **Unknown Network**: Validates against supported Stellar networks (`mainnet`, `testnet`, `futurenet`, `local`, `custom`). Returns specific unsupported network error message.

### 3. Insufficient Account Balance
- Checks total fee against provided `accountBalance`. When balance is below total fee, sets `canCoverFee: false` and emits warning alerting user before signing.

---

## Migration & Backward Compatibility
- All existing `simulateTransaction()` and `runAdvancedTransactionSimulation()` functions remain fully supported without breaking changes.
- `compareFeeStrategiesDryRun` is exported directly alongside standard Stellar SDK tools in `src/lib/stellar.ts`.
