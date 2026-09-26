# Stellar Dev Dashboard — API Reference

This directory documents the public JavaScript modules exposed by the dashboard.

## Modules

| Module | Description |
|--------|-------------|
| [stellar.js](./stellar.md) | Horizon & Soroban RPC wrappers with caching and rate limiting |
| [storage.js](./storage.md) | Persistent IndexedDB storage with localStorage fallback |
| [encryption.js](./encryption.md) | AES-GCM encryption for sensitive local data |
| [tutorialSystem.js](./tutorial.md) | Guided tours and contextual help system |
| [multisig.js](./multisig.md) | Multi-signature transaction coordination |
| [priceFeed.js](./priceFeed.md) | XLM and asset price feeds |
| [transactionBuilder.js](./transactionBuilder.md) | Multi-operation transaction builder and simulator |
| [transactionTemplates.js](./transactionTemplates.md) | Pre-built transaction templates |
| [riskRules.js](./riskRules.md) | Declarative pre-sign risk ruleset with plain-language descriptions |
| [riskSummary.js](./riskSummary.md) | Assembles the ruleset into a per-transaction pre-sign risk summary |
| [import.js / export.js](./dataExport.md) | Dashboard backup, export, and import utilities |

## Quick Start

```js
import { fetchAccount, fetchTransactions } from './src/lib/stellar';
import { getStoredValue, setStoredValue } from './src/lib/storage';
import { encrypt, decrypt } from './src/lib/encryption';
```

## Authentication & Keys

Never store secret keys in plaintext. Use the `encrypt` module to store sensitive data:

```js
import { encrypt, decrypt } from './src/lib/encryption';

// Encrypt before storing
const { ciphertext, iv, salt } = await encrypt(secretKey, userPassphrase);
await setStoredValue('encrypted_key', { ciphertext, iv, salt });

// Decrypt when needed
const stored = await getStoredValue('encrypted_key');
const secretKey = await decrypt(stored.ciphertext, userPassphrase, stored.iv, stored.salt);
```

## Rate Limiting

All Horizon API calls are rate-limited per identifier (user ID or IP). The default limit is configurable in `src/lib/rateLimiter.js`. When a limit is exceeded, calls throw an error with `error.statusCode === 429` and `error.retryAfter` in milliseconds.

## Caching

API responses are cached in IndexedDB with configurable TTLs:

| Data Type | Default TTL |
|-----------|-------------|
| Account | 60 seconds |
| Transactions | 30 seconds |
| Ledger | 5 seconds |
| Assets | 5 minutes |
| Network stats | 1 hour |
| XLM price | 30 seconds |

## Networks

```js
import { NETWORKS } from './src/lib/stellar';

// NETWORKS.mainnet — production Stellar network
// NETWORKS.testnet — test network (free, safe for development)
```
