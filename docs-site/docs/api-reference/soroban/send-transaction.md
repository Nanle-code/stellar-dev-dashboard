---
id: send-transaction
title: sendTransaction
sidebar_label: sendTransaction
---

# sendTransaction

Submit a signed Soroban transaction to the network. This is **asynchronous** — you get back a hash and a `PENDING` status, then must poll [`getTransaction`](./get-transaction) to confirm.

## Request

```bash
curl -s -X POST "https://soroban-testnet.stellar.org" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "send-1",
    "method": "sendTransaction",
    "params": {
      "transaction": "AAAAAgAAAAD...SIGNED_TX_XDR..."
    }
  }'
```

```js
import { SorobanRpc, Keypair } from '@stellar/stellar-sdk';

const rpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const keypair = Keypair.fromSecret('SXXX...SECRET');

// After simulate + prepare:
preparedTx.sign(keypair);

const sendResult = await rpc.sendTransaction(preparedTx);
console.log('Hash:', sendResult.hash);
console.log('Status:', sendResult.status); // "PENDING"

// Poll for confirmation
let status = sendResult;
while (status.status === 'PENDING' || status.status === 'NOT_FOUND') {
  await new Promise(r => setTimeout(r, 2000));
  status = await rpc.getTransaction(sendResult.hash);
}

if (status.status === 'SUCCESS') {
  console.log('Contract call succeeded!');
  console.log('Return value:', status.returnValue);
} else {
  console.error('Failed:', status.resultXdr);
}
```

```python
import time
from stellar_sdk import SorobanServer, Keypair

server = SorobanServer("https://soroban-testnet.stellar.org")
keypair = Keypair.from_secret("SXXX...SECRET")

# After simulate + prepare:
prepared_tx.sign(keypair)

send_result = server.send_transaction(prepared_tx)
print("Hash:", send_result.hash)

# Poll
while True:
    result = server.get_transaction(send_result.hash)
    if result.status != "PENDING":
        break
    time.sleep(2)

print("Final status:", result.status)
```

## Response

```json
{
  "jsonrpc": "2.0",
  "id": "send-1",
  "result": {
    "hash": "4a737f...TX_HASH...",
    "status": "PENDING",
    "latestLedger": 5493222,
    "latestLedgerCloseTime": 1772491200
  }
}
```

## Status values

| Status | Meaning |
|---|---|
| `PENDING` | Accepted, not yet in a ledger |
| `SUCCESS` | Included and execution succeeded |
| `FAILED` | Included but contract execution failed |
| `NOT_FOUND` | Unknown hash — too early or expired |
| `DUPLICATE` | Already submitted this transaction |
| `TRY_AGAIN_LATER` | Node overloaded, retry shortly |
| `ERROR` | Rejected at submission (invalid XDR, bad sig, etc.) |

:::caution Retry on PENDING
`PENDING` does not mean failure. Poll `getTransaction` every 2–5 seconds until the status is `SUCCESS` or `FAILED`.
:::
