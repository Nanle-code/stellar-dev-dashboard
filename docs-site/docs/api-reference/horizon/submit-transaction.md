---
id: submit-transaction
title: Submit Transaction
sidebar_label: Submit Transaction
---

# POST /transactions

Submit a signed transaction envelope XDR to the Stellar network.

**Base URL:** `https://horizon-testnet.stellar.org` or `https://horizon.stellar.org`

## Request

### Body (application/x-www-form-urlencoded)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tx` | string | ✓ | Base64-encoded signed transaction envelope XDR |

```bash
curl -X POST "https://horizon-testnet.stellar.org/transactions" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "tx=AAAAAgAAAAD...SIGNED_XDR..."
```

```js
import {
  Horizon, TransactionBuilder, Networks,
  Operation, Asset, Keypair
} from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');
const keypair = Keypair.fromSecret('SXXX...YOUR_SECRET');
const sourceAccount = await server.loadAccount(keypair.publicKey());

const tx = new TransactionBuilder(sourceAccount, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.payment({
      destination: 'GDEST...RECIPIENT',
      asset: Asset.native(),
      amount: '10',
    })
  )
  .setTimeout(180)
  .build();

tx.sign(keypair);

try {
  const result = await server.submitTransaction(tx);
  console.log('Hash:', result.hash);
  console.log('Ledger:', result.ledger);
} catch (err) {
  const resultCodes = err.response?.data?.extras?.result_codes;
  console.error('Transaction error:', resultCodes);
}
```

```python
from stellar_sdk import (
    Server, TransactionBuilder, Network,
    Asset, Keypair
)

server = Server("https://horizon-testnet.stellar.org")
keypair = Keypair.from_secret("SXXX...YOUR_SECRET")
source = server.load_account(keypair.public_key)

tx = (
    TransactionBuilder(
        source_account=source,
        network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
        base_fee=100,
    )
    .append_payment_op(
        destination="GDEST...RECIPIENT",
        asset=Asset.native(),
        amount="10",
    )
    .set_timeout(180)
    .build()
)
tx.sign(keypair)

try:
    result = server.submit_transaction(tx)
    print("Hash:", result["hash"])
except Exception as e:
    print("Error:", e)
```

## Success response `200 OK`

```json
{
  "hash": "8c3bcf5273f7c469b61d4ff1ee8deabfe64e223d6a6234b3f86e92ab0310214a",
  "ledger": 5493205,
  "envelope_xdr": "AAAAAgAAAAD...",
  "result_xdr": "AAAAAAAAAGQ...",
  "fee_charged": "100",
  "successful": true
}
```

## Error response `400` — Transaction failed

```json
{
  "type": "https://stellar.org/horizon-errors/transaction_failed",
  "title": "Transaction Failed",
  "status": 400,
  "extras": {
    "result_codes": {
      "transaction": "tx_failed",
      "operations": ["op_no_destination"]
    }
  }
}
```

## Common result codes

### Transaction-level

| Code | Meaning | Fix |
|---|---|---|
| `tx_success` | Included in ledger | — |
| `tx_bad_seq` | Sequence number mismatch | Reload account and rebuild |
| `tx_bad_auth` | Invalid / insufficient signatures | Check signing key and weight |
| `tx_insufficient_balance` | Can't pay the fee | Fund the account |
| `tx_insufficient_fee` | Fee below network minimum | Increase `baseFee` |
| `tx_too_late` | Past `timeBounds.maxTime` | Increase `setTimeout` |

### Operation-level

| Code | Meaning | Fix |
|---|---|---|
| `op_no_destination` | Destination doesn't exist | Create account first |
| `op_no_trust` | Destination has no trustline | Recipient must `changeTrust` |
| `op_underfunded` | Insufficient balance | Reduce amount or fund account |
| `op_low_reserve` | Would drop below minimum reserve | Maintain `(2 + subentries) * 0.5 XLM` |

## Using the dashboard's transaction builder

```ts
import { buildTransaction, signAndSubmitTransaction } from '@/lib/transactionBuilder';

const tx = await buildTransaction({
  sourceAccount: 'GABC...',
  operations: [
    {
      type: 'payment',
      params: { destination: 'GDEST...', assetType: 'native', amount: '10' },
    },
  ],
  memo: 'Hello Stellar',
  memoType: 'text',
  baseFee: 100,
  timeout: 180,
  network: 'testnet',
});

const result = await signAndSubmitTransaction(tx, 'SXXX...SECRET', 'testnet');
console.log('Ledger:', result.ledger);
```
