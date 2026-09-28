/**
 * Declarative pre-sign risk ruleset (#982)
 * =============================================================================
 * A pure, data-driven table of "is this operation dangerous?" rules that runs
 * immediately before a transaction is handed to a wallet for signing.
 *
 * Every rule is an independently importable object with a stable `id` and this
 * shape:
 *
 *   {
 *     id:                      string   — stable identifier used by the tests
 *     matches:                 (op, context) => boolean — pure predicate
 *     severity:                'high' | 'medium' | 'info'
 *     summary:                 (op, context) => string   — plain-language text
 *     requiresAcknowledgement: boolean
 *   }
 *
 * NOTHING in this module performs I/O. `matches` and `summary` are pure
 * functions over an already-parsed `@stellar/stellar-sdk` Operation plus a
 * `RiskContext` that the caller has already assembled (account snapshot,
 * optional simulation result, contract allowlist). Network access and
 * simulation happen in `src/lib/riskSummary.js` and in the calling flow.
 *
 * ── SDK notes (verified against @stellar/stellar-sdk@12.3.0) ─────────────────
 * The parsed operation shapes differ from the pre-v12 SDK, and three details
 * here are load-bearing:
 *
 *  1. `changeTrust` stores the asset on `op.line` (not `op.asset`), and the
 *     limit is a 7-decimal string. A trustline removal is `"0.0000000"`, NOT
 *     `"0"`, so a literal `limit === '0'` comparison can never match.
 *  2. `setTrustLineFlags` uses a `flags` map of booleans. The pre-v12
 *     `authorize` field and the `Authorize` enum are gone.
 *  3. `setOptions.masterWeight` parses as a number, so `masterWeight === 0`
 *     survives the XDR round-trip.
 */

import { Address } from '@stellar/stellar-sdk';

/** Ordered severities, lowest first. Used to compute `overallSeverity`. */
export const SEVERITIES = {
  INFO: 'info',
  MEDIUM: 'medium',
  HIGH: 'high',
};

/** Numeric rank per severity. Higher wins when aggregating. */
export const SEVERITY_RANK = {
  [SEVERITIES.INFO]: 0,
  [SEVERITIES.MEDIUM]: 1,
  [SEVERITIES.HIGH]: 2,
};

/** Human labels for a severity, rendered as the badge text by the panel. */
export const SEVERITY_LABELS = {
  [SEVERITIES.INFO]: 'No risk flagged',
  [SEVERITIES.MEDIUM]: 'Review',
  [SEVERITIES.HIGH]: 'High risk',
};

// ─── Tunable thresholds (#982: maintainers did not specify values) ────────────

/**
 * Absolute XLM amount at which a payment is called out as large.
 *
 * Chosen to match the pre-existing dashboard threshold at
 * `src/lib/transactionVerification.js` ("Large payment amount") so the two
 * surfaces cannot disagree. Overridable per call via `RiskContext`.
 */
export const LARGE_PAYMENT_THRESHOLD_XLM = 10000;

/**
 * Absolute XLM amount at which a large payment requires an explicit
 * acknowledgement even when no account balance is known. With no balance
 * context we must assume the worst case: the payment is the whole account.
 */
export const LARGE_PAYMENT_HARD_CAP_XLM = 100000;

/**
 * Fraction of the source account's native balance at which a large payment
 * requires an explicit acknowledgement, even if the absolute amount is small.
 */
export const LARGE_PAYMENT_BALANCE_RATIO = 0.5;

/** Maximum int64 as a 7-decimal string — the `changeTrust` "unlimited" limit. */
export const MAX_TRUST_LIMIT = '922337203685.4775807';

// ─── Shared, pure helpers ─────────────────────────────────────────────────────

/**
 * The SDK exposes operations with camelCase `type` values (`setOptions`), while
 * `getOperationLabel` in `src/lib/stellar.ts` is keyed on the Horizon
 * snake_case names (`set_options`). Translate between the two.
 *
 * @param {string} type
 * @returns {string}
 */
