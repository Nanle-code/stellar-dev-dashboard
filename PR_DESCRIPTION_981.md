feat(transactions): track async submission lifecycle with a shared tray

Stellar does not accept a transaction synchronously — `sendTransaction` and
Horizon's `/transactions_async` return immediately with a status such as
`PENDING`, `DUPLICATE`, `TRY_AGAIN_LATER`, or `ERROR`, and the real outcome has to
be polled for. Until now a submission was effectively invisible between being
sent and finalising. This adds one shared place that owns that lifecycle.

## What was added

**`src/lib/submissionTracker.ts`** — the lifecycle, with no React and no timers of
its own. The clock and the delay function are injected, which is what makes the
retry and expiry behaviour testable without waiting in real time.

**`src/hooks/useSubmissionTracker.ts`** — a thin binding. The hook holds no
submission state; it subscribes and re-renders from the tracker's snapshot.

**`src/components/dashboard/SubmissionTray.tsx`** — the tray, mounted in
`DashboardLayout` so it is present on every route.

**`TRANSACTION_SUBMISSION_TRACKING.md`** — usage, the state diagram, the
accessibility notes, and the relationship to the existing
`waitForTransaction` helper.

## Design decisions worth reviewing

**The tracker is a module singleton.** This is the whole answer to "a tray that
survives view changes": the submission state lives outside React, so navigating
away unmounts the tray but not the submissions. `SubmissionTray` accepts an
injectable `tracker` prop purely so tests can drive a known set.

**`DUPLICATE` and `ERROR` are not tracker states.** They are *network* answers
that the tracker translates — `DUPLICATE` → `PENDING` (the transaction is already
in the mempool, so keep polling), `ERROR` → `FAILED`. This is why
`NetworkStatus` and `SubmissionStatus` are separate types: a record can never end
up holding a status the tray has no rendering for. Building this the other way
round was the first thing the tests caught.

**A failed poll is not a failed transaction.** If the RPC call throws, the record
stays `PENDING` and only the expiry check decides when to give up. Treating a
network blip as a failure would tell a user their transaction failed when it may
well have landed.

**`EXPIRED` is worded as "unconfirmed", not "failed"**, and its suggestion tells
the user to check the hash on a block explorer *before* resubmitting.
Resubmitting a transaction that actually landed is the expensive mistake, so the
copy steers away from it rather than offering a retry button.

**`TRY_AGAIN_LATER` backs off exponentially** (500 ms doubling to an 8 s ceiling)
because the network is asking for less pressure.

**Error decoding reuses `STELLAR_ERROR_CODES`** for the message half, so wording
stays consistent with the rest of the dashboard; the suggestion is what this
module adds. Unknown and missing codes both return usable copy rather than
throwing.

## Accessibility

- the list is an `aria-live="polite"` region, so a submission reaching a terminal
  state is announced without interrupting;
- in-flight rows carry `aria-busy="true"`;
- status is rendered as text (`Pending`, `Retrying`, `Confirmed`, …) — never
  colour alone;
- `FAILED`/`EXPIRED` rows use `role="alert"`, since those carry an action;
- the pulse animation is inside `prefers-reduced-motion: no-preference`;
- the tray is `position: fixed` with a mobile breakpoint that spans the viewport.

## Unblocking fixes folded in

Per the direction to avoid separate repair PRs, the two things that stopped this
work are fixed here.

**`src/components/dashboard/AuditLog.tsx` did not parse.** Commit `31884b31`
replaced the outer grid wrapper with `EnhancedTable` but left the wrapper's
closing `</div>` behind, which `tsc` reported as `TS1005: ')' expected` at line
595 and `TS1109` at 596.

That syntax error had a second effect worth knowing about: **`tsc` never
type-checked the file**, so three further errors were hidden behind it.
`AuditEntry` had no `message` field, even though the runtime events from
`auditTrail.logEvent` do carry one and the component renders it three times. The
field is now declared optional, with a comment explaining why it is optional
rather than required.

Net effect: the repository's type-error count goes **down by three** (2788 → 2785).

## Verification

- **45 new tests, all passing**: 33 for the tracker
  (`src/lib/__tests__/submissionTracker.test.ts`) and 12 for the tray
  (`src/components/dashboard/__tests__/SubmissionTray.test.tsx`).
  - Primary flow: `follow` polls to `SUCCESS`.
  - Failure: `ERROR` fails immediately, stops polling, and attaches a decoded error.
  - Duplicate: `DUPLICATE` stays non-terminal and keeps polling.
  - Expiry: both the time deadline and the `maxAttempts` budget.
  - Boundary: the backoff ceiling, asserted as exactly
    `[100, 200, 400, 800, 800, 800]`.
  - A poll that throws is treated as still pending.
- `npx eslint` on all new and modified files — **0 errors, 0 warnings**.
- `pnpm run type-check` — **no errors in any file this PR touches**, and the
  repository total drops by three. `src/types/audit.ts` is in the strict
  allowlist and is clean under `pnpm run type-check:strict`.
- `node scripts/check-inline-style-budget.mjs` — passes. The tray uses a
  stylesheet rather than inline style objects.
- A test run rewrote `api/data/learning.json` (test fixture data with fresh
  timestamps). That was reverted and is **not** in this PR.

## Pre-existing failures this PR does not fix

Stating these plainly, because the issue's PR requirements say all CI checks must
pass and they currently do not — for reasons that predate this work:

- `pnpm run type-check` reports **2785 errors** across the repository at
  `master` (2788 before this PR). The files touched here are clean; the rest are
  untouched pre-existing breakage.
- `pnpm run type-check:strict` fails across many files outside its 20-entry
  allowlist, so the "ratchet" is not currently holding.
- The full unit suite has ~149 pre-existing failures and does not finish within a
  15-minute timeout. I verified the baseline rather than assuming it, and this
  PR's tests were run in isolation.

Fixing that is a separate piece of work and is well beyond this issue. Flagging
it rather than implying the branch is green when it is not.

## Not included

No existing submit call site was migrated to the tracker — that is the follow-up
work this infrastructure exists to enable, and doing it blind across a
type-broken codebase would be risky. The tray renders nothing until something
calls `track()`, so this PR is safe to land on its own.

closes #981
