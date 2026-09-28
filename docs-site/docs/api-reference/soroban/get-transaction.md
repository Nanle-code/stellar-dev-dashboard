---
id: get-transaction
title: getTransaction
sidebar_label: getTransaction
---

# getTransaction

Poll for the result of a previously submitted Soroban transaction.

## Request

```bash
curl -s -X POST "https://soroban-testnet.stellar.org" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "poll-1",
    "method": "getTransaction",
    "params": {
      "hash": "4a737f...TX_HASH..."
    }
  }'
```

```js
const result = await rpc.getTransaction('4a737f...TX_HASH...');

if (result.status === 'SUCCESS') {
  // Decode the return value
  const returnVal = result.returnValue;
  console.log('Return value:', returnVal);
}
```

## Response — SUCCESS

```json
{
  "jsonrpc": "2.0",
  "id": "poll-1",
  "result": {
    "status": "SUCCESS",
    "latestLedger": 5493230,
    "latestLedgerCloseTime": 1772491260,
    "ledger": 5493229,
    "createdAt": 1772491255,
    "applicationOrder": 1,
    "feeBump": false,
    "envelopeXdr": "AAAAAgAAAAD...",
    "resultXdr": "AAAAAAAAAGQAAAABAAAADAAAABAAAAABAAAAAgAAAA8AAAAE...",
    "resultMetaXdr": "AAAAAwAAAA...",
    "returnValue": {
      "u32": 42
    }
  }
}
```

## Response — FAILED

```json
{
  "jsonrpc": "2.0",
  "id": "poll-1",
  "result": {
    "status": "FAILED",
    "latestLedger": 5493230,
    "resultXdr": "AAAAAAAAAPr...",
    "resultMetaXdr": "AAAAAwAAAA..."
  }
}
```

## Decoding the return value

```js
import { scValToNative } from '@stellar/stellar-sdk';

if (result.status === 'SUCCESS' && result.returnValue) {
  const native = scValToNative(result.returnValue);
  console.log('Native value:', native); // e.g. 42n (BigInt for u32/i128)
}
```
