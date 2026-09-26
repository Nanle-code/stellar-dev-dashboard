/**
 * Pre-sign risk summary engine (#982)
 * =============================================================================
 * Applies the declarative ruleset in `src/lib/riskRules.js` to a parsed
 * Stellar transaction and returns a single, render-ready summary.
 *
 * `computeRiskSummary` is PURE and SYNCHRONOUS. It performs no network access
 * and no simulation. The caller is responsible for parsing the XDR, loading an
 * account snapshot and attaching a simulation result, then passing them in via
 * the `RiskContext`. Simulation failure is therefore always survivable: the
 * summary simply renders without the simulation-derived sections.
 *
 * ── Why balance changes are derived, not simulated ───────────────────────────
 * The Soroban RPC `simulateTransaction` response at the pinned SDK version
 * (`@stellar/stellar-sdk@12.3.0`, see `lib/rpc/api.d.ts` —
 * `SimulateTransactionSuccessResponse`) exposes `events`, `transactionData`
 * (the footprint), `minResourceFee`, `cost`, `result` and `stateChanges`.
 * It has **no balance-delta field**, and Soroban RPC only produces meaningful
 * simulations for Soroban invocations — not for classic operations such as
 * `payment`, `setOptions`, `accountMerge` or `changeTrust`.
 *
 * So the only correct source of expected balance changes for a transaction the
 * dashboard is about to sign is the parsed operation itself. Balance changes
 * are therefore derived deterministically from the operations, and the
 * simulation result is used for the things it genuinely reports: the
 * resource fee and the ledger entries the invocation touches. No new RPC
 * client is introduced.
 */

import { getOperationLabel } from './stellar';
import {
  SEVERITIES,
  SEVERITY_RANK,
  changeTrustAsset,
  describeAsset,
  evaluateOperation,
  resolveHostFunctionTarget,
  toHorizonOperationType,
} from './riskRules';

/**
 * @typedef {object} BalanceChange
 * @property {number} operationIndex       — 0-based index within the transaction
 * @property {string} account               — the account whose balance moves
 * @property {string} asset                 — human-readable asset label
 * @property {string} amount                — the amount, as a decimal string
 * @property {'debit' | 'credit'} direction
 * @property {'payment' | 'merge' | 'account-merge' | 'trustline-removal'
 *           | 'trustline-creation' | 'sell-offer' | 'buy-offer' | 'clawback'
 *           | 'revoke-sponsorship' | 'unspecified'} kind
 * @property {string} note                  — plain-language explanation
 */

/**
 * @typedef {object} RiskSummaryOperation
 * @property {number} index            — 0-based index within the transaction
 * @property {object} operation        — the parsed SDK operation
 * @property {string} type             — the SDK camelCase operation type
 * @property {string} label            — `getOperationLabel` text, e.g. "Payment"
 * @property {Array<{ id: string, severity: string, summary: string,
 *                    requiresAcknowledgement: boolean }>} appliedRules
 * @property {string} severity         — the highest severity among applied rules
 * @property {BalanceChange[]} balanceChanges
 */

/**
 * @typedef {object} RiskSummary
 * @property {RiskSummaryOperation[]} operations
 * @property {'high' | 'medium' | 'info'} overallSeverity
 * @property {boolean} requiresAcknowledgement
 * @property {BalanceChange[]} balanceChanges
 * @property {object} simulation                 — normalised simulation section
 * @property {string | null} sourceAccount
 * @property {string | null} feeBumpSource       — set when the tx is a fee bump
 * @property {string[]} flaggedContracts        — contract ids behind unknown-contract flags
 * @property {string[]} notes                    — engine-level caveats
 */

/**
 * Highest severity in a list of severities.
 *
 * @param {string[]} severities
 * @returns {'high' | 'medium' | 'info'}
 */
export function highestSeverityOf(severities) {
  let best = SEVERITIES.INFO;
  for (const severity of severities) {
    if ((SEVERITY_RANK[severity] ?? 0) > (SEVERITY_RANK[best] ?? 0)) best = severity;
  }
  return best;
}

/**
 * Resolve the operations and the effective source account from either a plain
 * `Transaction` or a `FeeBumpTransaction`.
 *
 * `FeeBumpTransaction.operations` delegates to the inner transaction, but its
 * own `source` is `undefined` — the inner transaction's `source` is the real
 * source account, and the fee-bump source is the account paying the fee.
 *
 * @param {object} transaction
 * @returns {{ operations: object[], sourceAccount: string | null,
 *             feeBumpSource: string | null }}
 */
export function resolveTransactionShape(transaction) {
  const inner = transaction?.innerTransaction ?? null;
  const operations = Array.isArray(transaction?.operations) ? transaction.operations : [];
  const sourceAccount = transaction?.source ?? inner?.source ?? null;
  return {
    operations,
    sourceAccount: sourceAccount || null,
    feeBumpSource: inner ? (transaction?.feeSource ?? null) || null : null,
  };
}

