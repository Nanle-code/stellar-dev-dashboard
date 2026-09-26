# Demo Mode ("Try demo") — Maintainer & User Guide

> Issue: #875 — let a first-time visitor see a fully populated dashboard in one click, without a wallet.

## What it does

The Overview tab is empty until a visitor connects a wallet or pastes a public
key, so the first impression shows no value. The **Try demo** button on the
connect screen (the same control described by the first-run checklist, #875)
loads a curated, bundled set of public testnet accounts and contracts with rich
history and renders the normal dashboard **read-only**.

- No wallet, secret key, or network connection is required.
- Demo mode is clearly labeled with a `READ-ONLY DEMO` badge in the dashboard
  header.
- **Exit demo** tears the session down and returns to the normal connect flow.

## Where the data lives

| Artifact | Purpose |
| --- | --- |
| `src/fixtures/demo-fixtures.generated.json` | Bundled, read-only fixtures consumed at runtime. |
| `src/lib/demoMode.ts` | Validation, fixture accessors, and the demo state slice. |
| `scripts/seed-demo-fixtures.mjs` | (Re)creates the fixtures after a testnet reset. |
| `tests/e2e/demo-mode.spec.ts` | End-to-end coverage of the primary, boundary, and exit flows. |

The app never fetches these fixtures from Horizon — they are validated once and
rendered directly from `src/lib/demoMode.ts`, which keeps demo mode deterministic
and usable offline.

## Re-seeding after a testnet reset

Testnet is periodically reset, which invalidates any captured network history.
Regenerate the bundled fixtures with:

```bash
pnpm run demo:seed            # regenerate from the built-in spec
pnpm run demo:seed:check      # verify the committed file is current (CI-safe)
pnpm run demo:seed -- --anchor 2026-10-01T00:00:00Z   # re-anchor relative history
```

The output is deterministic for a given anchor, so `demo:seed:check` can run in
CI without producing spurious diffs. Update the account/contract spec at the top
of `scripts/seed-demo-fixtures.mjs` when the curated set changes, then re-run
`demo:seed`.

## Security notes

- Fixtures contain **public keys only**. No secret seeds, mnemonics, or private
  keys are ever committed.
- Demo data is strictly **read-only**: mutating actions (faucet funding, signing,
  contract invocation, submission) are guarded by `assertDemoWriteAllowed` and
  refused while demo mode is active.
- Demo mode is session-scoped and intentionally **not persisted**. Reloading the
  page always returns a visitor to the normal connect flow.

## Compatibility

- Supported runtimes: Node.js 22–26 (same as the rest of the project) and modern
  evergreen browsers.
- Demo mode requires no browser extension, WebUSB/WebHID, or wallet provider.
- It is additive: existing wallet/key connect flows are unchanged.

## Migration notes

- No database or API migration is required; fixtures ship with the app bundle.
- If you previously relied on live Horizon data for demos, switch to the bundled
  fixtures so demos keep working during network resets.
- The `pnpm run demo:seed` script is the single source of truth — never hand-edit
  the generated JSON, or `demo:seed:check` will fail.

## Testing

```bash
pnpm run test -- src/lib/__tests__/demoMode.test.ts   # unit: primary/boundary/failure
pnpm run test:e2e -- demo-mode.spec.ts                 # e2e against fixtures
```
