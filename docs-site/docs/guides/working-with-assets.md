---
id: working-with-assets
title: Working with Assets
sidebar_label: Working with Assets
---

# Working with Assets

Every token on Stellar other than XLM is a **custom asset** defined by a code and an issuer account.

## Asset types

| Type | Description | Example |
|---|---|---|
| `native` | XLM — the network's base currency | `Asset.native()` |
| `credit_alphanum4` | 1–4 character code | `USDC`, `BTC`, `ETH` |
| `credit_alphanum12` | 5–12 character code | `LONGASSET` |

## Creating an asset

```js
import { Asset } from '@stellar/stellar-sdk';

const xlm  = Asset.native();
const usdc = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
const btc  = new Asset('BTC',  'GAUTUYY2THLF7SGITDFMXJVYH3LHDSMGEAKSBU267M2K7A3W543CKUEF');
```

## Add a trustline (required before receiving)

```js
import { Operation } from '@stellar/stellar-sdk';

const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.changeTrust({ asset: usdc }))
  .setTimeout(180)
  .build();
```

## Issue your own asset

```js
// The issuing account defines the asset
const issuerKeypair = Keypair.random();
const holderKeypair = Keypair.random();
const myToken = new Asset('MYTKN', issuerKeypair.publicKey());

// 1. Fund both accounts
await fetch(`https://friendbot.stellar.org?addr=${issuerKeypair.publicKey()}`);
await fetch(`https://friendbot.stellar.org?addr=${holderKeypair.publicKey()}`);

// 2. Holder creates trustline
const holderAccount = await server.loadAccount(holderKeypair.publicKey());
const trustTx = new TransactionBuilder(holderAccount, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.changeTrust({ asset: myToken, limit: '1000000' }))
  .setTimeout(180)
  .build();
trustTx.sign(holderKeypair);
await server.submitTransaction(trustTx);

// 3. Issuer mints tokens to holder
const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
const mintTx = new TransactionBuilder(issuerAccount, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.payment({
    destination: holderKeypair.publicKey(),
    asset: myToken,
    amount: '10000',
  }))
  .setTimeout(180)
  .build();
mintTx.sign(issuerKeypair);
await server.submitTransaction(mintTx);
```

## Search for assets

```ts
import { fetchAllAssets } from '@/lib/dex';

// Search assets by code
const assets = await fetchAllAssets('testnet', 200);
const usdcResults = assets.filter(a => a.asset_code === 'USDC');
```

## Get trustline recommendations

```ts
import { getTrustlineRecommendations } from '@/lib/stellar';

const recommendations = await getTrustlineRecommendations('GABC...', 'testnet');
// Returns popular verified assets the account hasn't added yet
```

## Asset flags (issuer controls)

| Flag | Effect |
|---|---|
| `auth_required` | Holders need explicit approval from issuer |
| `auth_revocable` | Issuer can freeze/unfreeze individual trustlines |
| `auth_immutable` | Flags can never be changed again |
| `auth_clawback_enabled` | Issuer can claw back tokens from any holder |

```js
const tx = new TransactionBuilder(issuerAccount, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.setOptions({
    setFlags: 1,    // AUTH_REQUIRED_FLAG = 1
  }))
  .setTimeout(180)
  .build();
```