/**
 * Derive the expected balance changes for one operation.
 *
 * This is a pure function of the parsed operation and the account snapshot.
 * Every branch corresponds to an operation whose effect on a balance is
 * unambiguous from the operation alone.
 *
 * @param {object} op
 * @param {number} index
 * @param {object} context
 * @returns {BalanceChange[]}
 */
export function deriveBalanceChanges(op, index, context) {
  const source =
    op?.source ??
    context?.sourceAccount ??
    context?.account?.account_id ??
    context?.account?.id ??
    'the source account';

  switch (op?.type) {
    case 'payment': {
      const amount = String(op.amount);
      const asset = describeAsset(op.asset);
      return [
        {
          operationIndex: index,
          account: source,
          asset,
          amount,
          direction: 'debit',
          kind: 'payment',
          note: `${source} sends ${amount} ${asset} to ${op.destination}.`,
        },
        {
          operationIndex: index,
          account: op.destination,
          asset,
          amount,
          direction: 'credit',
          kind: 'payment',
          note: `${op.destination} receives ${amount} ${asset}.`,
        },
      ];
    }

    case 'accountMerge':
      return [
        {
          operationIndex: index,
          account: source,
          asset: 'all assets',
          amount: 'entire balance',
          direction: 'debit',
          kind: 'account-merge',
          note: `${source} is deleted and everything it holds moves to ${op.destination}.`,
        },
        {
          operationIndex: index,
          account: op.destination,
          asset: 'all assets',
          amount: 'entire balance',
          direction: 'credit',
          kind: 'account-merge',
          note: `${op.destination} receives the whole account balance.`,
        },
      ];

    case 'changeTrust': {
      const asset = describeAsset(changeTrustAsset(op));
      const limit = op.limit;
      const parsed = limit === undefined || limit === null ? NaN : parseFloat(String(limit));
      if (!Number.isNaN(parsed) && parsed === 0) {
        return [
          {
            operationIndex: index,
            account: source,
            asset,
            amount: 'entire holding',
            direction: 'debit',
            kind: 'trustline-removal',
            note: `The ${asset} trustline is deleted and any holding is returned to the issuer.`,
          },
        ];
      }
      if (Number.isNaN(parsed)) {
        return [
          {
            operationIndex: index,
            account: source,
            asset,
            amount: 'up to the new limit',
            direction: 'debit',
            kind: 'trustline-creation',
            note: `A ${asset} trustline is opened so the issuer can push up to the new limit into the account.`,
          },
        ];
      }
      return [
        {
          operationIndex: index,
          account: source,
          asset,
          amount: `up to ${String(limit)}`,
          direction: 'debit',
          kind: 'trustline-creation',
          note: `The ${asset} trustline limit becomes ${String(limit)}.`,
        },
      ];
    }

    case 'manageSellOffer':
      return [
        {
          operationIndex: index,
          account: source,
          asset: 'offered amount',
          amount: String(op.amount ?? 'unspecified'),
          direction: 'debit',
          kind: 'sell-offer',
          note: 'The sold asset is deposited into the offer; it leaves the account if the offer fills.',
        },
      ];

    case 'manageBuyOffer':
      return [
        {
          operationIndex: index,
          account: source,
          asset: 'purchased amount',
          amount: String(op.amount ?? 'unspecified'),
          direction: 'debit',
          kind: 'buy-offer',
          note: 'The buying asset is reserved to fund the offer if it fills.',
        },
      ];

    case 'clawback':
      return [
        {
          operationIndex: index,
          account: op.from ?? source,
          asset: 'clawed-back amount',
          amount: String(op.amount ?? 'unspecified'),
          direction: 'debit',
          kind: 'clawback',
          note: `The issuer removes ${String(op.amount ?? 'an unspecified amount')} from ${op.from ?? source}.`,
        },
      ];

    default:
      break;
  }

  // The sponsorship revokes are a family of operations — the SDK exposes
  // `revokeAccountSponsorship`, `revokeTrustlineSponsorship`,
  // `revokeOfferSponsorship`, `revokeDataSponsorship` and so on, and they all
  // carry the same shape.
  if (typeof op?.type === 'string' && op.type.endsWith('Sponsorship')) {
    return [
      {
        operationIndex: index,
        account: op.account ?? source,
        asset: 'reserves',
        amount: 'sponsorship',
        direction: 'debit',
        kind: 'revoke-sponsorship',
        note: `${op.account ?? source} takes back its own sponsorship and must cover the base reserve.`,
      },
    ];
  }

  return [
    {
      operationIndex: index,
      account: source,
      asset: 'unspecified',
      amount: 'unspecified',
      direction: 'debit',
      kind: 'unspecified',
      note: 'The exact balance effect of this operation is not modelled by the dashboard.',
    },
  ];
}

