# @stellar-dev-dashboard/core

Platform-agnostic Stellar core logic shared between the web app and mobile app.

## Overview

This package contains all platform-agnostic Stellar functionality that was previously duplicated between `src/lib/stellar/` (web) and `mobile/src/services/stellar.ts` (mobile). By extracting this into a shared workspace package, we eliminate parity issues and ensure consistent behavior across platforms.

## Package Structure

```
packages/core/
├── src/
│   ├── index.ts              # Main exports
│   ├── networks.ts           # Network configuration & server creation
│   ├── types/index.ts        # Shared TypeScript types
│   ├── validation.ts         # Input validation (addresses, amounts, memos, etc.)
│   ├── formatters.ts         # Formatting utilities (XLM, addresses, dates, etc.)
│   ├── addresses.ts          # Address validation & resolution
│   ├── reserves.ts           # Account reserve calculations
│   ├── operationLabels.ts    # Operation type labels
│   └── services.ts           # High-level data fetching services
├── __tests__/                # Test suite
├── dist/                     # Compiled output (generated)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Installation

```bash
# Already part of the pnpm workspace
pnpm install
```

## Usage

### Web App (src/)

```typescript
import {
  NETWORKS,
  getServer,
  getSorobanServer,
  validateStellarAddress,
  formatXLM,
  shortAddress,
  calculateAccountReserves,
  fetchAccount,
  fetchTransactions,
  fetchNetworkStats,
  OPERATION_LABELS,
  getOperationLabel,
  type NetworkName,
  type AccountData,
  type NetworkStats,
} from '@stellar-dev-dashboard/core';
```

### Mobile App (mobile/)

```typescript
import {
  NETWORKS,
  getServer,
  getSorobanServer,
  isValidPublicKey,
  shortAddress,
  formatXLM,
  calculateAccountReserves,
  fetchAccount,
  fetchTransactions,
  fetchNetworkStats,
  OPERATION_LABELS,
  getOperationLabel,
  type NetworkName,
  type AccountData,
  type NetworkStats,
} from '@stellar-dev-dashboard/core';
```

## API Reference

### Networks

#### Types

```typescript
type NetworkName = 'mainnet' | 'testnet' | 'futurenet' | 'local' | 'custom';

interface NetworkConfig {
  name: string;
  horizonUrl: string;
  sorobanUrl?: string;
  passphrase: string;
  faucetUrl?: string;
  customHeaders?: Record<string, string>;
  headers?: Record<string, string>;
  capabilities?: NetworkCapabilities;
}
```

#### Constants

- `NETWORKS` - Record of all network configurations
- `StellarSdk` - Re-exported Stellar SDK

#### Functions

- `getNetworkConfig(network: NetworkName): NetworkConfig` - Get network configuration
- `updateCustomNetworkConfig(config: Partial<NetworkConfig>): void` - Update custom network
- `getServer(network?: NetworkName): StellarSdk.Horizon.Server` - Create Horizon server
- `getSorobanServer(network?: NetworkName): StellarSdk.SorobanRpc.Server` - Create Soroban RPC server

### Validation

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

type MemoType = 'none' | 'text' | 'id' | 'hash' | 'return';
```

#### Functions

- `validateStellarAddress(value: unknown): ValidationResult` - Validate G..., M..., or federated address
- `validateAmount(value: unknown, min?, max?): ValidationResult` - Validate payment amount (max 7 decimals)
- `validateMemo(value: unknown, type?: MemoType): ValidationResult` - Validate transaction memo
- `validateContractId(value: unknown): ValidationResult` - Validate contract ID (C...)
- `validateNetwork(value: unknown): ValidationResult` - Validate network name
- `validateUrl(value: unknown, required?: boolean): ValidationResult` - Validate HTTP/HTTPS URL
- `validateHorizonUrl(value: unknown): ValidationResult` - Validate Horizon URL
- `validateSorobanUrl(value: unknown, required?: boolean): ValidationResult` - Validate Soroban URL
- `validateNetworkPassphrase(value: unknown, required?: boolean): ValidationResult` - Validate passphrase
- `composeValidations(...results: ValidationResult[]): ValidationResult` - Combine multiple validations

### Formatters

- `formatXLM(amount: string | number): string` - Format XLM amount (2-7 decimals, commas)
- `shortAddress(addr: string | null, chars?: number): string` - Truncate address (default 6 chars each side)
- `formatStroops(stroops: unknown): string` - Format stroops as XLM with stroops count
- `formatInstructions(instructions: number): string` - Format instruction count (K/M suffixes)
- `formatBytes(bytes: number): string` - Format bytes (KB/MB suffixes)
- `formatDate(dateStr: string): string` - Format ISO date string
- `formatRelativeTime(timestamp: number): string` - Format relative time (just now, Xm ago, Xh ago, Xd ago)

