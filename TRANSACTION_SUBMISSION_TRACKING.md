# Transaction submission tracking

Stellar does not accept a transaction synchronously. `sendTransaction` and
Horizon's `/transactions_async` return immediately with a status such as
`PENDING`, `DUPLICATE`, `TRY_AGAIN_LATER`, or `ERROR`, and the real outcome has
to be polled for. Issue #981 adds one shared place that owns that lifecycle.

## Quick start

```ts
import { submissionTracker } from '../lib/submissionTracker'
import { useSubmissions } from '../hooks/useSubmissionTracker'

// 1. Register before you send, so nothing is missed if the view unmounts.
const id = submissionTracker.track('Send 25 USDC')

// 2. When the network accepts it, record the hash it gave you.
const { hash } = await server.sendTransaction(prepared)
submissionTracker.attach(id, { status: 'PENDING', hash })

// 3. Drive polling to a terminal state. Do not await this in a click handler.
void submissionTracker.follow(id, async (h) => {
  const tx = await server.getTransaction(h)
  return { status: tx.status, resultCode: tx.resultCode }
})
```

`SubmissionTray` is mounted in `DashboardLayout`, so the progress is visible on
every route once a submission starts.

## The lifecycle

```
SUBMITTING ──► PENDING ──► SUCCESS
                  │  ▲
                  │  └── TRY_AGAIN_LATER  (exponential backoff)
                  ├───── FAILED            (decoded result code)
                  └───── EXPIRED           (deadline or poll budget)
```

`DUPLICATE` is a **network** status, not a tracker state. It means the
transaction is already in the mempool, so the tracker records it as `PENDING` and
keeps polling to find the same outcome. `ERROR` is likewise mapped to `FAILED`.
This is why `NetworkStatus` and `SubmissionStatus` are separate types: a record
can never hold a status the tray does not know how to render.

## Why the tracker is a module singleton

`submissionTracker` is created once at module scope. That is deliberate: a
submission must keep being observed after the view that started it unmounts.
The React hook holds **no** submission state of its own — it only subscribes and
re-renders from the tracker's snapshot. This is what makes the tray survive
route changes.

For tests, pass a `tracker` prop to the tray and construct a
`new SubmissionTracker()` directly.

## Retries and expiry

`TRY_AGAIN_LATER` means the network is asking for less pressure, so the delay
doubles on each successive occurrence, capped at `maxBackoffMs`.

```ts
new SubmissionTracker({
  baseBackoffMs: 500,    // first backoff after TRY_AGAIN_LATER
  maxBackoffMs: 8_000,   // ceiling
  expiryMs: 60_000,      // deadline for a non-terminal submission
  maxAttempts: 120,      // hard cap on polls
})
```

A **poll failure is not a transaction failure**. If the RPC call throws, the
tracker records `PENDING` and tries again; only the expiry check decides when to
give up. Treating a network blip as a failure would tell users their transaction
failed when it may well have landed.

`EXPIRED` is deliberately worded as *unconfirmed*, not *failed*, and its
suggestion tells the user to check the hash on a block explorer **before**
resubmitting. Resubmitting a transaction that actually landed is the expensive
mistake here, so the copy steers away from it.

## Error decoding

`decodeSubmissionError()` turns a result code into a message plus a concrete next
step. The message reuses the existing `STELLAR_ERROR_CODES` map so the wording
stays consistent with the rest of the dashboard; the suggestion is the part this
module adds.

```ts
decodeSubmissionError('tx_insufficient_balance')
// {
//   code: 'tx_insufficient_balance',
//   message: 'Insufficient balance to complete this transaction.',
//   suggestion: 'Top up the account, or reduce the amount and the fee.',
// }
```

Unknown codes and a missing code both return usable copy rather than throwing.

## Accessibility

`SubmissionTray` is built to be usable without sight of the colour:

- the list is a `aria-live="polite"` region, so a submission reaching a terminal
  state is announced without interrupting the user;
- in-flight rows carry `aria-busy="true"`;
- status is rendered as text (`Pending`, `Retrying`, `Confirmed`, …), never
  colour alone;
- `FAILED` and `EXPIRED` rows use `role="alert"`, because those are the states
  carrying an action the user has to take;
- the pulsing animation on in-flight rows is inside a
  `prefers-reduced-motion: no-preference` query.

## Testing

`src/lib/__tests__/submissionTracker.test.ts` (33 tests) and
`src/components/dashboard/__tests__/SubmissionTray.test.tsx` (12 tests) cover
success, failure, duplicate, and expiry paths, plus a boundary case (the backoff
ceiling) and retry behaviour.

The clock and the sleep function are injected, so backoff and expiry are
verified without real waiting:

```ts
const tracker = new SubmissionTracker({
  now: () => clock,          // the test advances this by hand
  sleep: async () => {},      // never really waits
})
```

## Relationship to `waitForTransaction`

`src/lib/contractInvoker.ts` already has a `waitForTransaction` helper. That one
blocks a caller until a transaction finishes and is still appropriate for
scripts and one-shot flows. The tracker is the non-blocking counterpart for
interactive UI, where blocking a render on a ledger close is not acceptable.
They are deliberately separate rather than merged, because their retry, timeout,
and error semantics differ.

## Migration notes

- No existing call site was changed. This is additive; the tray renders nothing
  until something calls `track()`.
- `hooks/index.ts` now also exports `useSubmissions`,
  `useActiveSubmissions`, and `useSubmissionActions`.
