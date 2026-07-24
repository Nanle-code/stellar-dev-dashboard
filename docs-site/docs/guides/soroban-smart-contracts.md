---
id: soroban-smart-contracts
title: Soroban Smart Contracts
sidebar_label: Soroban Smart Contracts
---

# Soroban Smart Contracts

Soroban is Stellar's smart contract platform. Contracts are written in Rust, compiled to WASM, and deployed on-chain. This guide covers invoking deployed contracts from JavaScript and Python.

## Prerequisites

- A funded testnet account
- The **contract ID** of a deployed contract (e.g. `CBXG...`)
- `@stellar/stellar-sdk` ≥ 12.x (includes Soroban RPC support)

## The invocation lifecycle

Every contract call follows this sequence:

```
loadAccount → buildTx → simulateTx → prepareTx → sign → sendTx → poll
```

Never skip `simulateTransaction` — it computes the resource footprint that Soroban needs to execute the transaction.

## Step-by-step walkthrough

### Step 1 — Build the unsigned transaction

```js
import { SorobanRpc, TransactionBuilder, Networks, Contract, nativeToScVal, Keypair } from '@stellar/stellar-sdk';

const rpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const keypair = Keypair.fromSecret('SXXX...');
const account = await rpc.getAccount(keypair.publicKey());

const contract = new Contract('CBXG...CONTRACT_ID');
const tx = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    contract.call('transfer',
      nativeToScVal('GABC...FROM', { type: 'address' }),
      nativeToScVal('GDEST...TO', { type: 'address' }),
      nativeToScVal(1000n, { type: 'i128' }),
    )
  )
  .setTimeout(30)
  .build();
```

### Step 2 — Simulate

```js
const simResult = await rpc.simulateTransaction(tx);

if (SorobanRpc.Api.isSimulationError(simResult)) {
  throw new Error(`Simulation error: ${simResult.error}`);
}

console.log('Estimated fee:', simResult.minResourceFee, 'stroops');
```

### Step 3 — Prepare (inject footprint + auth)

```js
const preparedTx = await rpc.prepareTransaction(tx);
```

### Step 4 — Sign and send

```js
preparedTx.sign(keypair);
const sendResult = await rpc.sendTransaction(preparedTx);
```

### Step 5 — Poll for confirmation

```js
import { scValToNative } from '@stellar/stellar-sdk';

let result;
do {
  await new Promise(r => setTimeout(r, 3000));
  result = await rpc.getTransaction(sendResult.hash);
} while (result.status === 'NOT_FOUND');

if (result.status === 'SUCCESS') {
  console.log('Return value:', scValToNative(result.returnValue));
}
```

## Authorization

Contracts can require caller authorization. The `prepareTransaction` call handles `auth` injection for simple cases. For contracts that require explicit auth (`requireAuth()`), you may need multi-party signing:

```js
// After prepare, check if auth is needed
const preparedTx = await rpc.prepareTransaction(tx);
const authEntries = preparedTx.operations[0].auth ?? [];

for (const entry of authEntries) {
  // Sign each auth entry with the appropriate key
  entry.credentials.address().signature = keypair.sign(
    hash(xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(...).toXDR())
  );
}
```

## Deploying a contract

```js
import { SorobanRpc, TransactionBuilder, Networks, Operation, Keypair } from '@stellar/stellar-sdk';
import { readFileSync } from 'node:fs';

const wasm = readFileSync('my_contract.wasm');

// 1. Upload the WASM
const uploadTx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.uploadContractWasm({ wasm }))
  .setTimeout(30)
  .build();

// simulate → prepare → sign → send → poll (same flow as invoke)
const wasmHash = result.returnValue; // SHA-256 hash of the WASM

// 2. Instantiate the contract
const createTx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.createContractV2({
    address: keypair.publicKey(),
    wasmHash,
    constructorArgs: [],
  }))
  .setTimeout(30)
  .build();

// simulate → prepare → sign → send → poll
const contractId = result.returnValue; // new contract ID
```

## Using the dashboard's contractInvoker

```ts
import { invokeContractFunction, parseContractWasm } from '@/lib/contractInvoker';

// Inspect contract ABI
const abi = await parseContractWasm('CBXG...CONTRACT_ID', 'testnet');
console.log('Functions:', abi.functions.map(f => f.name));

// Invoke
const returnValue = await invokeContractFunction({
  contractId: 'CBXG...CONTRACT_ID',
  functionName: 'increment',
  args: [nativeToScVal(1, { type: 'u32' })],
  network: 'testnet',
  secretKey: 'SXXX...',
});
```

## Troubleshooting

| Error | Likely cause | Fix |
|---|---|---|
| `Simulation failed: HostError: Value(InvalidInput)` | Wrong argument types | Check the contract ABI and ScVal types |
| `tx_bad_seq` | Stale sequence number | Reload account before building |
| `FAILED` status with `invokeVmFunction` | Contract logic rejected the call | Check contract-level conditions |
| No return value | Function returns `()` (unit) | Expected — `returnValue` will be null |
