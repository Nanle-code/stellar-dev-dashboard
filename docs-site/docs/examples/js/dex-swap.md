---
id: dex-swap
title: DEX Swap — Path Payment (JS/TS)
sidebar_label: DEX Swap
---

# DEX Swap — Path Payment

Swap one asset for another using the Stellar DEX via path payments. The network automatically finds the best route through available offers and liquidity pools.

## Strict-send path payment

Send an exact amount and receive the best possible output:

```js title="dex-swap-strict-send.mjs"
import {
  Horizon, TransactionBuilder, Networks,
  Operation, Asset, Keypair
} from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';

/**
 * Swap by sending an exact sendAmount of sendAsset,
 * receiving at least destMin of destAsset.
 */
async function strictSendSwap({
  secretKey,
  sendAssetCode,   // 'XLM' or asset code
  sendAssetIssuer, // null for XLM
  destAssetCode,
  destAssetIssuer,
  sendAmount,
  destMin,         // minimum acceptable receive amount
  destination,     // recipient (can be same as sender)
}) {
  const server = new Horizon.Server(HORIZON_URL);
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const sendAsset = sendAssetCode === 'XLM'
    ? Asset.native()
    : new Asset(sendAssetCode, sendAssetIssuer);

  const destAsset = destAssetCode === 'XLM'
    ? Asset.native()
    : new Asset(destAssetCode, destAssetIssuer);

  // Find the best path via Horizon
  const paths = await server
    .strictSendPaths(sendAsset, String(sendAmount), [destAsset])
    .call();

  if (!paths.records.length) {
    throw new Error('No path found between these assets');
  }

  const bestPath = paths.records[0];
  console.log('Best path will yield:', bestPath.destination_amount, destAssetCode);

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset,
        sendAmount: String(sendAmount),
        destination: destination ?? keypair.publicKey(),
        destAsset,
        destMin: String(destMin),
        path: bestPath.path.map(p =>
          p.asset_type === 'native'
            ? Asset.native()
            : new Asset(p.asset_code, p.asset_issuer)
        ),
      })
    )
    .setTimeout(180)
    .build();

  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  console.log('Swap complete! Hash:', result.hash);
  return result.hash;
}

// Example: swap 10 XLM for USDC, accepting at least 1 USDC
await strictSendSwap({
  secretKey: process.argv[2],
  sendAssetCode: 'XLM',
  sendAssetIssuer: null,
  destAssetCode: 'USDC',
  destAssetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  sendAmount: '10',
  destMin: '1',
});
```

## Strict-receive path payment

Receive an exact amount, spending as little of the send asset as possible:

```js title="dex-swap-strict-receive.mjs"
async function strictReceiveSwap({
  secretKey,
  sendAssetCode,
  sendAssetIssuer,
  destAssetCode,
  destAssetIssuer,
  sendMax,       // maximum you are willing to spend
  destAmount,    // exact amount to receive
  destination,
}) {
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const sendAsset = sendAssetCode === 'XLM'
    ? Asset.native()
    : new Asset(sendAssetCode, sendAssetIssuer);

  const destAsset = destAssetCode === 'XLM'
    ? Asset.native()
    : new Asset(destAssetCode, destAssetIssuer);

  const paths = await server
    .strictReceivePaths([sendAsset], destAsset, String(destAmount))
    .call();

  if (!paths.records.length) throw new Error('No path found');

  const bestPath = paths.records[0];

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset,
        sendMax: String(sendMax),
        destination: destination ?? keypair.publicKey(),
        destAsset,
        destAmount: String(destAmount),
        path: bestPath.path.map(p =>
          p.asset_type === 'native'
            ? Asset.native()
            : new Asset(p.asset_code, p.asset_issuer)
        ),
      })
    )
    .setTimeout(180)
    .build();

  tx.sign(keypair);
  return (await server.submitTransaction(tx)).hash;
}
```

## Query the order book

```js
import { fetchOrderBook } from '@/lib/dex';

const orderBook = await fetchOrderBook(
  { code: 'XLM', issuer: null },        // selling
  { code: 'USDC', issuer: 'GBBD47IF...' }, // buying
  'testnet',
  20 // depth
);

console.log('Best ask:', orderBook.asks[0]);
console.log('Best bid:', orderBook.bids[0]);
console.log('Spread:', orderBook.spread);
```

## Estimate swap output before executing

```js
// Check paths and expected output before committing
const paths = await server
  .strictSendPaths(Asset.native(), '10', [new Asset('USDC', 'GBBD47...')])
  .call();

paths.records.forEach(p => {
  console.log(`Path via ${p.path.length} hops → receive ${p.destination_amount} USDC`);
});
```
