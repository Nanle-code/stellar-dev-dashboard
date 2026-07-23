---
id: create-trustline
title: Create Trustline (JS/TS)
sidebar_label: Create Trustline
---

# Create Trustline — JavaScript / TypeScript

A trustline allows an account to hold a custom (non-native) Stellar asset. You must create the trustline before you can receive the asset.

## Add a trustline

```js title="create-trustline.mjs"
import {
  Horizon, TransactionBuilder, Networks,
  Operation, Asset, Keypair
} from '@stellar/stellar-sdk';

async function createTrustline({
  secretKey,
  assetCode,
  assetIssuer,
  limit = undefined, // undefined = maximum limit
}) {
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const asset = new Asset(assetCode, assetIssuer);

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.changeTrust({
        asset,
        // omit limit or pass a string amount to set a custom limit
        ...(limit !== undefined && { limit: String(limit) }),
      })
    )
    .setTimeout(180)
    .build();

  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  console.log('Trustline created! Hash:', result.hash);
  return result.hash;
}

// Example: add USDC trustline
await createTrustline({
  secretKey: process.argv[2],
  assetCode: 'USDC',
  assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
});
```

## Remove a trustline

Set the limit to `'0'` to remove a trustline (balance must be zero first):

```js
async function removeTrustline({ secretKey, assetCode, assetIssuer }) {
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset(assetCode, assetIssuer),
        limit: '0', // removes the trustline
      })
    )
    .setTimeout(180)
    .build();

  tx.sign(keypair);
  return (await server.submitTransaction(tx)).hash;
}
```

## Check if trustline exists

```js
async function hasTrustline(publicKey, assetCode, assetIssuer) {
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  const account = await server.loadAccount(publicKey);

  return account.balances.some(
    b =>
      b.asset_type !== 'native' &&
      b.asset_code === assetCode &&
      b.asset_issuer === assetIssuer
  );
}

const exists = await hasTrustline('GABC...', 'USDC', 'GBBD47IF...');
console.log('Has USDC trustline:', exists);
```

## Using the dashboard's transaction builder

```ts
import { buildTransaction, signAndSubmitTransaction } from '@/lib/transactionBuilder';

const tx = await buildTransaction({
  sourceAccount: 'GABC...',
  operations: [
    {
      type: 'changeTrust',
      params: {
        assetCode: 'USDC',
        assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        // limit: '1000' — optional
      },
    },
  ],
  network: 'testnet',
});

const result = await signAndSubmitTransaction(tx, 'SXXX...SECRET', 'testnet');
```

## Reserve cost

Adding a trustline increases the account's minimum balance by **0.5 XLM** (one subentry). Ensure the account has sufficient balance before calling `changeTrust`.

```
Minimum balance = (2 + subentry_count) * base_reserve
                = (2 + 1) * 0.5 XLM
                = 1.5 XLM
```
