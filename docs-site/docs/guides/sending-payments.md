---
id: sending-payments
title: Sending Payments
sidebar_label: Sending Payments
---

# Sending Payments

This guide covers every payment pattern on Stellar — native XLM, custom assets, multi-operation batches, and cross-asset path payments.

## Simple XLM payment

```js
import {
  Horizon, TransactionBuilder, Networks, Operation, Asset, Keypair
} from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');
const keypair = Keypair.fromSecret('SXXX...');
const account = await server.loadAccount(keypair.publicKey());

const tx = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.payment({
    destination: 'GDEST...',
    asset: Asset.native(),
    amount: '10',
  }))
  .setTimeout(180)
  .build();

tx.sign(keypair);
const result = await server.submitTransaction(tx);
console.log('Hash:', result.hash);
```

## Custom asset payment

The recipient must have a trustline for the asset before they can receive it.

```js
const usdc = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');

const tx = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.payment({
    destination: 'GDEST...',
    asset: usdc,
    amount: '50',
  }))
  .setTimeout(180)
  .build();
```

## Batch multiple operations in one transaction

Stellar allows up to 100 operations per transaction. They all succeed or all fail atomically.

```js
const tx = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.payment({ destination: 'GDEST1...', asset: Asset.native(), amount: '5' }))
  .addOperation(Operation.payment({ destination: 'GDEST2...', asset: Asset.native(), amount: '5' }))
  .addOperation(Operation.payment({ destination: 'GDEST3...', asset: Asset.native(), amount: '5' }))
  .setTimeout(180)
  .build();
```

## Path payment (cross-asset swap + send)

Send XLM and have the recipient receive USDC, automatically routing through the DEX:

```js
const paths = await server
  .strictSendPaths(Asset.native(), '10', [usdc])
  .call();

const best = paths.records[0];

const tx = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.pathPaymentStrictSend({
    sendAsset: Asset.native(),
    sendAmount: '10',
    destination: 'GDEST...',
    destAsset: usdc,
    destMin: best.destination_amount,
    path: best.path.map(p =>
      p.asset_type === 'native' ? Asset.native() : new Asset(p.asset_code, p.asset_issuer)
    ),
  }))
  .setTimeout(180)
  .build();
```

## Adding a memo

```js
import { Memo } from '@stellar/stellar-sdk';

const builder = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.payment({ ... }))
  .addMemo(Memo.text('Invoice #12345'))  // up to 28 bytes
  .setTimeout(180);
```

## Setting a fee

The minimum fee is 100 stroops (0.00001 XLM) per operation. During network congestion, higher fees get prioritized.

```js
// Check current network fee stats and use the P90 value
const { feeStats } = await fetchNetworkStats('testnet');
const recommendedFee = feeStats.fee_charged.p90;

const tx = new TransactionBuilder(account, {
  fee: recommendedFee,
  networkPassphrase: Networks.TESTNET,
});
```
