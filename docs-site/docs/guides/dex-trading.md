---
id: dex-trading
title: DEX Trading
sidebar_label: DEX Trading
---

# DEX Trading

The Stellar DEX is a fully on-chain decentralized exchange. Every offer lives in the ledger and settles atomically with other transactions. No off-chain matching engine or custodian.

## How it works

```
You place an offer → stored on-chain → matched against existing offers
Path payments      → automatically routed through offers + AMM pools
```

## Query the order book

```js
import { Horizon, Asset } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');

const xlm  = Asset.native();
const usdc = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');

const book = await server.orderbook(xlm, usdc).limit(20).call();

console.log('Best ask (sell XLM, buy USDC):', book.asks[0]?.price, 'USDC per XLM');
console.log('Best bid (buy  XLM, sell USDC):', book.bids[0]?.price, 'USDC per XLM');
```

## Place a sell offer

Sell 100 XLM at a price of 0.12 USDC per XLM:

```js
import { Operation } from '@stellar/stellar-sdk';

const tx = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.manageSellOffer({
      selling: xlm,
      buying: usdc,
      amount: '100',      // amount of XLM to sell
      price: '0.12',      // USDC per XLM
      offerId: '0',       // 0 = create new offer
    })
  )
  .setTimeout(180)
  .build();

tx.sign(keypair);
const result = await server.submitTransaction(tx);
```

## Cancel an offer

Set `amount` to `'0'` and pass the `offerId` to cancel:

```js
.addOperation(Operation.manageSellOffer({
  selling: xlm,
  buying: usdc,
  amount: '0',       // amount 0 = cancel
  price: '0.12',
  offerId: '12345678', // the offer ID to cancel
}))
```

## Instant swap via path payment

No need to manage offers manually — path payments auto-route through the best available path:

```js
import { fetchOrderBook } from '@/lib/dex';

// Find best available path
const paths = await server
  .strictSendPaths(xlm, '10', [usdc])
  .call();

const best = paths.records[0];
if (!best) throw new Error('No liquidity path found');

const tx = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.pathPaymentStrictSend({
      sendAsset:   xlm,
      sendAmount:  '10',
      destination: keypair.publicKey(),   // can send to self for a swap
      destAsset:   usdc,
      destMin:     best.destination_amount,
      path:        best.path.map(p =>
        p.asset_type === 'native'
          ? Asset.native()
          : new Asset(p.asset_code, p.asset_issuer)
      ),
    })
  )
  .setTimeout(180)
  .build();
```

## AMM liquidity pools

```ts
import { fetchLiquidityPools, enrichPool, estimatePoolApr } from '@/lib/dex';

const pools = await fetchLiquidityPools('testnet', 50);

for (const pool of pools.records.map(enrichPool)) {
  const { feeApr } = estimatePoolApr(pool, pool.volume24h ?? 0);
  console.log(
    `Pool ${pool.id.slice(0, 8)}`,
    `| TVL $${pool.totalValueUsd?.toFixed(0) ?? '?'}`,
    `| Fee APR ${feeApr.toFixed(2)}%`
  );
}
```

## Fetch recent trades

```ts
import { fetchTrades } from '@/lib/dex';

const trades = await fetchTrades(
  { code: 'XLM', issuer: null },
  { code: 'USDC', issuer: 'GBBD47IF...' },
  'testnet',
  50
);

trades.records.forEach(t => {
  console.log(
    t.base_amount, 'XLM →',
    t.counter_amount, 'USDC @',
    t.price.n / t.price.d
  );
});
```

## Slippage protection

Always set `destMin` (strict-send) or `sendMax` (strict-receive) to limit acceptable slippage:

```js
const expectedOutput = parseFloat(best.destination_amount);
const slippageTolerance = 0.005; // 0.5%
const destMin = (expectedOutput * (1 - slippageTolerance)).toFixed(7);
```
