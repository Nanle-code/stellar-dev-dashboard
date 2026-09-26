# Request Cancellation Guide

How the dashboard stops a slow Horizon response for an old account or network from
overwriting current state.

> Implemented for [Issue #745](https://github.com/Nanle-code/stellar-dev-dashboard/issues/745).
> Source: [`src/lib/requestCancellation.ts`](../src/lib/requestCancellation.ts).

## Table of Contents

- [The problem](#the-problem)
- [The model: lanes and leases](#the-model-lanes-and-leases)
- [Using it](#using-it)
- [Passing a signal to Horizon](#passing-a-signal-to-horizon)
- [Choosing a lane name](#choosing-a-lane-name)
- [Error handling](#error-handling)
- [Compatibility](#compatibility)
- [Security notes](#security-notes)
- [Migration notes](#migration-notes)
- [Testing](#testing)

---

## The problem

Account data is loaded asynchronously from Horizon. When the user switches account or
network while a read is still in flight, two responses are racing and **nothing
guarantees they land in the order they were requested**:

```
t0  user connects account A       ──► GET /accounts/A ······ (slow, 3s)
t1  user switches to account B    ──► GET /accounts/B ─► 200 (fast, 200ms)
t2  state shows B                                    ✅
t3  A's response finally arrives  ─────────────────► 200
t4  state shows A                                    ❌ wrong account displayed
```

The same race happens on a network switch: a response fetched from Testnet can land
after the user moved to Mainnet, showing the previous network's balances under the new
network's label.

Guarding with a local `isActive` boolean inside a single `useEffect` only covers that
one effect. It does not help event handlers (the connect button), does not cancel the
request, and does not coordinate between the several components reading the same
account.

## The model: lanes and leases

A **lane** is a named stream of work that writes to one slot of state. Starting new
work on a lane invalidates everything earlier on that lane.

A **lease** is one unit of work on a lane. A lease is _active_ until a newer lease
starts on the same lane (or it is explicitly aborted). Two things follow from that:

| Mechanism                         | What it does                  | Guarantee                     |
| --------------------------------- | ----------------------------- | ----------------------------- |
| `lease.signal`                    | Aborts the underlying `fetch` | Best effort — saves bandwidth |
| `lease.active` / `lease.commit()` | Rejects late results          | **Correctness**               |

The distinction matters: the Stellar SDK's `CallBuilder` and `loadAccount()` do not
accept an `AbortSignal`, so those requests cannot always be stopped on the wire. The
`active` check is what actually prevents the bug — abort is the optimisation on top.

## Using it

```ts
import { accountRequests, AccountLanes, isCancellation } from '../../lib/requestCancellation';

async function loadAccount(address: string, network: NetworkName) {
  // Cancels whatever was already loading on this lane.
  const lease = accountRequests.begin(AccountLanes.Connect);

  try {
    // run() rejects if the lease goes stale before *or* while the work runs,
    // so a superseded response can never be returned to you.
    const account = await lease.run((signal) => fetchAccount(address, network, { signal }));

    // commit() writes state only while this is still the newest request.
    lease.commit(() => setAccountData(account));
  } catch (error) {
    if (isCancellation(error)) return; // superseded — the newer request owns the state
    setError((error as Error).message);
  } finally {
    // Guarded too: an old request finishing must not clear a live spinner.
    lease.commit(() => setLoading(false));
  }
}
```

Inside a `useEffect`, abort on cleanup so unmounting stops the request:

```ts
useEffect(() => {
  const lease = accountRequests.begin(AccountLanes.Offers);

  fetchAccountOffers(address, network, { signal: lease.signal })
    .then((offers) => lease.commit(() => setOffers(offers)))
    .catch((error) => {
      if (isCancellation(error)) return;
      lease.commit(() => setOffersError(error.message));
    })
    .finally(() => lease.commit(() => setOffersLoading(false)));

  return () => lease.abort();
}, [address, network]);
```

### API summary

| Member                    | Purpose                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `coordinator.begin(lane)` | Cancel the lane's current work, start and return a new lease |
| `coordinator.abort(lane)` | Cancel one lane (no-op if idle)                              |
| `coordinator.abortAll()`  | Cancel every lane — used on network switch                   |
| `lease.active`            | `false` once superseded or aborted                           |
| `lease.run(fn)`           | Run `fn(signal)`; reject with `StaleRequestError` if stale   |
| `lease.commit(fn)`        | Run `fn` only while active; returns whether it ran           |
| `lease.ensureActive()`    | Throw `StaleRequestError` if stale                           |
| `lease.abort()`           | Cancel just this lease                                       |
| `lease.signal`            | `AbortSignal`, or `undefined` where unsupported              |

## Passing a signal to Horizon

These readers in [`src/lib/stellar.ts`](../src/lib/stellar.ts) accept an optional
trailing `HorizonRequestOptions` (`{ signal }`) argument:

| Function                   | Signature tail                                     |
| -------------------------- | -------------------------------------------------- |
| `fetchAccount`             | `(publicKey, network?, options?)`                  |
| `fetchAccountOffers`       | `(publicKey, network?, options?)`                  |
| `fetchAccountCreationDate` | `(publicKey, network?, options?)`                  |
| `fetchClaimableBalances`   | `(publicKey, network?, options?)`                  |
| `fetchTransactions`        | `(publicKey, network?, limit?, cursor?, options?)` |
| `fetchOperations`          | `(publicKey, network?, limit?, cursor?, options?)` |

Each one:

- rejects with an `AbortError` **before issuing a request** if the signal is already
  aborted, and
- rejects with an `AbortError` if the signal fires while the request is in flight.

`fetchClaimableBalances` goes through `fetch`, so its signal cancels the request on the
wire. The others go through the Stellar SDK, so the HTTP request may still complete —
but its result is detached from the caller.

## Choosing a lane name

**A lane names the state slot being written, not the data being read.**

```ts
// ✅ one lane for account loads — a new account cancels the previous one
accountRequests.begin(AccountLanes.Connect);

// ❌ per-address lanes never cancel each other, which is the bug itself
accountRequests.begin(`account:${address}:${network}`);
```

Because there is exactly one `accountData` in the store, every account load shares one
lane and the newest always wins. Keying the lane by address would give account A and
account B separate lanes, and A's slow response would never be cancelled.

Lane constants live in `AccountLanes`:

| Constant                    | Value                   | Covers                                        |
| --------------------------- | ----------------------- | --------------------------------------------- |
| `AccountLanes.Connect`      | `account:connect`       | resolve → account → transactions → operations |
| `AccountLanes.Offers`       | `account:offers`        | open offers panel                             |
| `AccountLanes.CreationDate` | `account:creation-date` | account creation date lookup                  |

## Error handling

| Predicate                | True for                                                |
| ------------------------ | ------------------------------------------------------- |
| `isStaleRequestError(e)` | Work discarded because a newer request superseded it    |
| `isAbortError(e)`        | A DOM `AbortError` / `TimeoutError`                     |
| `isCancellation(e)`      | Either of the above — "this result is no longer wanted" |

Always check `isCancellation()` before showing an error. A cancelled request is a normal
consequence of the user navigating, not a failure worth reporting.

Once a lease is stale, `run()` reports **any** outcome as a `StaleRequestError` —
including a genuine network failure. That is deliberate: an error belonging to an
account the user already left should not surface over the current account's data.

Real failures on a still-current lease propagate unchanged.

## Compatibility

- **Backwards compatible.** The `options` argument is optional and trailing on every
  reader; existing call sites are unaffected and behave exactly as before.
- **`AbortController` unavailable** (older embedded webviews, some SSR shims): detected
  once at module load and exported as `supportsAbortController`. The coordinator then
  degrades to token-only invalidation — `lease.signal` is `undefined` and requests are
  not cancelled on the wire, but `active`/`commit()` still discard stale responses, so
  **correctness is preserved**. Never rely on `lease.signal` being defined.
- **`DOMException` unavailable**: `stellar.ts` falls back to a plain `Error` with
  `name = 'AbortError'`, so `isAbortError()` works either way.

## Security notes

Cancellation is a **UI-consistency** control, not an access control:

- Aborting does not guarantee the server stopped processing, and for SDK-backed reads
  the HTTP response is usually still received and discarded client-side. Do not treat
  abort as a way to retract a request that has already left the browser.
- Because a stale read may still populate `stellarCache`, cache entries stay keyed by
  `publicKey` **and** `network`. Never widen a cache key to omit either, or a cancelled
  read for one account could serve another.
- `RequestCoordinator` holds no request or response payloads — only a token and an
  `AbortController` per lane — so there is nothing account-sensitive to leak between
  lanes or across a disconnect.

## Migration notes

Nothing is required for existing code to keep working. When touching a component that
loads account data, prefer replacing ad-hoc guards:

```diff
-let isActive = true;
-fetchAccountOffers(address, network)
-  .then((res) => { if (!isActive) return; setOffers(res); });
-return () => { isActive = false; };
+const lease = accountRequests.begin(AccountLanes.Offers);
+fetchAccountOffers(address, network, { signal: lease.signal })
+  .then((res) => lease.commit(() => setOffers(res)));
+return () => lease.abort();
```

The `isActive` pattern only protects one effect instance. A lease additionally cancels
the in-flight request and coordinates with every other reader on the same lane.

New state that is loaded per-account should add a constant to `AccountLanes` rather than
inventing an ad-hoc lane string.

## Testing

```bash
npm test -- tests/unit/lib/requestCancellation.test.ts
npm test -- tests/unit/lib/stellar.cancellation.test.ts
```

To write a race test, control response ordering with a hand-settled promise rather than
timers:

```ts
const slowA = deferred<string>();
const leaseA = coordinator.begin('account');
const pendingA = leaseA.run(() => slowA.promise);

coordinator.begin('account'); // user switches to account B
slowA.resolve('ACCOUNT-A-DATA'); // A answers late

await expect(pendingA).rejects.toThrow(StaleRequestError);
```
