---
id: overview
title: Code Examples
sidebar_label: Overview
---

# Code Examples

All examples are **copy-paste ready** and tested against the Stellar Testnet. Replace placeholder keys with your own accounts before running.

## JavaScript / TypeScript examples

| Example | Description |
|---|---|
| [Fetch Account](./js/fetch-account) | Load balances, sequence number, and signers |
| [Send Payment](./js/send-payment) | XLM and custom asset payments |
| [Create Trustline](./js/create-trustline) | Add a trustline to accept a custom asset |
| [Invoke Contract](./js/invoke-contract) | Full Soroban contract invocation flow |
| [DEX Swap](./js/dex-swap) | Path payment via the Stellar DEX |
| [Stream Transactions](./js/stream-transactions) | Real-time SSE streaming with reconnect |

## Python examples

| Example | Description |
|---|---|
| [Fetch Account](./python/fetch-account) | Load account details with standard library |
| [Send Payment](./python/send-payment) | XLM payment with stellar-sdk |
| [Create Trustline](./python/create-trustline) | Add a trustline for a custom asset |
| [Invoke Contract](./python/invoke-contract) | Soroban contract invocation from Python |

## Error scenario examples

| Example | Description |
|---|---|
| [Transaction Failed](./errors/transaction-failed) | Handle `tx_failed` and result codes |
| [Rate Limit](./errors/rate-limit) | Retry with backoff on HTTP 429 |
| [Insufficient Funds](./errors/insufficient-funds) | Detect and report underfunded accounts |

## Running the examples

### JavaScript

```bash
# Install the SDK
npm install @stellar/stellar-sdk

# Run any example (Node.js ≥ 18)
node docs/api/examples/js/send-payment.js SXXX...YOUR_SECRET GDEST...RECIPIENT
```

### Python

```bash
# Install the SDK
pip install stellar-sdk

# Run any example
python docs/api/examples/python/send_payment.py SXXX...YOUR_SECRET GDEST...RECIPIENT
```

## Get a testnet account

```bash
# 1. Generate a keypair
node -e "
const { Keypair } = require('@stellar/stellar-sdk');
const kp = Keypair.random();
console.log('Public:', kp.publicKey());
console.log('Secret:', kp.secret());
"

# 2. Fund it via Friendbot
curl "https://friendbot.stellar.org?addr=GABC...YOUR_PUBLIC_KEY"
```
