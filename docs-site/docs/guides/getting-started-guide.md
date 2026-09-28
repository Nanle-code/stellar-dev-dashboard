---
id: getting-started-guide
title: Getting Started Guide
sidebar_label: Getting Started
---

# Getting Started Guide

This guide walks through the complete setup from zero to your first live API call against the Stellar testnet.

## 1. Set up your environment

### Node.js

```bash
node --version   # must be ≥ 18
npm install @stellar/stellar-sdk
```

### Python

```bash
python --version  # must be ≥ 3.9
pip install stellar-sdk
```

## 2. Create a testnet account

```js
import { Keypair } from '@stellar/stellar-sdk';

const keypair = Keypair.random();
console.log('Public key:', keypair.publicKey());
console.log('Secret key:', keypair.secret());
// ⚠️  Save these somewhere safe — you can't recover the secret key
```

Fund it with Friendbot (testnet only — free 10,000 XLM):

```bash
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
```

## 3. Verify the account exists

```js
import { Horizon } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');
const account = await server.loadAccount(keypair.publicKey());

console.log('XLM balance:', account.balances.find(b => b.asset_type === 'native')?.balance);
```

## 4. Send your first payment

```js
import { TransactionBuilder, Networks, Operation, Asset } from '@stellar/stellar-sdk';

// Create a second account to receive the payment
const recipient = Keypair.random();
await fetch(`https://friendbot.stellar.org?addr=${recipient.publicKey()}`);

// Send 10 XLM from keypair → recipient
const tx = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.payment({
      destination: recipient.publicKey(),
      asset: Asset.native(),
      amount: '10',
    })
  )
  .setTimeout(180)
  .build();

tx.sign(keypair);
const result = await server.submitTransaction(tx);
console.log('Done! Hash:', result.hash);
```

## 5. Explore what you can build

| Feature | Guide |
|---|---|
| Custom assets | [Working with Assets](./working-with-assets) |
| Smart contracts | [Soroban Smart Contracts](./soroban-smart-contracts) |
| DEX trading | [DEX Trading](./dex-trading) |
| Error handling | [Error Handling](./error-handling) |
| Advanced transactions | [Transaction Templates](./transaction-templates) |

## Common pitfalls for new developers

- **Wrong network** — Testnet and Mainnet are completely separate. Keys and balances don't cross over.
- **Stale sequence number** — Always reload the account right before building a transaction.
- **No trustline** — You can't receive a custom asset without first running `changeTrust`.
- **Below minimum reserve** — Keep at least `(2 + subentry_count) * 0.5 XLM` in every account.
- **Transaction expired** — `setTimeout(30)` is too short under load. Use 180 seconds or more.
