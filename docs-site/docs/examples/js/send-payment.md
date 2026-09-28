---
id: send-payment
title: Send Payment (JS/TS)
sidebar_label: Send Payment
---

# Send Payment — JavaScript / TypeScript

Send XLM or a custom asset between Stellar accounts.

## XLM payment

```js title="send-xlm.mjs"
import {
  Horizon, TransactionBuilder, Networks,
  Operation, Asset, Keypair, Memo
} from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';

async function sendXlmPayment({ secretKey, destination, amount, memo }) {
  const server = new Horizon.Server(HORIZON_URL);
  const keypair = Keypair.fromSecret(secretKey);
  const sourceAccount = await server.loadAccount(keypair.publicKey());

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  }).addOperation(
    Operation.payment({
      destination,
      asset: Asset.native(),
      amount: String(amount),
    })
  );

  if (memo) {
    txBuilder.addMemo(Memo.text(memo));
  }

  const tx = txBuilder.setTimeout(180).build();
  tx.sign(keypair);

  const result = await server.submitTransaction(tx);
  return {
    hash: result.hash,
    ledger: result.ledger,
    fee: result.fee_charged,
  };
}

// Run
const result = await sendXlmPayment({
  secretKey: process.argv[2],
  destination: process.argv[3],
  amount: process.argv[4] ?? '10',
  memo: process.argv[5],
});
console.log('Success:', result);
```

## Custom asset payment

```js title="send-asset-payment.mjs"
import {
  Horizon, TransactionBuilder, Networks,
  Operation, Asset, Keypair
} from '@stellar/stellar-sdk';

async function sendAssetPayment({
  secretKey,
  destination,
  assetCode,
  assetIssuer,
  amount,
}) {
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  const keypair = Keypair.fromSecret(secretKey);
  const sourceAccount = await server.loadAccount(keypair.publicKey());
  const asset = new Asset(assetCode, assetIssuer);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({ destination, asset, amount: String(amount) })
    )
    .setTimeout(180)
    .build();

  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}
```

## Error handling

```js
try {
  const result = await server.submitTransaction(tx);
  console.log('Hash:', result.hash);
} catch (err) {
  if (err.response?.status === 400) {
    const codes = err.response.data.extras?.result_codes;
    console.error('Transaction failed:', codes?.transaction);
    console.error('Operations:', codes?.operations);

    switch (codes?.transaction) {
      case 'tx_bad_seq':
        console.error('→ Reload the account and rebuild the transaction');
        break;
      case 'tx_insufficient_fee':
        console.error('→ Increase baseFee (currently:', '100', 'stroops)');
        break;
      case 'tx_bad_auth':
        console.error('→ Check that the signing key matches the source account');
        break;
    }
  } else {
    console.error('Network error:', err.message);
  }
}
```

## TypeScript with strict types

```ts title="payment.ts"
import {
  Horizon, TransactionBuilder, Networks,
  Operation, Asset, Keypair
} from '@stellar/stellar-sdk';

interface PaymentParams {
  secretKey: string;
  destination: string;
  asset: Asset;
  amount: string;
  network?: 'testnet' | 'mainnet';
}

const HORIZON_URLS = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

const NETWORK_PASSPHRASES = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
};

async function sendPayment(params: PaymentParams): Promise<string> {
  const { secretKey, destination, asset, amount, network = 'testnet' } = params;

  const server = new Horizon.Server(HORIZON_URLS[network]);
  const keypair = Keypair.fromSecret(secretKey);
  const source = await server.loadAccount(keypair.publicKey());

  const tx = new TransactionBuilder(source, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASES[network],
  })
    .addOperation(Operation.payment({ destination, asset, amount }))
    .setTimeout(180)
    .build();

  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}
```
