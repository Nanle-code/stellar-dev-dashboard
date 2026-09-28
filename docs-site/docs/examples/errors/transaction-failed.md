---
id: transaction-failed
title: Handling Transaction Failures
sidebar_label: Transaction Failed
---

# Handling Transaction Failures

When a Horizon transaction submission fails with HTTP `400`, the response body contains `result_codes` that pinpoint the exact failure.

## JavaScript

```js title="handle-tx-failure.mjs"
import { Horizon, TransactionBuilder, Networks, Operation, Asset, Keypair } from '@stellar/stellar-sdk';

async function sendWithErrorHandling(secretKey, destination, amount) {
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.payment({ destination, asset: Asset.native(), amount }))
    .setTimeout(180)
    .build();

  tx.sign(keypair);

  try {
    const result = await server.submitTransaction(tx);
    console.log('✓ Success. Hash:', result.hash);
    return result;
  } catch (err) {
    if (!err.response) {
      // Network error — no response from Horizon
      console.error('Network error:', err.message);
      throw err;
    }

    const { status, data } = err.response;

    if (status === 400) {
      const codes = data.extras?.result_codes ?? {};
      const txCode = codes.transaction;
      const opCodes = codes.operations ?? [];

      console.error('Transaction failed. Code:', txCode);

      switch (txCode) {
        case 'tx_bad_seq':
          // Sequence number is stale — reload account and retry
          console.error('→ Sequence mismatch. Reload account and rebuild.');
          break;

        case 'tx_bad_auth':
          console.error('→ Invalid or missing signature.');
          break;

        case 'tx_insufficient_balance':
          console.error('→ Account cannot cover the fee. Fund the account.');
          break;

        case 'tx_insufficient_fee':
          console.error('→ Fee too low. Increase baseFee.');
          break;

        case 'tx_too_late':
          console.error('→ Transaction expired. Increase setTimeout.');
          break;

        case 'tx_failed':
          // Individual operations failed — inspect opCodes
          opCodes.forEach((opCode, i) => {
            console.error(`  Operation [${i}]: ${opCode}`);

            switch (opCode) {
              case 'op_no_destination':
                console.error('  → Destination account does not exist.');
                break;
              case 'op_no_trust':
                console.error('  → Destination has no trustline for this asset.');
                break;
              case 'op_underfunded':
                console.error('  → Insufficient balance for this operation.');
                break;
              case 'op_low_reserve':
                console.error('  → Would drop account below minimum XLM reserve.');
                break;
            }
          });
          break;

        default:
          console.error('→ Unknown code:', txCode);
      }
    } else if (status === 504) {
      console.error('Timeout — transaction may still be processing. Check by hash.');
    } else {
      console.error(`HTTP ${status}:`, data);
    }

    throw err;
  }
}
```

## Python

```python title="handle_tx_failure.py"
from stellar_sdk.exceptions import BadRequestError


def send_with_error_handling(server, tx, keypair):
    tx.sign(keypair)

    try:
        response = server.submit_transaction(tx)
        print("Success! Hash:", response["hash"])
        return response
    except BadRequestError as exc:
        codes = exc.extras.get("result_codes", {})
        tx_code = codes.get("transaction")
        op_codes = codes.get("operations", [])

        print(f"Transaction failed: {tx_code}")

        MESSAGES = {
            "tx_bad_seq": "Reload account and rebuild transaction.",
            "tx_bad_auth": "Check signing key and weight thresholds.",
            "tx_insufficient_balance": "Fund the source account.",
            "tx_insufficient_fee": "Increase base_fee.",
            "tx_too_late": "Increase set_timeout().",
        }
        if tx_code in MESSAGES:
            print("→", MESSAGES[tx_code])

        for i, op_code in enumerate(op_codes):
            print(f"  Operation[{i}]: {op_code}")

        raise
```

## Using the dashboard's error handler

```ts
import { classifyError, ErrorCategory } from '@/lib/errorHandling';

try {
  await server.submitTransaction(tx);
} catch (err) {
  const ctx = classifyError(err);

  console.log('Category:', ctx.category);   // e.g. 'VALIDATION'
  console.log('Retryable:', ctx.retryable);
  console.log('Message:', ctx.userMessage);

  if (ctx.category === ErrorCategory.VALIDATION) {
    // Show user-friendly error in UI
  }
  if (ctx.retryable) {
    // Schedule retry with backoff
  }
}
```
