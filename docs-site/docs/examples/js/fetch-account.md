---
id: fetch-account
title: Fetch Account (JS/TS)
sidebar_label: Fetch Account
---

# Fetch Account — JavaScript / TypeScript

Load account balances, sequence number, thresholds, and signers.

## Runnable script

Save as `fetch-account.mjs` and run with `node fetch-account.mjs GABC...PUBLIC_KEY`

```js title="fetch-account.mjs"
import { Horizon } from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';

async function fetchAccount(publicKey) {
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(publicKey);

  console.log('Account ID:   ', account.id);
  console.log('Sequence:     ', account.sequence);
  console.log('Subentries:   ', account.subentry_count);
  console.log('\nBalances:');
  for (const b of account.balances) {
    const asset = b.asset_type === 'native' ? 'XLM' : `${b.asset_code}:${b.asset_issuer.slice(0, 8)}...`;
    console.log(`  ${asset.padEnd(20)} ${b.balance}`);
  }

  console.log('\nSigners:');
  for (const s of account.signers) {
    console.log(`  ${s.key}  weight=${s.weight}`);
  }

  return account;
}

const publicKey = process.argv[2];
if (!publicKey) {
  console.error('Usage: node fetch-account.mjs <PUBLIC_KEY>');
  process.exit(1);
}

fetchAccount(publicKey).catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
```

## TypeScript version

```ts title="fetch-account.ts"
import { Horizon } from '@stellar/stellar-sdk';

const NETWORKS = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
} as const;

type Network = keyof typeof NETWORKS;

interface AccountSummary {
  id: string;
  sequence: string;
  xlmBalance: string;
  assetCount: number;
}

async function fetchAccount(
  publicKey: string,
  network: Network = 'testnet'
): Promise<AccountSummary> {
  const server = new Horizon.Server(NETWORKS[network]);
  const account = await server.loadAccount(publicKey);

  const xlm = account.balances.find(b => b.asset_type === 'native');
  const assets = account.balances.filter(b => b.asset_type !== 'native');

  return {
    id: account.id,
    sequence: account.sequence,
    xlmBalance: xlm?.balance ?? '0',
    assetCount: assets.length,
  };
}

// Usage
const summary = await fetchAccount('GABC...PUBLIC_KEY', 'testnet');
console.log(summary);
```

## Using the dashboard helper

The dashboard's `stellar.ts` layer adds caching and circuit-breaking:

```ts
import { fetchAccount } from '@/lib/stellar';

// Automatically cached for 30s, protected by circuit breaker
const account = await fetchAccount('GABC...PUBLIC_KEY', 'testnet');
```

## Example output

```
Account ID:    GABC...PUBLIC_KEY
Sequence:      125893021482
Subentries:    2

Balances:
  XLM                  1240.4019234
  USDC:GBBDQG4G...      500.0000000

Signers:
  GABC...PUBLIC_KEY  weight=1
```
