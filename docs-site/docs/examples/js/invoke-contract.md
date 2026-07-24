---
id: invoke-contract
title: Invoke Soroban Contract (JS/TS)
sidebar_label: Invoke Contract
---

# Invoke Soroban Contract — JavaScript / TypeScript

Full flow: simulate → prepare → sign → send → poll for result.

## Complete invocation example

```js title="invoke-contract.mjs"
import {
  SorobanRpc,
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  scValToNative,
  Keypair,
} from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const CONTRACT_ID = 'CBXG...YOUR_CONTRACT_ID';

async function invokeContract({ secretKey, functionName, args = [] }) {
  const rpc = new SorobanRpc.Server(RPC_URL);
  const keypair = Keypair.fromSecret(secretKey);

  // 1. Load account
  const account = await rpc.getAccount(keypair.publicKey());
  const contract = new Contract(CONTRACT_ID);

  // 2. Build unsigned transaction
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(30)
    .build();

  // 3. Simulate
  const simResult = await rpc.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  console.log('Estimated fee:', simResult.minResourceFee, 'stroops');
  console.log('CPU insns:    ', simResult.cost?.cpuInsns);
  console.log('Memory bytes: ', simResult.cost?.memBytes);

  // 4. Prepare (inject footprint + auth + optimal fee)
  const preparedTx = await rpc.prepareTransaction(tx);

  // 5. Sign
  preparedTx.sign(keypair);

  // 6. Send
  const sendResult = await rpc.sendTransaction(preparedTx);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Send failed: ${sendResult.errorResult}`);
  }

  console.log('Submitted. Hash:', sendResult.hash);

  // 7. Poll until confirmed
  let txResult;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    txResult = await rpc.getTransaction(sendResult.hash);
    if (txResult.status !== 'NOT_FOUND') break;
  }

  if (txResult.status === 'SUCCESS') {
    const returnValue = txResult.returnValue
      ? scValToNative(txResult.returnValue)
      : null;
    console.log('Return value:', returnValue);
    return returnValue;
  }

  throw new Error(`Transaction failed: ${txResult.resultXdr}`);
}

// Example: call an "increment" function with a u32 argument
await invokeContract({
  secretKey: process.argv[2],
  functionName: 'increment',
  args: [nativeToScVal(1, { type: 'u32' })],
});
```

## TypeScript version with typed args

```ts title="invoke-contract.ts"
import {
  SorobanRpc,
  TransactionBuilder,
  Networks,
  Contract,
  xdr,
  scValToNative,
  Keypair,
} from '@stellar/stellar-sdk';

interface InvokeParams {
  secretKey: string;
  contractId: string;
  functionName: string;
  args?: xdr.ScVal[];
  network?: 'testnet' | 'mainnet';
}

const RPC_URLS = {
  testnet: 'https://soroban-testnet.stellar.org',
  mainnet: 'https://soroban-rpc.stellar.org',
};

const PASSPHRASES = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
};

async function invokeContract(params: InvokeParams): Promise<unknown> {
  const { secretKey, contractId, functionName, args = [], network = 'testnet' } = params;
  const rpc = new SorobanRpc.Server(RPC_URLS[network]);
  const keypair = Keypair.fromSecret(secretKey);
  const account = await rpc.getAccount(keypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: PASSPHRASES[network],
  })
    .addOperation(new Contract(contractId).call(functionName, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) throw new Error(sim.error);

  const prepared = await rpc.prepareTransaction(tx);
  prepared.sign(keypair);

  const sent = await rpc.sendTransaction(prepared);
  if (sent.status === 'ERROR') throw new Error(String(sent.errorResult));

  // Poll
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const result = await rpc.getTransaction(sent.hash);
    if (result.status === 'SUCCESS') {
      return result.returnValue ? scValToNative(result.returnValue) : null;
    }
    if (result.status === 'FAILED') throw new Error(result.resultXdr as string);
  }

  throw new Error('Transaction polling timed out');
}
```

## Using the dashboard's contractInvoker

```ts
import { invokeContractFunction } from '@/lib/contractInvoker';
import { nativeToScVal } from '@stellar/stellar-sdk';

const result = await invokeContractFunction({
  contractId: 'CBXG...YOUR_CONTRACT_ID',
  functionName: 'transfer',
  args: [
    nativeToScVal('GABC...FROM', { type: 'address' }),
    nativeToScVal('GDEST...TO', { type: 'address' }),
    nativeToScVal(1000n, { type: 'i128' }),
  ],
  network: 'testnet',
  secretKey: 'SXXX...SECRET',
});

console.log('Transfer result:', result);
```

## Common ScVal type conversions

```ts
import { nativeToScVal, scValToNative } from '@stellar/stellar-sdk';

// u32 integer
nativeToScVal(42, { type: 'u32' })

// i128 (BigInt)
nativeToScVal(1_000_000n, { type: 'i128' })

// Address (account or contract)
nativeToScVal('GABC...', { type: 'address' })

// Symbol (used for map keys and identifiers)
nativeToScVal('Counter', { type: 'symbol' })

// Boolean
nativeToScVal(true, { type: 'bool' })

// Bytes
nativeToScVal(Buffer.from('hello'), { type: 'bytes' })

// Decode return value to native JS
const native = scValToNative(returnValue);
```
