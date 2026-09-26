# riskRules.js

Declarative, pure ruleset that turns a parsed Stellar transaction into
plain-language risk descriptions. This module has no React and no network
dependency — it is a plain function library so it can be unit-tested and reused
from any signing surface.

## Why a ruleset

A raw XDR envelope tells a user nothing. `setOptions(masterWeight: 0)` and a
1 XLM payment are byte-for-byte the same shape in base64. The pre-sign risk
summary ([#982](https://github.com/Nanle-code/stellar-dev-dashboard/issues/982))
exists to close that gap: every operation is described in a sentence, and
anything irreversible is escalated to a severity the UI can act on.

## Severities

| Severity | Meaning                                        | Requires acknowledgement |
| -------- | ---------------------------------------------- | ------------------------ |
| `info`   | Nothing matched a rule.                        | No                       |
| `medium` | Worth a second look, reversible or routine.    | No                       |
| `high`   | Irreversible, or a large share of the account. | Yes                      |

```js
import { SEVERITIES, SEVERITY_RANK, SEVERITY_LABELS } from './src/lib/riskRules';
```

`SEVERITY_RANK` is ordered `info` < `medium` < `high`, so aggregating a list of
severities is a simple maximum.

## Thresholds

| Constant                      | Default                  | Meaning                                                                  |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `LARGE_PAYMENT_THRESHOLD_XLM` | `10000`                  | Absolute native payment worth flagging (medium).                         |
| `LARGE_PAYMENT_BALANCE_RATIO` | `0.5`                    | Share of the account's XLM balance that escalates a payment to high.     |
| `LARGE_PAYMENT_HARD_CAP_XLM`  | `100000`                 | Used instead of the balance ratio when no account snapshot is available. |
| `MAX_TRUST_LIMIT`             | `'922337203685.4775807'` | The SDK's maximum trust limit, i.e. "unlimited".                         |

All three payment thresholds apply to **native (XLM) payments only**. They are
denominated in XLM, so applying them to a credit-asset payment would mislabel
the summary and produce a meaningless ratio against an XLM balance.

Every threshold can be overridden per call through
`context.thresholds.largePaymentXlm` and friends.

## The ruleset

| Rule ID                              | Matches                                                                             | Severity | Ack |
| ------------------------------------ | ----------------------------------------------------------------------------------- | -------- | --- |
| `set-options-master-weight-disabled` | `setOptions` with `masterWeight === 0`                                              | high     | yes |
| `set-options-signer-change`          | `setOptions` adding or changing a signer                                            | high     | yes |
| `set-options-threshold-change`       | `setOptions` changing any threshold                                                 | high     | yes |
| `account-merge`                      | `accountMerge`                                                                      | high     | yes |
| `change-trust-removal`               | `changeTrust` with a zero limit                                                     | high     | yes |
| `change-trust-unlimited`             | `changeTrust` with no limit or the maximum limit                                    | medium   | yes |
| `allow-trust-authorization`          | `allowTrust` (any authorization change)                                             | medium   | no  |
| `set-trustline-flags`                | `setTrustLineFlags` (any flag map)                                                  | medium   | no  |
| `large-payment`                      | native `payment` at or above the absolute threshold                                 | medium   | no  |
| `large-payment-major-share`          | native `payment` at or above 50% of the known balance, or the hard cap when unknown | high     | yes |
| `invoke-unknown-contract`            | `invokeHostFunction` against a contract that is not allowlisted                     | high     | yes |

### A note on `change-trust-unlimited`

It is the one rule that is `medium` yet still requires acknowledgement. Granting
an unlimited trustline is a durable grant that the holder cannot undo from their
own side, so it is surfaced as a confirmation even though it is not in the same
class of irreversible as an account merge.

## `evaluateOperation(operation, context)`

Runs every rule against one **parsed** operation and returns the matches.

```js
import { evaluateOperation } from './src/lib/riskRules';

const [operation] = transaction.operations; // parsed, not a builder descriptor
const applied = evaluateOperation(operation, {
  account: horizonAccount, // enables balance-relative rules
  knownContracts: [], // allowlist; empty by default
  thresholds: { largePaymentXlm: 5000 },
});
// [{ id, severity, summary, requiresAcknowledgement }, ...]
```

> **This matters:** `Sdk.Operation.payment()` returns a _builder descriptor_ with
> no `type` and no `amount`. The rules only work on the **parsed** form produced
> by `TransactionBuilder.build()` or `TransactionBuilder.fromXDR()`. Feeding a
> descriptor in silently matches nothing.

A rule that throws while matching or describing an operation can never take the
signing flow down: the match is skipped, and a match that cannot be described is
still reported with a fallback sentence.

## Helpers

| Function                        | Purpose                                            |
| ------------------------------- | -------------------------------------------------- |
| `shortAddress(address)`         | `GACZB3…34LR4W`; short values pass through.        |
| `describeAsset(asset)`          | "XLM" or "USDC (GACZB3…34LR4W)".                   |
| `changeTrustAsset(op)`          | Reads `op.line`, **not** `op.asset` — SDK 12.3.0.  |
| `isUnlimitedTrustLimit(limit)`  | Detects both the max limit and an absent limit.    |
| `isNativeAmount(asset)`         | Native check used to scope the payment thresholds. |
| `readNativeBalance(account)`    | Horizon snapshot → number, or `null` when unknown. |
| `resolveThresholds(context)`    | Applies overrides over the module defaults.        |
| `normaliseAllowlist(list)`      | Array or `Set` → uppercase `Set`.                  |
| `isKnownContract(id, context)`  | Case-insensitive allowlist membership.             |
| `resolveHostFunctionTarget(op)` | Reads the xdr `HostFunction` union.                |
| `describeScAddress(scAddress)`  | xdr `ScAddress` → `{ kind, address }`.             |
| `toHorizonOperationType(type)`  | `setTrustLineFlags` → `set_trust_line_flags`.      |
| `getRiskRule(id)`               | Look a rule up by its stable id.                   |

## Reading Soroban host functions

`op.func` is an xdr `HostFunction` union, so its active arm is selected with
`op.func.switch().name`:

| Arm name                             | Meaning                   | Contract id available? |
| ------------------------------------ | ------------------------- | ---------------------- |
| `hostFunctionTypeInvokeContract`     | Calls a deployed contract | Yes                    |
| `hostFunctionTypeCreateContract`     | Deploys a new contract    | Yes (the new address)  |
| `hostFunctionTypeUploadContractWasm` | Uploads WASM              | No                     |
| anything else                        | Unknown / future          | No                     |

An arm we cannot decode is **not** silently ignored — it is still flagged and
described as undecodable, because an operation the dashboard cannot read is
precisely the one a user most needs to be warned about.

## SDK notes

Verified against `@stellar/stellar-sdk@12.3.0`:

- `setTrustLineFlags` takes a boolean `flags` map. The valid keys are
  `authorized`, `authorizedToMaintainLiabilities` and `clawbackEnabled`; there is
  no `authRequired`. `clawbackEnabled` can only ever be _cleared_, which the
  summary calls out.
- `setOptions` exposes `masterWeight` as a number, and `masterWeight === 0`
  survives an XDR round trip.
- `HostFunction`, `ScAddress` and `ScAddressType` are **not** re-exported from
  the SDK root. Reach for `Contract` (`new Sdk.Contract(id).call(...)`,
  `Address.fromScAddress(...)`) instead.
- A zero trust limit round-trips as `'0.0000000'`, and the maximum limit as
  `'922337203685.4775807'`.

## Related

- [`riskSummary.js`](./riskSummary.md) — the engine that assembles these rules
  into a per-transaction summary, with balance deltas and simulation results.
