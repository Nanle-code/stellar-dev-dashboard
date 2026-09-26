# riskSummary.js

The engine behind the pre-sign risk summary
([#982](https://github.com/Nanle-code/stellar-dev-dashboard/issues/982)).

`riskRules.js` knows how to describe a single operation. This module assembles
those descriptions into one reviewable `RiskSummary`, adds the balance changes a
user actually cares about, and folds in a best-effort Soroban simulation.

It is **synchronous, pure, and total**: it never performs I/O, and it cannot
throw for a malformed transaction. A user must never be blocked from signing a
transaction because a rule or a node misbehaved.

```js
import { computeRiskSummary } from './src/lib/riskSummary';

const summary = computeRiskSummary(transaction, {
  network: 'testnet',
  account: horizonAccount, // enables balance-relative rules
  sourceAccount: transaction.source,
  simulation: sorobanResponse, // optional
  knownContracts: [], // allowlist; empty by default
  thresholds: { largePaymentXlm: 5000 },
});
```

## The `RiskSummary` shape

```js
{
  operations: [
    {
      index: 0,
      operation: { /* the parsed SDK operation */ },
      type: 'accountMerge',
      label: 'Account Merge',
      severity: 'high',
      appliedRules: [
        { id: 'account-merge', severity: 'high', summary: '…', requiresAcknowledgement: true }
      ],
      balanceChanges: [ /* see below */ ]
    }
  ],
  overallSeverity: 'high',        // highest across every operation
  requiresAcknowledgement: true,  // any rule gated the sign?
  balanceChanges: [ /* flattened */ ],
  simulation: {
    available: false,
    minResourceFee: null,
    resourceFee: null,
    touchedEntryCount: null,
    error: null
  },
  sourceAccount: 'G…',           // the account the operations belong to
  feeBumpSource: 'G…',           // set only for a fee-bump envelope
  flaggedContracts: ['C…'],      // contract ids behind unknown-contract flags
  notes: ['…']                   // engine-level caveats, shown verbatim
}
```

## Balance changes

Soroban RPC does not return expected account balance deltas, so the summary
**derives** them from the parsed operations. This is deterministic and needs no
network round trip.

Each entry is:

```js
{
  operationIndex: 0,
  account: 'G…',        // whose balance moves
  asset: 'USDC (GACZB3…34LR4W)',
  amount: '25.0000000',  // stroop precision preserved
  direction: 'debit' | 'credit',
  kind: 'payment' | 'account-merge' | 'trustline-removal' | 'clawback' | '…',
  note: 'G… receives 25.0000000 USDC (…).'
}
```

An operation whose balance effect is not modelled (a `setOptions`, say) returns
a single `kind: 'unspecified'` entry saying so, rather than being presented as a
known balance move.

## Fee-bump transactions

`resolveTransactionShape` reads a `FeeBumpTransaction` through to the inner
transaction, so the rules judge the inner operations. Attribution stays honest:

- `sourceAccount` — the **inner** source, which is the account whose authority
  the operations exercise.
- `feeBumpSource` — the account paying the extra fee.

A note is added explaining the split.

## Simulation

`normaliseSimulation` accepts a raw Soroban-RPC response, the dashboard's own
`SimulateResult`, or nothing. It never throws, and records an `error` string when
simulation failed.

When a simulation was attempted but did not complete, the summary still renders
and a note says so:

> Simulation did not complete (node unreachable). The summary below is based on
> the operations alone.

Failing open is deliberate. A dashboard that refuses to sign because a node is
down is a worse outcome than a signable transaction with a stated caveat.

## Notes the engine adds

| Note                                | When                                         |
| ----------------------------------- | -------------------------------------------- |
| Fee-bump attribution                | The envelope is a `FeeBumpTransaction`.      |
| "contains no operations"            | The transaction has an empty operation list. |
| "Simulation did not complete"       | Simulation was attempted and failed.         |
| "No account snapshot was available" | Balance-relative rules could not be applied. |

## Exported helpers

| Function                           | Purpose                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| `computeRiskSummary(tx, ctx)`      | The main entry point.                                           |
| `resolveTransactionShape(tx)`      | `{ operations, sourceAccount, feeBumpSource }`, fee-bump aware. |
| `deriveBalanceChanges(op, i, ctx)` | Balance deltas for one operation.                               |
| `normaliseSimulation(sim)`         | Simulation payload → one shape.                                 |
| `highestSeverityOf(list)`          | Max severity, `info` for an empty list.                         |

## Related

- [`riskRules.md`](./riskRules.md) — the ruleset and its SDK notes.
- [`../components.md`](../components.md) — the `<RiskSummaryPanel>` dialog.
