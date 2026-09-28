---
id: advanced-tutorials
title: Advanced Tutorials
sidebar_label: Advanced Tutorials
---

# Advanced Tutorials

## Multi-signature transactions

Multi-sig adds extra security by requiring N-of-M keys to sign before a transaction is valid.

### Set up multi-sig

```js
import { Operation, Keypair } from '@stellar/stellar-sdk';

const primary   = Keypair.fromSecret('SXXX...PRIMARY');
const cosigner1 = Keypair.fromSecret('SXXX...COSIGNER_1');
const cosigner2 = Keypair.fromSecret('SXXX...COSIGNER_2');

const account = await server.loadAccount(primary.publicKey());

// Require 2 of 3 signers for medium-threshold operations (payments)
const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.setOptions({
    medThreshold: 2,
    highThreshold: 3,
    signer: { ed25519PublicKey: cosigner1.publicKey(), weight: 1 },
  }))
  .addOperation(Operation.setOptions({
    signer: { ed25519PublicKey: cosigner2.publicKey(), weight: 1 },
  }))
  .setTimeout(180)
  .build();

tx.sign(primary);
await server.submitTransaction(tx);
```

### Sign with multiple keys

```js
const paymentTx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.payment({ ... }))
  .setTimeout(180)
  .build();

// Primary signer signs first
paymentTx.sign(primary);

// Cosigner signs on their device / separately
paymentTx.sign(cosigner1);

// Now the tx has weight 2 — meets med_threshold
await server.submitTransaction(paymentTx);
```

---

## Fee bump transactions

Re-submit a stuck transaction with a higher fee, paid by a different account:

```js
import { TransactionBuilder } from '@stellar/stellar-sdk';

// Wrap the original (already signed) transaction
const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
  feeSourceKeypair,   // pays the fee
  '500',              // new fee per operation (must be > original)
  originalSignedTx,
  Networks.TESTNET
);

feeBumpTx.sign(feeSourceKeypair);
await server.submitTransaction(feeBumpTx);
```

Using the dashboard helper:

```ts
import { feeBump } from '@/lib/transactionBuilder';

const feeWrapped = feeBump({
  feeSource: 'GABC...FEE_PAYER',
  baseFee: 500,
  innerTransaction: originalTx.toXDR(),
  network: 'testnet',
});
```

---

## Sponsored reserves

Allow one account to pay the XLM reserve on behalf of another:

```js
// Sponsoring account pays the reserve for the new account
const sponsor = Keypair.fromSecret('SXXX...SPONSOR');
const newUser  = Keypair.random();
const account  = await server.loadAccount(sponsor.publicKey());

const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
  // 1. Begin sponsorship
  .addOperation(Operation.beginSponsoringFutureReserves({
    sponsoredId: newUser.publicKey(),
  }))
  // 2. Create the new account (reserve paid by sponsor)
  .addOperation(Operation.createAccount({
    destination: newUser.publicKey(),
    startingBalance: '0',
  }))
  // 3. End sponsorship (new user signs this op)
  .addOperation(Operation.endSponsoringFutureReserves())
  .setTimeout(180)
  .build();

// Both sponsor AND new user must sign
tx.sign(sponsor);
tx.sign(newUser);
await server.submitTransaction(tx);
```

---

## Claimable balances

Create a balance that a specific account can claim later:

```js
import { Claimant } from '@stellar/stellar-sdk';

const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(
    Operation.createClaimableBalance({
      asset: Asset.native(),
      amount: '100',
      claimants: [
        new Claimant(recipientPublicKey, Claimant.predicateUnconditional()),
      ],
    })
  )
  .setTimeout(180)
  .build();

tx.sign(keypair);
const result = await server.submitTransaction(tx);

// The balance ID is in the transaction result
const balanceId = result.offerResults?.[0]?.balanceId;
```

Claim it:

```js
const claimTx = new TransactionBuilder(recipientAccount, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.claimClaimableBalance({ balanceId }))
  .setTimeout(180)
  .build();

claimTx.sign(recipientKeypair);
await server.submitTransaction(claimTx);
```

---

## XDR decoding

Decode raw XDR strings for debugging:

```js
import { xdr, TransactionEnvelope } from '@stellar/stellar-sdk';

// Decode a transaction envelope
const envelope = xdr.TransactionEnvelope.fromXDR(envelopeXdr, 'base64');
const tx = envelope.v1().tx();
console.log('Operations:', tx.operations().length);
console.log('Fee:', tx.fee());

// Decode a Soroban ScVal return value
import { scValToNative } from '@stellar/stellar-sdk';
const val = xdr.ScVal.fromXDR(resultXdr, 'base64');
console.log('Native:', scValToNative(val));
```

---

## Circuit breaker pattern

Protect your app from cascading failures when Horizon is down:

```ts
import { getCircuitBreaker } from '@/lib/errorHandling/CircuitBreaker';

const horizonBreaker = getCircuitBreaker('horizon', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30_000,
});

async function safeLoadAccount(publicKey: string) {
  try {
    return await horizonBreaker.execute(() => server.loadAccount(publicKey));
  } catch (err) {
    if (err.message.includes('Circuit breaker OPEN')) {
      return getCachedAccount(publicKey);  // serve stale cache
    }
    throw err;
  }
}
```