export function toHorizonOperationType(type) {
  if (typeof type !== 'string') return '';
  return type
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Describe a Stellar asset for human consumption.
 *
 * @param {object} [asset] — an `Asset`, or `{ code, issuer }`
 * @returns {string} e.g. `XLM` or `USDC (GABC…WXYZ)`
 */
export function describeAsset(asset) {
  if (!asset) return 'XLM';
  const isNative = typeof asset.isNative === 'function' ? asset.isNative() : !asset.issuer;
  if (isNative || asset.code === 'XLM' || asset.code === 'native') return 'XLM';
  const issuer = asset.issuer ? String(asset.issuer) : '';
  if (!issuer) return String(asset.code ?? 'unknown asset');
  return `${asset.code} (${issuer.slice(0, 6)}…${issuer.slice(-6)})`;
}

/**
 * The trustline asset on a `changeTrust` operation lives on `line`, not
 * `asset`. Normalise both spellings.
 *
 * @param {object} op
 * @returns {object | undefined}
 */
export function changeTrustAsset(op) {
  return op?.line ?? op?.asset ?? undefined;
}

/**
 * The maximum (unlimited) `changeTrust` limit. The SDK serialises the "no
 * limit" case as max-int64 rather than as `undefined`.
 *
 * @param {string | number | undefined} limit
 * @returns {boolean}
 */
export function isUnlimitedTrustLimit(limit) {
  if (limit === undefined || limit === null) return true;
  const parsed = parseFloat(String(limit));
  if (Number.isNaN(parsed)) return false;
  return parsed >= parseFloat(MAX_TRUST_LIMIT);
}

/**
 * Resolve the `SCAddress` union on an `invokeHostFunction` operation to a
 * strkey string. `Address.fromScAddress` returns a `G...` account key for
 * account-type addresses and a `C...` contract key for contract-type ones; the
 * `kind` tells the caller which it got.
 *
 * @param {object} scAddress — an xdr `ScAddress` union
 * @returns {{ kind: 'contract' | 'account', address: string } | null}
 */
export function describeScAddress(scAddress) {
  if (!scAddress || typeof scAddress.switch !== 'function') return null;
  try {
    const arm = scAddress.switch()?.name;
    if (arm === 'scAddressTypeContract') {
      return { kind: 'contract', address: Address.fromScAddress(scAddress).toString() };
    }
    if (arm === 'scAddressTypeAccount') {
      return { kind: 'account', address: Address.fromScAddress(scAddress).toString() };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Describe what an `invokeHostFunction` operation actually does.
 *
 * `op.func` is an xdr `HostFunction` union, not a wrapper object. Its active
 * arm is selected with `op.func.switch().name`:
 *
 *   - `hostFunctionTypeInvokeContract`     -> `invokeContract()` -> `contractAddress()`
 *   - `hostFunctionTypeCreateContract`     -> `createContract()` -> `address()` (an ScVal)
 *   - `hostFunctionTypeUploadContractWasm` -> `wasm()` — no contract id exists yet
 *
 * @param {object} op
 * @returns {{ kind: 'invoke' | 'create' | 'upload' | 'unknown',
 *             contractId: string | null,
 *             addressKind: 'contract' | 'account' | null,
 *             functionName: string | null }}
 */
export function resolveHostFunctionTarget(op) {
  const unknown = {
    kind: 'unknown',
    contractId: null,
    addressKind: null,
    functionName: null,
  };
  const func = op?.func;
  if (!func || typeof func.switch !== 'function') return unknown;

  let arm;
  try {
    arm = func.switch()?.name;
  } catch {
    return unknown;
  }

  try {
    if (arm === 'hostFunctionTypeInvokeContract') {
      const args = func.invokeContract();
      const target = describeScAddress(args.contractAddress());
      return {
        kind: 'invoke',
        contractId: target ? target.address : null,
        addressKind: target ? target.kind : null,
        functionName: args.functionName()
          ? Buffer.from(args.functionName()).toString('utf8')
          : null,
      };
    }
    if (arm === 'hostFunctionTypeCreateContract') {
      // `CreateContractArgs.address` is an ScVal wrapping the ScAddress.
      const scVal = func.createContract().address();
      const target = describeScAddress(
        typeof scVal?.address === 'function' ? scVal.address() : scVal
      );
      return {
        kind: 'create',
        contractId: target ? target.address : null,
        addressKind: target ? target.kind : null,
        functionName: null,
      };
    }
    if (arm === 'hostFunctionTypeUploadContractWasm') {
      return { kind: 'upload', contractId: null, addressKind: null, functionName: null };
    }
  } catch {
    return unknown;
  }
  return unknown;
}

/**
 * Read a threshold from the Horizon account snapshot, if one was loaded.
 *
 * @param {object | null} account — a `Horizon.AccountResponse`
 * @param {'low' | 'med' | 'high'} level
 * @returns {number | null}
 */
export function readAccountThreshold(account, level) {
  const thresholds = account?.thresholds;
  if (!thresholds) return null;
  const value = {
    low: thresholds.low_threshold,
    med: thresholds.med_threshold,
    high: thresholds.high_threshold,
  }[level];
  return typeof value === 'number' ? value : null;
}

/**
 * The source account's native (XLM) balance, if an account snapshot was
 * loaded. Returns `null` when unknown — callers must treat `null` as "no
 * balance context", never as zero.
 *
 * @param {object | null} account — a `Horizon.AccountResponse`
 * @returns {number | null}
 */
export function readNativeBalance(account) {
  const balances = account?.balances;
  if (!Array.isArray(balances)) return null;
  const native = balances.find((entry) => !entry.asset_type || entry.asset_type === 'native');
  if (!native || native.balance === undefined) return null;
  const parsed = parseFloat(native.balance);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Resolve the configured thresholds for a `RiskContext`, falling back to the
 * module defaults.
 *
 * @param {object} [context]
 * @returns {{ largePaymentXlm: number, largePaymentHardCapXlm: number,
 *             largePaymentBalanceRatio: number }}
 */
export function resolveThresholds(context) {
  const overrides = context?.thresholds ?? {};
  return {
    largePaymentXlm: overrides.largePaymentXlm ?? LARGE_PAYMENT_THRESHOLD_XLM,
    largePaymentHardCapXlm: overrides.largePaymentHardCapXlm ?? LARGE_PAYMENT_HARD_CAP_XLM,
    largePaymentBalanceRatio: overrides.largePaymentBalanceRatio ?? LARGE_PAYMENT_BALANCE_RATIO,
  };
}

/**
 * Is this payment denominated in the native asset (XLM)?
 *
 * The large-payment thresholds are expressed in XLM, so they must only ever be
 * compared against a native amount. Applying them to a credit asset would both
 * mislabel the summary and produce nonsense ratios against an XLM balance.
 * A missing or unreadable asset is treated as native so that a malformed
 * operation is still surfaced rather than silently skipped.
 *
 * @param {object} asset — a parsed SDK `Asset`
 * @returns {boolean}
 */
export function isNativeAmount(asset) {
  if (!asset) return true;
  try {
    return asset.isNative();
  } catch {
    return true;
  }
}

/**
 * Normalise the contract allowlist. Accepts a `Set` or an array, and is
 * case-insensitive because strkey addresses are case-sensitive but users
 * paste them inconsistently.
 *
 * @param {Iterable<string> | null | undefined} allowlist
 * @returns {Set<string>}
 */
export function normaliseAllowlist(allowlist) {
  if (!allowlist) return new Set();
  const entries = Array.from(allowlist);
  return new Set(
    entries
      .filter((entry) => typeof entry === 'string' && entry.trim())
      .map((entry) => entry.trim().toUpperCase())
  );
}

/**
 * Is this contract on the user's allowlist?
 *
 * A contract is "known" only if the user has explicitly allowed it. The
 * shipped default allowlist is empty, so every contract invocation is flagged
 * until the user opts in — the conservative reading of "unknown contract".
 *
 * @param {string | null} contractId
 * @param {object} context
 * @returns {boolean}
 */
export function isKnownContract(contractId, context) {
  if (!contractId) return false;
  return normaliseAllowlist(context?.knownContracts).has(contractId.trim().toUpperCase());
}

// ─── The ruleset ──────────────────────────────────────────────────────────────

/**
 * @typedef {object} RiskContext
 * @property {string} [network]                     — `mainnet` | `testnet` | …
 * @property {object | null} [account]              — `Horizon.AccountResponse` for the source
 * @property {string | null} [sourceAccount]         — the transaction's source account
 * @property {object | null} [simulation]            — simulation result, if one was obtained
 * @property {Iterable<string>} [knownContracts]    — user allowlist of trusted contracts
 * @property {object} [thresholds]                   — per-call threshold overrides
 */

/**
 * The declarative ruleset. Order is display order: the panel renders matched
 * rules in the order they appear here.
 *
 * @type {ReadonlyArray<{
 *   id: string,
 *   matches: (op: object, context: RiskContext) => boolean,
 *   severity: 'high' | 'medium' | 'info',
 *   summary: (op: object, context: RiskContext) => string,
 *   requiresAcknowledgement: boolean,
 * }>}
 */
export const RISK_RULES = Object.freeze([
  {
    /**
     * Rule ID: `set-options-master-weight-disabled`
     *
     * Matched condition: `setOptions` with `masterWeight === 0`.
     * Severity: high. Acknowledgement: required.
     *
     * Setting the master key weight to zero permanently removes the account's
     * highest-privilege signing key. If no other signer meets the high
     * threshold the account becomes permanently unsignable and the funds are
     * unrecoverable. This is the single most destructive classic operation.
     */
    id: 'set-options-master-weight-disabled',
    severity: SEVERITIES.HIGH,
    requiresAcknowledgement: true,
    matches: (op) => op?.type === 'setOptions' && op.masterWeight === 0,
    summary: () => 'This operation disables the master key of the account.',
  },

  {
    /**
     * Rule ID: `set-options-signer-change`
     *
     * Matched condition: `setOptions` with `signer` defined.
     * Severity: high. Acknowledgement: required.
     *
     * Adding a signer lets a third party authorise operations for this
     * account; removing one (weight 0) or downgrading one can lock the owner
     * out. The summary distinguishes add / update / remove using the account
     * snapshot, and names the new signing weight.
     */
    id: 'set-options-signer-change',
    severity: SEVERITIES.HIGH,
    requiresAcknowledgement: true,
    matches: (op) => op?.type === 'setOptions' && op.signer !== undefined,
    summary: (op, context) => {
      const signer = op.signer ?? {};
      const key = signer.ed25519PublicKey || signer.sha256Hash || 'an unnamed signer';
      const weight = typeof signer.weight === 'number' ? signer.weight : 'an unspecified weight';
      const short =
        String(key).length > 20 ? `${String(key).slice(0, 6)}…${String(key).slice(-6)}` : key;
      const existing = (context?.account?.signers ?? []).find(
        (entry) =>
          entry.public_key === key ||
          (signer.sha256Hash && String(entry.signer_type ?? '').includes('preAuth'))
      );

      let verb = 'Adds';
      if (signer.weight === 0) verb = 'Removes';
      else if (existing) verb = 'Changes the weight of';

      return (
        `${verb} the signer ${short} to weight ${weight}. ` +
        (signer.sha256Hash
          ? 'This is a pre-authorised transaction signer.'
          : 'This signer will be able to authorise operations for this account.')
      );
    },
  },

  {
    /**
     * Rule ID: `set-options-threshold-change`
     *
     * Matched condition: `setOptions` with any of `lowThreshold`,
     * `medThreshold`, `highThreshold` defined.
     * Severity: high. Acknowledgement: required.
     *
     * Thresholds decide how much signing authority an operation needs. Lowering
     * them weakens security; raising them can make the account unmanageable if
     * the available signer weights no longer add up. The summary states both
     * the old and the new value for every threshold the operation touches.
     */
    id: 'set-options-threshold-change',
    severity: SEVERITIES.HIGH,
    requiresAcknowledgement: true,
    matches: (op) =>
      op?.type === 'setOptions' &&
      (op.lowThreshold !== undefined ||
        op.medThreshold !== undefined ||
        op.highThreshold !== undefined),
    summary: (op, context) => {
      const levels = [
        ['low', 'Low', 'lowThreshold'],
        ['med', 'Medium', 'medThreshold'],
        ['high', 'High', 'highThreshold'],
      ];
      const parts = [];
      for (const [key, label, field] of levels) {
        if (op[field] === undefined) continue;
        const previous = readAccountThreshold(context?.account, key);
        const from = previous === null ? 'unknown' : `current ${previous}`;
        const to = op[field];
        const direction =
          previous === null
            ? ''
            : to > previous
              ? ' (increases)'
              : to < previous
                ? ' (decreases)'
                : ' (unchanged)';
        parts.push(`${label} threshold: ${from} -> ${to}${direction}`);
      }
      const account = context?.account;
      if (account?.thresholds) {
        const totalWeight = (account.signers ?? []).reduce(
          (total, entry) => total + (entry.weight ?? 0),
          0
        );
        const requestedMax = Math.max(
          op.lowThreshold ?? 0,
          op.medThreshold ?? 0,
          op.highThreshold ?? 0
        );
        if (requestedMax > totalWeight) {
          parts.push(
            `Warning: the new maximum threshold (${requestedMax}) exceeds the total signing weight currently on the account (${totalWeight}), which will leave the account unmanageable.`
          );
        }
      }
      return `This operation changes the account's signing thresholds. ${parts.join('; ')}.`;
    },
  },

  {
    /**
     * Rule ID: `account-merge`
     *
     * Matched condition: `accountMerge` (any destination).
     * Severity: high. Acknowledgement: required.
     *
     * A merge moves the entire balance and every trustline to the destination
     * and then DELETES the source account. It cannot be undone, and the
     * destination is fully trusted with everything the account holds.
     */
    id: 'account-merge',
    severity: SEVERITIES.HIGH,
    requiresAcknowledgement: true,
    matches: (op) => op?.type === 'accountMerge',
    summary: (op) => {
      const destination = op.destination || 'an unspecified account';
      const short =
        String(destination).length > 20
          ? `${String(destination).slice(0, 6)}…${String(destination).slice(-6)}`
          : String(destination);
      return (
        `This operation merges the whole account into ${short}. ` +
        'Every balance, trustline and data entry moves to the destination, and this account is then permanently deleted.'
      );
    },
  },

  {
    /**
     * Rule ID: `change-trust-removal`
     *
     * Matched condition: `changeTrust` with a limit of zero.
     * Severity: high. Acknowledgement: required.
     *
     * NOTE: at @stellar/stellar-sdk@12.3.0 the parsed limit is the 7-decimal
     * string `"0.0000000"`, never `"0"`, so this compares numerically.
     *
     * Setting a trustline limit to zero deletes the trustline. The asset is
     * returned to the issuer and the user's claim on it is surrendered — this
     * is irreversible and is the classic "rug pull" leg of a trustline scam.
     */
    id: 'change-trust-removal',
    severity: SEVERITIES.HIGH,
    requiresAcknowledgement: true,
    matches: (op) => {
      if (op?.type !== 'changeTrust') return false;
      const limit = op.limit;
      if (limit === undefined || limit === null) return false;
      const parsed = parseFloat(String(limit));
      return !Number.isNaN(parsed) && parsed === 0;
    },
    summary: (op) => {
      const asset = describeAsset(changeTrustAsset(op));
      return (
        `This operation removes the ${asset} trustline. ` +
        'Any balance of this asset is returned to the issuer and your claim on it is surrendered. This cannot be undone.'
      );
    },
  },

  {
    /**
     * Rule ID: `change-trust-unlimited`
     *
     * Matched condition: `changeTrust` with a limit at or above max-int64,
     * which is how the protocol encodes "no limit".
     * Severity: medium. Acknowledgement: required.
     *
     * An unlimited trustline is an open invitation for the issuer to move any
     * asset it ever issues to this account. It is the second half of the same
     * scam pattern as `change-trust-removal`.
     */
    id: 'change-trust-unlimited',
    severity: SEVERITIES.MEDIUM,
    requiresAcknowledgement: true,
    matches: (op) => {
      if (op?.type !== 'changeTrust') return false;
      if (!changeTrustAsset(op)) return false;
      return isUnlimitedTrustLimit(op.limit);
    },
    summary: (op) => {
      const asset = describeAsset(changeTrustAsset(op));
      return (
        `This operation creates an unlimited ${asset} trustline. ` +
        'The issuer will be able to move any amount of this asset into the account at any time.'
      );
    },
  },

  {
    /**
     * Rule ID: `allow-trust-authorization`
     *
     * Matched condition: `allowTrust` (any authorize value).
     * Severity: medium. Acknowledgement: not required.
     *
     * Only the asset issuer can call this. It flips the authorisation state of
     * a trustline the issuer owns, which decides whether the holder is allowed
     * to keep or acquire the asset. Low-level but issuer-only, so it is shown
     * for review rather than gated.
     */
    id: 'allow-trust-authorization',
    severity: SEVERITIES.MEDIUM,
    requiresAcknowledgement: false,
    matches: (op) => op?.type === 'allowTrust',
    summary: (op) => {
      const trustor = op.trustor || 'an unspecified account';
      const short =
        String(trustor).length > 20
          ? `${String(trustor).slice(0, 6)}…${String(trustor).slice(-6)}`
          : String(trustor);
      const authorize = op.authorize;
      const state =
        authorize === 0
          ? 'UNAUTHORIZED (the holder may no longer hold the asset)'
          : authorize === 1
            ? 'AUTHORIZED (the holder may hold the asset)'
            : authorize === 2
              ? 'AUTHORIZED_TO_MAINTAIN_LIABILITIES (the holder may keep only what it already holds)'
              : `an unknown authorization state (${authorize})`;
      return (
        `This operation changes the authorization state of the ${op.assetCode || 'unspecified'} trustline ` +
        `held by ${short} to ${state}. Only the asset issuer can perform this operation.`
      );
    },
  },

  {
    /**
     * Rule ID: `set-trustline-flags`
     *
     * Matched condition: `setTrustLineFlags` (any flag map).
     * Severity: medium. Acknowledgement: not required.
     *
     * The protocol-19+ replacement for `allowTrust`. At
     * `@stellar/stellar-sdk@12.3.0` the only modifiable flags are
     * `authorized`, `authorizedToMaintainLiabilities` and `clawbackEnabled`
     * (which may only be cleared, never set). Revoking `authorized` strands
     * the holder's balance, so the summary says which way each flag moved.
     */
    id: 'set-trustline-flags',
    severity: SEVERITIES.MEDIUM,
    requiresAcknowledgement: false,
    matches: (op) => op?.type === 'setTrustLineFlags',
    summary: (op) => {
      const asset = describeAsset(op.asset);
      const trustor = op.trustor || 'an unspecified account';
      const short =
        String(trustor).length > 20
          ? `${String(trustor).slice(0, 6)}…${String(trustor).slice(-6)}`
          : String(trustor);
      const flags = op.flags ?? {};
      const set = Object.entries(flags)
        .filter(([, value]) => value === true)
        .map(([key]) => key);
      const cleared = Object.entries(flags)
        .filter(([, value]) => value === false)
        .map(([key]) => key);

      const parts = [];
      if (set.length) parts.push(`sets ${set.join(', ')}`);
      if (cleared.length) parts.push(`clears ${cleared.join(', ')}`);
      if (!parts.length) parts.push('changes no flags');

      const consequence = cleared.includes('authorized')
        ? ' Clearing authorized revokes the holder permission to transact with the asset and will strand anything they still hold.'
        : cleared.includes('clawbackEnabled')
          ? ' Note that clawbackEnabled can only ever be cleared through this operation, never set.'
          : '';

      return (
        `This operation ${parts.join(' and ')} on the ${asset} trustline held by ${short}.` +
        consequence +
        ' Only the asset issuer can perform this operation.'
      );
    },
  },

  {
    /**
     * Rule ID: `large-payment`
     *
     * Matched condition: a **native** (XLM) `payment` whose amount is at or
     * above `LARGE_PAYMENT_THRESHOLD_XLM` (10,000 XLM by default).
     * Severity: medium. Acknowledgement: not required.
     *
     * A large absolute amount is worth a second look, but 10,000 XLM is not
     * inherently malicious — paying an exchange, for example, is routine. The
     * acknowledgement-worthy case is the next rule.
     *
     * Credit-asset payments are out of scope for this rule: the threshold is
     * denominated in XLM, so a large USDC payment says nothing about it.
     */
    id: 'large-payment',
    severity: SEVERITIES.MEDIUM,
    requiresAcknowledgement: false,
    matches: (op, context) => {
      if (op?.type !== 'payment') return false;
      if (!isNativeAmount(op.asset)) return false;
      const amount = parseFloat(String(op.amount));
      if (Number.isNaN(amount)) return false;
      return amount >= resolveThresholds(context).largePaymentXlm;
    },
    summary: (op) => {
      const amount = parseFloat(String(op.amount));
      const destination = op.destination || 'an unspecified account';
      const short =
        String(destination).length > 20
          ? `${String(destination).slice(0, 6)}…${String(destination).slice(-6)}`
          : String(destination);
      return (
        `This operation sends ${amount.toLocaleString('en-US', { maximumFractionDigits: 7 })} ` +
        `${describeAsset(op.asset)} to ${short}, which is a large amount. ` +
        'Confirm the destination and the amount with the recipient before signing.'
      );
    },
  },

  {
    /**
     * Rule ID: `large-payment-major-share`
     *
     * Matched condition: a **native** (XLM) `payment` that consumes at least
     * `LARGE_PAYMENT_BALANCE_RATIO` (50%) of the source account's native
     * balance, or at least `LARGE_PAYMENT_HARD_CAP_XLM` (100,000 XLM) when no
     * balance snapshot is available.
     * Severity: high. Acknowledgement: required.
     *
     * This is the documented "large payment" threshold at which the issue's
     * acknowledgement requirement kicks in: spending most of an account is the
     * shape of a drain, and a hard cap covers the case where we could not load
     * the balance at all.
     */
    id: 'large-payment-major-share',
    severity: SEVERITIES.HIGH,
    requiresAcknowledgement: true,
    matches: (op, context) => {
      if (op?.type !== 'payment') return false;
      if (!isNativeAmount(op.asset)) return false;
      const amount = parseFloat(String(op.amount));
      if (Number.isNaN(amount)) return false;
      const { largePaymentBalanceRatio, largePaymentHardCapXlm } = resolveThresholds(context);
      const balance = readNativeBalance(context?.account);

      if (balance === null) return amount >= largePaymentHardCapXlm;
      if (balance <= 0) return true;
      return amount >= balance * largePaymentBalanceRatio;
    },
    summary: (op, context) => {
      const amount = parseFloat(String(op.amount));
      const destination = op.destination || 'an unspecified account';
      const short =
        String(destination).length > 20
          ? `${String(destination).slice(0, 6)}…${String(destination).slice(-6)}`
          : String(destination);
      const balance = readNativeBalance(context?.account);
      const share =
        balance !== null && balance > 0
          ? ` That is ${((amount / balance) * 100).toFixed(1)}% of the account's XLM balance of ${balance.toLocaleString('en-US')}.`
          : ' The account balance could not be loaded, so this amount is being treated as the maximum risk case.';
      return (
        `This operation sends ${amount.toLocaleString('en-US', { maximumFractionDigits: 7 })} ` +
        `${describeAsset(op.asset)} to ${short}, spending most of the account balance.${share}`
      );
    },
  },

  {
    /**
     * Rule ID: `invoke-unknown-contract`
     *
     * Matched condition: `invokeHostFunction` whose target contract is not on
     * the user's allowlist — including `createContract` and
     * `uploadContractWasm`, which have no known contract yet.
     * Severity: high. Acknowledgement: required.
     *
     * A contract invocation can move any asset the authorised account can
     * reach, and the code behind an address is not human-readable. "Known"
     * means "the user explicitly allowed this exact address"; the shipped
     * allowlist is empty, so nothing is trusted until the user says so.
     */
    id: 'invoke-unknown-contract',
    severity: SEVERITIES.HIGH,
    requiresAcknowledgement: true,
    matches: (op, context) => {
      if (op?.type !== 'invokeHostFunction') return false;
      const target = resolveHostFunctionTarget(op);
      if (target.kind === 'upload') return true;
      if (target.kind === 'create') return !isKnownContract(target.contractId, context);
      if (target.kind === 'invoke') return !isKnownContract(target.contractId, context);
      return true;
    },
    summary: (op, context) => {
      const target = resolveHostFunctionTarget(op);

      if (target.kind === 'upload') {
        return (
          'This operation uploads a new contract WASM to the network. ' +
          'It does not call any existing contract, but the uploaded code is unreviewed and will be callable by anyone.'
        );
      }
      if (target.kind === 'create') {
        const known = isKnownContract(target.contractId, context);
        return (
          `This operation deploys a new contract at ${target.contractId || 'an unspecified address'}. ` +
          (known
            ? 'This address is on your known-contract list.'
            : 'This address is not on your known-contract list, and the deployed code is unreviewed.')
        );
      }
      if (target.kind === 'invoke') {
        const known = isKnownContract(target.contractId, context);
        const address = target.contractId || 'an address that could not be decoded';
        const accountScoped =
          target.addressKind === 'account'
            ? ' The target is an account address, not a contract.'
            : '';
        const functionPart = target.functionName ? `, calling \`${target.functionName}\`` : '';
        return (
          `This operation invokes the contract ${address}${functionPart}, which is not on your known-contract list.` +
          (known ? ' (It has since been added.)' : '') +
          accountScoped +
          ' A contract call can move any asset the authorising account can reach.'
        );
      }
      return (
        'This operation contains a Soroban host function that the dashboard could not decode. ' +
        'Review it in a block explorer before signing.'
      );
    },
  },
]);

/**
 * Rule ID -> severity, exposed so the UI can build a stable legend and so the
 * documentation can be checked against the implementation. Declared after
 * `RISK_RULES` because it is derived from it.
 */
export const RULE_SEVERITIES = Object.fromEntries(
  RISK_RULES.map((rule) => [rule.id, rule.severity])
);

/**
 * Look a rule up by its stable id.
 *
 * @param {string} id
 * @returns {object | undefined}
 */
export function getRiskRule(id) {
  return RISK_RULES.find((rule) => rule.id === id);
}

/**
 * Abbreviate an account or contract address for display: `GACZB3…34LR4W`.
 *
 * Addresses are long and the summary has to stay readable, so only the first
 * six and last six characters survive. Short values are returned unchanged.
 *
 * @param {string} address
 * @returns {string}
 */
export function shortAddress(address) {
  const value = String(address ?? '');
  if (value.length <= 20) return value;
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

/**
 * Apply every rule to one parsed operation and describe each match.
 *
 * A rule whose `summary` builder throws is still reported, with a generic
 * description, so a single malformed operation can never hide the rest of the
 * transaction's risks.
 *
 * @param {object} operation — a parsed SDK operation
 * @param {object} [context] — the `RiskContext` (account snapshot, allowlist)
 * @returns {Array<{ id: string, severity: string, summary: string,
 *                   requiresAcknowledgement: boolean }>}
 */
export function evaluateOperation(operation, context = {}) {
  const applied = [];

  for (const rule of RISK_RULES) {
    let matched = false;
    try {
      matched = rule.matches(operation, context) === true;
    } catch {
      matched = false;
    }
    if (!matched) continue;

    let summary;
    try {
      summary = rule.summary(operation, context);
    } catch {
      summary = `${toHorizonOperationType(operation?.type)} matched a risk rule (${rule.id}) but could not be described.`;
    }

    applied.push({
      id: rule.id,
      severity: rule.severity,
      summary,
      requiresAcknowledgement: rule.requiresAcknowledgement,
    });
  }

  return applied;
}

export default RISK_RULES;
