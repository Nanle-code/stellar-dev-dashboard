# Claimable Balance Lifecycle Workspace (#768)

The dashboard now provides a full **claimable-balance lifecycle workspace** under the
existing *Claimable* tab. It lets you **list**, **inspect**, **create**, and
**claim** claimable balances, with clear, human-readable **predicate
explanations** so you understand *when* and *whether* a balance can be claimed.

## Features

- **List** — fetch all claimable balances for the connected account via Horizon
  (`GET /claimable_balances?claimant=…`), showing asset, amount, sponsor, ledger,
  and each claimant's predicate summary.
- **Inspect** — open a single balance (`fetchClaimableBalanceById`) and see a
  structured, recursive explanation of every claimant predicate (including
  `AND` / `OR` / `NOT` composition) with a live "claimable now / not yet /
  unknown" badge.
- **Create** — build a `createClaimableBalance` operation with a chosen asset
  (native or custom), amount, and one or more claimants. Each claimant's
  predicate can be `unconditional`, `before` (absolute), `after` (absolute),
  `relative` (seconds), or an advanced raw JSON predicate.
- **Claim** — simulate a `claimClaimableBalance` operation and view the resulting
  fee and XDR.

## Horizon helpers (`src/lib/stellar.ts`)

| Function | Purpose |
| --- | --- |
| `fetchClaimableBalances(publicKey, network)` | List balances for an account (existing). |
| `fetchClaimableBalanceById(balanceId, network)` | Inspect a single balance via `GET /claimable_balances/:id`. |
| `explainClaimPredicate(predicate, now?)` | Returns a structured `PredicateExplanation` (`kind`, `summary`, `claimableNow`, `claimableAt`, `children`). |
| `buildClaimPredicate(spec)` | Pure builder that turns a declarative `PredicateSpec` into a Stellar predicate object. |
| `formatClaimPredicate(predicate)` | Existing terse one-line summary (unchanged). |

### `explainClaimPredicate` semantics

- `claimableNow` is `true` / `false` / `null` (unknown) best-effort, computed
  against an injectable `now` timestamp (defaults to `Date.now()`). `null` is
  returned for `rel_before` (depends on ledger close time) and any branch that
  can't be determined locally.
- `AND` is claimable only when **every** child is claimable; `OR` when **any**
  child is claimable; `NOT` inverts (`null` stays `null`).
- Empty / non-object / unrecognized predicates are explained as `unconditional`.

### `buildClaimPredicate` (`PredicateSpec`)

```ts
type PredicateSpec =
  | { type: 'unconditional' }
  | { type: 'before'; date: string | Date }
  | { type: 'after';  date: string | Date }
  | { type: 'relative'; seconds: number }
  | { type: 'and'; predicates: PredicateSpec[] }   // ≥ 2
  | { type: 'or';  predicates: PredicateSpec[] }   // ≥ 2
  | { type: 'not'; predicate: PredicateSpec }
```

It throws `TypeError` on invalid input (bad date, non-positive relative time,
fewer than two operands for `and`/`or`, or an unknown type).

## Compatibility

- **Networks:** `testnet`, `mainnet`, `futurenet`, `local`, `custom`. An
  unsupported network name throws a clear `Error` before any request is made.
- **Horizon:** all helpers talk to the configured `horizonUrl` for the network.
  `fetchClaimableBalanceById` maps HTTP `404` → "not found" and any other
  non-OK status → `Horizon error <status>`.
- **Inputs:** `balanceId` must be a non-empty string (`TypeError` otherwise);
  the create form validates amount, asset code/issuer, and every claimant
  destination/predicate before simulating.

## Security

- **No secret material.** The workspace never asks for or stores signing keys.
  Create/claim actions are **simulations (dry-runs)** that return the
  transaction XDR; actually submitting requires signing that XDR with the
  appropriate secret key outside the dashboard — so no secret key ever enters
  the UI.
- **Input validation.** All user-supplied values (claimant keys, amounts,
  predicate specs, advanced JSON) are validated, and failures surface as
  explicit error messages rather than being forwarded to Horizon.
- **Predicate safety.** `buildClaimPredicate` only emits well-formed Stellar
  predicates; the advanced-JSON path requires a parseable object and is still
  validated by the Stellar SDK at build time.

## Migration notes

- **No breaking changes.** `fetchClaimableBalances` and `formatClaimPredicate`
  keep their existing signatures and behavior. The *Claimable* tab continues to
  mount the same default-exported `ClaimableBalances` component (now the
  lifecycle workspace).
- **New exports:** `fetchClaimableBalanceById`, `explainClaimPredicate`,
  `buildClaimPredicate`, and the `PredicateSpec` / `PredicateExplanation` types
  were added to `src/lib/stellar.ts`.
- **Persistence:** claimable-balance data remains read from Horizon at runtime;
  no new local storage schema was introduced.
