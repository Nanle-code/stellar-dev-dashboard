---
id: quick-start
title: Quick Start
sidebar_label: Quick Start
---

# Quick Start

Get your first Stellar API call running in under 5 minutes.

## Prerequisites

- Node.js ≥ 18 **or** Python ≥ 3.9
- A Stellar testnet account (we'll create one below)

---

## Option A — JavaScript / TypeScript

### 1. Install the SDK

```bash
npm install @stellar/stellar-sdk
```

### 2. Create a testnet keypair and fund it

```js
import { Keypair } from '@stellar/stellar-sdk';

// Generate a fresh keypair
const keypair = Keypair.random();
console.log('Public key: ', keypair.publicKey());
console.log('Secret key: ', keypair.secret());

// Fund via Friendbot (testnet only)
const res = await fetch(
  `https://friendbot.stellar.org?addr=${keypair.publicKey()}`
);
const data = await res.json();
console.log('Funded! Tx hash:', data.hash);
```

### 3. Fetch the account

```js
import { Horizon } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');
const account = await server.loadAccount(keypair.publicKey());

console.log('Sequence:', account.sequence);
account.balances.forEach(b => {
  const asset = b.asset_type === 'native' ? 'XLM' : b.asset_code;
  console.log(`${asset}: ${b.balance}`);
});
```

### 4. Send a payment

```js
import { Horizon, TransactionBuilder, Networks, Operation, Asset } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');
const sourceAccount = await server.loadAccount(keypair.publicKey());

const tx = new TransactionBuilder(sourceAccount, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.payment({
      destination: 'GDEST...RECIPIENT_PUBLIC_KEY',
      asset: Asset.native(),
      amount: '10',
    })
  )
  .setTimeout(180)
  .build();

tx.sign(keypair);
const result = await server.submitTransaction(tx);
console.log('Success! Hash:', result.hash);
```

---

## Option B — Python

### 1. Install the SDK

```bash
pip install stellar-sdk
```

### 2. Create a keypair and fund it

```python
from stellar_sdk import Keypair
import urllib.request, json

keypair = Keypair.random()
print("Public:", keypair.public_key)
print("Secret:", keypair.secret)

# Fund via Friendbot
url = f"https://friendbot.stellar.org?addr={keypair.public_key}"
with urllib.request.urlopen(url) as r:
    data = json.loads(r.read())
    print("Funded! Tx hash:", data["hash"])
```

### 3. Fetch the account

```python
from stellar_sdk import Server

server = Server("https://horizon-testnet.stellar.org")
account = server.accounts().account_id(keypair.public_key).call()

for balance in account["balances"]:
    asset = "XLM" if balance["asset_type"] == "native" else balance["asset_code"]
    print(f"{asset}: {balance['balance']}")
```

### 4. Send a payment

```python
from stellar_sdk import Server, TransactionBuilder, Network, Asset

server = Server("https://horizon-testnet.stellar.org")
source = server.load_account(keypair.public_key)

tx = (
    TransactionBuilder(
        source_account=source,
        network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
        base_fee=100,
    )
    .append_payment_op(
        destination="GDEST...RECIPIENT_PUBLIC_KEY",
        asset=Asset.native(),
        amount="10",
    )
    .set_timeout(180)
    .build()
)

tx.sign(keypair)
result = server.submit_transaction(tx)
print("Success! Hash:", result["hash"])
```

---

## What's next

- [Authentication & Wallet Connection](./authentication) — connect Freighter or Ledger
- [Soroban Smart Contracts](../guides/soroban-smart-contracts) — invoke contracts
- [Full API Reference](../api-reference/overview) — every endpoint documented
- [Interactive Explorer](../api-explorer) — test endpoints live in the browser