### Addresses

#### Types

```typescript
interface MemoRequirementResult {
  required: boolean;
  checked: boolean;
  error?: string;
}

interface ResolvedAddress {
  accountId: string;
  muxedId?: string;
  originalInput: string;
  inputType: 'ed25519' | 'muxed' | 'federated';
  federatedAddress?: string;
  memoId?: string;
  memoType?: string;
}
```

#### Functions

- `isValidEd25519PublicKey(key: string): boolean` - Check G... address
- `isValidMuxedAccount(key: string): boolean` - Check M... address
- `isFederatedAddress(input: string): boolean` - Check name*domain or email format
- `parseMuxedAccount(muxedAddress: string): { masterAccount, muxedId } | null` - Parse muxed account
- `checkDestinationMemoRequirement(destination, network?): Promise<MemoRequirementResult>` - SEP-29 memo check
- `resolveFederatedAddress(federatedAddress, network?): Promise<{accountId, memoId?, memoType?} | null>` - Resolve federation
- `resolveAddress(input, network?): Promise<ResolvedAddress | null>` - Universal address resolver
- `isValidPublicKey(key: string): boolean` - Validate any supported format (G..., M..., federated)
- `isValidContractId(id: string): boolean` - Validate contract ID (C...)

### Reserves

```typescript
interface AccountReserves {
  baseReserve: number;
  signerReserve: number;
  assetReserve: number;
  offerReserve: number;
  subentryReserve: number;
  totalReserves: number;
  availableBalance: number;
  totalBalance: number;
}
```

- `calculateAccountReserves(accountData, networkStats, offerCount?): AccountReserves` - Calculate all reserves

### Operation Labels

- `OPERATION_LABELS` - Record mapping operation types to human-readable labels
- `getOperationLabel(type: string): string` - Get label for operation type (formats unknown types)

### Services

#### Types

```typescript
interface TransactionFetchResult {
  records: TransactionRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}
```

#### Functions

- `fetchAccount(publicKey, network?): Promise<AccountData>` - Fetch account with caching
- `fetchTransactions(publicKey, network?, limit?, cursor?): Promise<TransactionFetchResult>` - Fetch transactions
- `fetchNetworkStats(network?): Promise<NetworkStats>` - Fetch network stats
- `fundTestnetAccount(publicKey): Promise<any>` - Fund testnet account via friendbot
- `fetchXLMPrice(): Promise<{usd: number}>` - Fetch XLM price from CoinGecko
- `clearCache(pattern?): void` - Clear internal cache

## Testing

```bash
# Run core tests
cd packages/core
pnpm test

# Run with coverage
pnpm test:coverage

# Type check
pnpm type-check

# Lint
pnpm lint
```

## Migration Notes

### From Web App (src/lib/stellar/)

The following modules now re-export from core:
- `networks.ts` - Core network config, `getServer`, `getSorobanServer`
- `formatters.ts` - Core formatters (`formatXLM`, `shortAddress`, etc.)
- `addresses.ts` - Core address utilities (`isValidPublicKey`, `resolveAddress`, etc.)
- `reserves.ts` - Core `calculateAccountReserves`
- `validation.ts` - Core validators (most functions now delegate to core)

Web-specific features remain in `src/lib/stellar/`:
- `rateLimitedFetch` - Requires browser APIs (`window`, `fetch`, `AbortController`)
- `probeAllNetworks` - Requires browser APIs
- Custom network auth headers - Uses `sessionStorage`
- Request coalescing & rate limiting - Web-specific infrastructure

### From Mobile App (mobile/src/services/stellar.ts)

The mobile app now imports from core and only keeps:
- `AsyncStorage`-based caching wrapper functions
- `fetchOperations` - Not yet in core (Horizon-specific)

Removed from mobile (now in core):
- `NETWORKS` config
- `getServer` / `getSorobanServer`
- `isValidPublicKey` / `shortAddress` / `formatXLM`
- `fetchAccount` / `fetchTransactions` / `fetchNetworkStats` / `fetchXLMPrice`
- `calculateAccountReserves`
- `OPERATION_LABELS` / `getOperationLabel`

### Compatibility

- **Node.js**: >=22 <27
- **Platforms**: Browser (web), React Native (mobile), Node.js (scripts)
- **No dependencies** on: `window`, `document`, `localStorage`, `sessionStorage`, React, React Native

### Security

- No private key handling
- No transaction signing
- Network requests use standard `fetch` (polyfill needed for Node.js <18)
- Input validation on all public functions

## Development

```bash
# Build
pnpm run build

# Watch mode
pnpm run build:watch

# Run tests in watch mode
pnpm run test:watch
```

## Publishing

```bash
# From workspace root
cd packages/core
pnpm run build
pnpm run test
pnpm publish --access public
```