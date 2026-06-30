---
id: stream-transactions
title: Stream Transactions (JS/TS)
sidebar_label: Stream Transactions
---

# Stream Transactions — Real-time SSE

Horizon exposes Server-Sent Events (SSE) streams so you can receive new transactions, operations, and ledger closes in real time without polling.

## Stream account transactions

```js title="stream-transactions.mjs"
import { Horizon } from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';

function streamAccountTransactions(publicKey, onTransaction) {
  const server = new Horizon.Server(HORIZON_URL);

  // cursor='now' means only receive new transactions from this moment
  const closeStream = server
    .transactions()
    .forAccount(publicKey)
    .cursor('now')
    .stream({
      onmessage: tx => {
        console.log('[TX]', tx.hash, '— Ledger:', tx.ledger);
        onTransaction(tx);
      },
      onerror: err => {
        console.error('[SSE error]', err);
        // The SDK automatically reconnects on stream errors
      },
    });

  // Return the close function to stop streaming
  return closeStream;
}

// Usage
const stopStream = streamAccountTransactions(
  process.argv[2], // public key
  tx => {
    console.log('New transaction:', tx.hash);
    console.log('  Memo:    ', tx.memo);
    console.log('  Fee:     ', tx.fee_charged, 'stroops');
    console.log('  Success: ', tx.successful);
  }
);

// Stop after 60 seconds
setTimeout(() => {
  stopStream();
  console.log('Stream closed.');
}, 60_000);
```

## Stream ledger closes

```js
function streamLedgers(onLedger) {
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');

  return server
    .ledgers()
    .cursor('now')
    .stream({
      onmessage: ledger => {
        console.log(
          `Ledger ${ledger.sequence} closed`,
          `— ${ledger.operation_count} ops`,
          `— Base fee: ${ledger.base_fee_in_stroops} stroops`
        );
        onLedger(ledger);
      },
    });
}
```

## Stream with auto-reconnect and backoff

```ts title="resilient-stream.ts"
import { Horizon } from '@stellar/stellar-sdk';

interface StreamOptions {
  publicKey: string;
  onTransaction: (tx: Horizon.ServerApi.TransactionRecord) => void;
  onError?: (err: unknown) => void;
  maxReconnectAttempts?: number;
}

function createResilientStream(options: StreamOptions): () => void {
  const { publicKey, onTransaction, onError, maxReconnectAttempts = 10 } = options;
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');

  let closeStream: () => void;
  let reconnectAttempts = 0;
  let lastCursor = 'now';
  let stopped = false;

  function connect() {
    closeStream = server
      .transactions()
      .forAccount(publicKey)
      .cursor(lastCursor)
      .stream({
        onmessage: tx => {
          reconnectAttempts = 0; // reset on success
          lastCursor = tx.paging_token; // track cursor for reconnect
          onTransaction(tx);
        },
        onerror: err => {
          onError?.(err);
          if (stopped || reconnectAttempts >= maxReconnectAttempts) return;

          const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000);
          reconnectAttempts++;
          console.warn(`Stream error. Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
          setTimeout(connect, delay);
        },
      });
  }

  connect();

  return () => {
    stopped = true;
    closeStream?.();
  };
}
```

## Using the dashboard's streaming module

```ts
import { startAccountStream, stopAccountStream } from '@/lib/streaming';

// Start streaming for the connected account
startAccountStream('GABC...PUBLIC_KEY', {
  onTransaction: tx => console.log('New tx:', tx.hash),
  onOperation: op => console.log('New op:', op.type),
  network: 'testnet',
});

// Stop when unmounting
stopAccountStream('GABC...PUBLIC_KEY');
```

:::tip Cursor management
Save `tx.paging_token` as the cursor when reconnecting so you don't miss transactions that arrived during a disconnect.
:::