/**
 * Normalise whatever the caller managed to simulate into a single shape.
 *
 * The caller may pass the dashboard's own `SimulateResult` shape (from
 * `src/lib/stellar.ts`), a raw `SorobanRpc` response, or nothing at all. This
 * reads only the fields the RPC actually provides, and records an error
 * string when simulation failed so the panel can say so without blocking the
 * user.
 *
 * @param {object | null} simulation
 * @returns {{ available: boolean, minResourceFee: string | null,
 *             resourceFee: string | null, touchedEntryCount: number | null,
 *             error: string | null }}
 */
export function normaliseSimulation(simulation) {
  if (!simulation || typeof simulation !== 'object') {
    return {
      available: false,
      minResourceFee: null,
      resourceFee: null,
      touchedEntryCount: null,
      error: null,
    };
  }

  const error =
    typeof simulation.error === 'string' && simulation.error
      ? simulation.error
      : Array.isArray(simulation.errors) && simulation.errors.length
        ? simulation.errors[0]
        : null;

  const resourceFee = simulation.minResourceFee ?? simulation.sorobanMetrics?.resourceFee ?? null;

  const touched = Array.isArray(simulation.stateChanges)
    ? simulation.stateChanges.length
    : simulation.sorobanMetrics?.footprint
      ? simulation.sorobanMetrics.footprint.readOnly.length +
        simulation.sorobanMetrics.footprint.readWrite.length
      : null;

  return {
    available: !error,
    minResourceFee: resourceFee === null ? null : String(resourceFee),
    resourceFee: simulation.fee === undefined ? null : String(simulation.fee),
    touchedEntryCount: touched,
    error,
  };
}

/**
 * Compute the complete pre-sign risk summary for a transaction.
 *
 * Iterates every operation, applies every rule to each one, and returns the
 * matched rules, the overall severity, whether an explicit acknowledgement is
 * required, and the expected balance changes.
 *
 * PURE and SYNCHRONOUS — no network access, no simulation. The caller parses
 * the XDR, builds the `RiskContext` (account snapshot, optional simulation
 * result, contract allowlist) and passes it in.
 *
 * @param {object} transaction — a parsed `Transaction` or `FeeBumpTransaction`
 * @param {object} [context]  — a `RiskContext` (see `src/lib/riskRules.js`)
 * @returns {RiskSummary}
 *
 * @example
 * const tx = TransactionBuilder.fromXDR(xdr, NETWORKS.testnet.passphrase)
 * const summary = computeRiskSummary(tx, { account, knownContracts })
 * if (summary.requiresAcknowledgement) { /* show the panel *\/ }
 */
export function computeRiskSummary(transaction, context = {}) {
  // Callers legitimately pass `null` when they have no context at all, which a
  // default parameter does not cover.
  const safeContext = context ?? {};
  const { operations, sourceAccount, feeBumpSource } = resolveTransactionShape(transaction);
  const resolvedContext = {
    ...safeContext,
    sourceAccount: safeContext.sourceAccount ?? sourceAccount,
  };

  const notes = [];
  if (feeBumpSource) {
    notes.push(
      'This is a fee-bump transaction: the inner operations are attributed to the inner source account, while the fee-bump source pays the fee.'
    );
  }
  if (!operations.length) {
    notes.push('This transaction contains no operations.');
  }

  const summaries = operations.map((operation, index) => {
    const appliedRules = evaluateOperation(operation, resolvedContext);
    const severity = highestSeverityOf(appliedRules.map((rule) => rule.severity));
    const balanceChanges = deriveBalanceChanges(operation, index, resolvedContext);

    return {
      index,
      operation,
      type: operation?.type ?? 'unknown',
      label: getOperationLabel(toHorizonOperationType(operation?.type)),
      appliedRules,
      severity,
      balanceChanges,
    };
  });

  const allRules = summaries.flatMap((entry) => entry.appliedRules);
  const simulation = normaliseSimulation(safeContext.simulation);

  // Contract ids behind any `invoke-unknown-contract` flag, so callers (the
  // panel's "add to my known list" affordance) never have to parse prose.
  const flaggedContracts = [
    ...new Set(
      summaries
        .filter((entry) => entry.appliedRules.some((rule) => rule.id === 'invoke-unknown-contract'))
        .map((entry) => resolveHostFunctionTarget(entry.operation)?.contractId)
        .filter(Boolean)
    ),
  ];

  if (
    !simulation.available &&
    safeContext.simulation !== undefined &&
    safeContext.simulation !== null
  ) {
    notes.push(
      simulation.error
        ? `Simulation did not complete (${simulation.error}). The summary below is based on the operations alone.`
        : 'Simulation did not complete. The summary below is based on the operations alone.'
    );
  }

  if (!safeContext.account) {
    notes.push(
      'No account snapshot was available, so balance-relative checks could not be applied.'
    );
  }

  return {
    operations: summaries,
    overallSeverity: highestSeverityOf(allRules.map((rule) => rule.severity)),
    requiresAcknowledgement: allRules.some((rule) => rule.requiresAcknowledgement),
    balanceChanges: summaries.flatMap((entry) => entry.balanceChanges),
    simulation,
    sourceAccount,
    feeBumpSource,
    flaggedContracts,
    notes,
  };
}

export default computeRiskSummary;
