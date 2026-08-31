---
id: horizon-pagination
title: Horizon Pagination with Resumable Cursors
sidebar_label: Horizon Pagination
---

# Horizon Pagination with Resumable Cursors

`src/utils/horizonPagination.ts` wraps any paginated Horizon list endpoint
(transactions, operations, payments, ledgers, offers, ...) in a small helper
that tracks a cursor checkpoint across pages, so a long-running iteration can
be persisted and picked back up later — after a page reload, a background job
restart, or a crash — instead of starting over from the beginning.

It also retries transient Horizon failures (`429` and `5xx`) with exponential
backoff via the existing [`RetryManager`](./error-handling.md), and validates
cursors and Horizon URLs before they're used.

## Why not just call `.cursor()` directly?

The SDK's `CallBuilder.cursor()` pattern (used throughout `src/lib/stellar.ts`)
works fine for a single page, but every call site ends up re-implementing the
same three things: tracking `paging_token` as the next cursor, deciding when a
page is the last one, and retrying `429`/`5xx` responses. `HorizonPaginator`
centralizes that so new call sites don't have to.

## Basic usage

`HorizonPaginator` is transport-agnostic — you provide a `fetchPage` function
that performs the actual Horizon request (typically an SDK `CallBuilder`), and
the paginator drives it:

```ts
import { createHorizonPaginator } from '@/utils/horizonPagination';
import { getServer } from '@/lib/stellar';

const server = getServer('testnet');

const paginator = createHorizonPaginator(
  async ({ cursor, limit, order }) => {
    const request = server.transactions().forAccount(publicKey).order(order).limit(limit);
    if (cursor) request.cursor(cursor);
    const { records } = await request.call();
    return { records };
  },
  { limit: 50, order: 'asc' },
);

// Pull one page at a time...
const firstPage = await paginator.nextPage();

// ...or stream every record until the collection ends.
for await (const tx of paginator.stream()) {
  console.log(tx.id);
}
```

## Persisting and resuming a checkpoint

`getCursor()` returns the `paging_token` of the last record seen — save it
wherever fits your app (localStorage, a database row, a job's state blob).
Pass it back in as `initialCursor` (or call `resumeFromCursor`) to continue
exactly where you left off:

```ts
// Before the tab closes / the job stops:
localStorage.setItem('tx-cursor:' + publicKey, paginator.getCursor() ?? '');

// On the next run:
const savedCursor = localStorage.getItem('tx-cursor:' + publicKey);
const resumed = createHorizonPaginator(fetchPage, {
  limit: 50,
  initialCursor: savedCursor || undefined,
});

// Or, on an existing instance:
paginator.resumeFromCursor(savedCursor);
```

`resumeFromCursor` validates the cursor before accepting it — an empty string,
a value containing whitespace, or anything that isn't a syntactically valid
Horizon paging token throws immediately rather than silently sending a bad
request to Horizon.

## Validation

- **Cursors** — `isValidCursor` / `validateCursor` accept Horizon's numeric
  TOID tokens (e.g. `"12884901888"`) and the literal `"now"`; anything else is
  rejected. Both the `initialCursor` option and every `paging_token` the
  fetcher returns are validated, so a malformed upstream response fails fast
  instead of corrupting the checkpoint.
- **Horizon URLs** — if you pass `horizonUrl` (purely for validation — the
  paginator doesn't make requests itself), `validateHorizonUrl` requires
  `https://` (or `http://localhost`/`127.0.0.1` for local development) and,
  when you pass `allowedHosts`, restricts it to a known set of nodes.

## Retry behavior

Retries are delegated to the shared `RetryManager`
(`src/lib/errorHandling/RetryManager.ts` — exponential backoff, ±10% jitter,
30s cap by default) — pass `retry` options to tune it per paginator:

```ts
createHorizonPaginator(fetchPage, {
  retry: { maxRetries: 5, baseDelay: 500 },
});
```

If retries are exhausted, `nextPage()`/`stream()` reject with the underlying
error and **the cursor checkpoint is left untouched** at its last known-good
value — a failed page never advances or corrupts `getCursor()`, so callers can
safely retry or persist the checkpoint as-is.

## Migration notes

Existing hand-rolled pagination (e.g. `fetchTransactions`/`fetchOperations` in
`src/lib/stellar.ts`) is unaffected — this helper is additive. When migrating
a call site:

1. Move the `CallBuilder` construction into a `fetchPage` callback.
2. Replace manual `nextCursor`/`hasMore` bookkeeping with `paginator.getState()`.
3. Replace ad-hoc retry loops with the paginator's built-in retry (or pass
   `retry: { maxRetries: 0 }` to opt out and keep your own).
