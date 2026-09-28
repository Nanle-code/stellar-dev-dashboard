import { useCallback, useEffect, useRef, useState } from 'react';
import { TransactionBuilder } from '@stellar/stellar-sdk';
import { useStore } from '../lib/store';
import { NETWORKS, fetchAccount, getSorobanServer } from '../lib/stellar';
import { getStoredValue, setStoredValue } from '../lib/storage';
import { computeRiskSummary } from '../lib/riskSummary';

/**
 * Pre-sign risk review hook (#982)
 * =============================================================================
 * Owns the shared state machine for "show a readable risk summary before
 * signing". Every signing flow uses the same hook so that a transaction pasted
 * from outside the dashboard gets exactly the same coverage as one the
 * dashboard built.
 *
 * The sequence, in order, is:
 *
 *   1. Parse the XDR into a `Transaction` with the Stellar SDK.
 *   2. Build the `RiskContext` — load the source account snapshot.
 *   3. Ask Soroban RPC to simulate, if the transaction contains a Soroban op.
 *   4. Compute the risk summary from the parsed transaction and the context.
 *   5. Let the caller render `RiskSummaryPanel` and only sign on acknowledgement.
 *
 * Simulation is strictly best-effort: it is attempted once, and any failure is
 * recorded on the summary rather than thrown, so a user is never blocked from
 * signing because a node was unreachable.
 */

const KNOWN_CONTRACTS_KEY = 'risk-summary:known-contracts';

/**
 * Outcome of a `beginReview` call.
 *
 * The three cases must stay distinct, because a caller that cannot tell them
 * apart will either block users unnecessarily or, far worse, sign a
 * transaction nobody was able to read:
 *
 * - `shown` — a summary is on screen; wait for acknowledgement.
 * - `pass`  — decoded cleanly, nothing flagged; go ahead and sign.
 * - `error` — the envelope could not be decoded, so it is *not* safe to sign.
 */
export const REVIEW_SHOWN = 'shown';
export const REVIEW_PASS = 'pass';
export const REVIEW_ERROR = 'error';

/**
 * Read the persisted list of user-approved Soroban contract addresses.
 *
 * @returns {Promise<string[]>}
 */
async function readKnownContracts() {
  try {
    const stored = await getStoredValue(KNOWN_CONTRACTS_KEY);
    if (Array.isArray(stored)) return stored.filter((id) => typeof id === 'string');
    if (Array.isArray(stored?.contracts)) return stored.contracts;
    return [];
  } catch {
    return [];
  }
}

/**
 * Persist a newly-approved contract address.
 *
 * @param {string} contractId
 * @returns {Promise<string[]>} the updated list
 */
export async function trustContract(contractId) {
  const existing = await readKnownContracts();
  if (existing.includes(contractId)) return existing;
  const next = [...existing, contractId];
  await setStoredValue(KNOWN_CONTRACTS_KEY, next);
  return next;
}

/**
 * Decode a base64 transaction envelope.
 *
 * Handles both a plain `Transaction` and a `FeeBumpTransaction`, which is what
 * makes this usable for arbitrary externally-pasted XDR.
 *
 * @param {string} xdr
 * @param {string} network
 * @returns {object} the parsed transaction
 * @throws when the XDR is not a valid envelope for this network
 */
export function parseTransactionXdr(xdr, network) {
  const passphrase = NETWORKS[network]?.passphrase || NETWORKS.testnet.passphrase;
  // `fromXDR` dispatches on the envelope: a plain `Transaction` and a
  // `FeeBumpTransaction` both decode through it, so a pasted fee-bump — which
  // a wallet may well hand the user — is reviewed rather than rejected.
  return TransactionBuilder.fromXDR(xdr, passphrase);
}

/**
 * Ask Soroban RPC to simulate a parsed transaction. Never throws.
 *
 * Only Soroban invocations produce a meaningful Soroban-RPC simulation;
 * classic operations are not simulated by that endpoint, so we only spend a
 * round trip when there is something to simulate.
 *
 * @param {object} transaction
 * @param {string} network
 * @returns {Promise<object | null>} the response, or `null` if not attempted
 */
async function simulateForRiskContext(transaction, network) {
  const operations = Array.isArray(transaction?.operations) ? transaction.operations : [];
  const hasSorobanOp = operations.some((op) => op?.type === 'invokeHostFunction');
  if (!hasSorobanOp) return null;

  try {
    const server = getSorobanServer(network);
    return await server.simulateTransaction(transaction);
  } catch (error) {
    return { error: error?.message || 'Simulation request failed' };
  }
}

/**
 * Run the full pre-sign review for a transaction envelope.
 *
 * Exported separately from the hook so it can be unit-tested and reused by any
 * future flow that does not need React state.
 *
 * @param {string} xdr — base64 transaction envelope
 * @param {object} options
 * @param {string} options.network
 * @param {object|null} [options.account] — a pre-loaded account snapshot
 * @param {Function} [options.loadAccount] — override for the account loader
 * @param {Function} [options.simulate] — override for the simulator
 * @param {string[]} [options.knownContracts]
 * @returns {Promise<{ summary: object | null, transaction: object | null, error: string | null }>}
 */
export async function reviewTransaction(xdr, options = {}) {
  const {
    network = 'testnet',
    account = null,
    loadAccount = fetchAccount,
    simulate = simulateForRiskContext,
    knownContracts = [],
  } = options;

  let transaction = null;
  try {
    transaction = parseTransactionXdr(xdr, network);
  } catch (error) {
    return {
      summary: null,
      transaction: null,
      error: `Could not decode the transaction XDR: ${error?.message || 'unknown error'}`,
    };
  }

  // The effective source account: a fee-bump's operations belong to the inner
  // transaction's source, which is the account the risk rules should judge.
  const sourceAccount = transaction.source ?? transaction.innerTransaction?.source ?? null;

  // A supplied snapshot is only useful if it describes the account that is
  // actually spending the funds. For a pasted envelope the connected account
  // often differs from the source, and judging one account's balance-relative
  // risk against another's holdings would be wrong in both directions.
  const snapshotAccountId = account?.account_id ?? null;
  const snapshotMatchesSource =
    Boolean(snapshotAccountId) && (!sourceAccount || snapshotAccountId === sourceAccount);

  let snapshot = snapshotMatchesSource ? account : null;
  if (!snapshot && sourceAccount) {
    try {
      snapshot = await loadAccount(sourceAccount, network);
    } catch {
      // No snapshot is not fatal: the rules degrade to absolute thresholds and
      // the panel explains that balance-relative checks were skipped.
      snapshot = null;
    }
  }

  const simulation = await simulate(transaction, network);

  const summary = computeRiskSummary(transaction, {
    network,
    account: snapshot,
    sourceAccount,
    simulation,
    knownContracts,
  });

  return { summary, transaction, error: null };
}

/**
 * React hook wrapping {@link reviewTransaction} and the acknowledgement state.
 *
 * @returns {{
 *   summary: object | null,
 *   pendingXdr: string | null,
 *   reviewing: boolean,
 *   reviewError: string | null,
 *   beginReview: (xdr: string) => Promise<void>,
 *   cancelReview: () => void,
 *   onAcknowledged: (signFn: () => Promise<unknown>) => Promise<void>,
 *   onTrustContract: () => Promise<void>,
 *   knownContracts: string[],
 * }}
 */
export function usePreSignRiskSummary() {
  const { network, accountData } = useStore();
  const [summary, setSummary] = useState(null);
  const [pendingXdr, setPendingXdr] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [knownContracts, setKnownContracts] = useState([]);
  const mounted = useRef(true);
  // Mirrors of the two values `beginReview` depends on. A re-review triggered by
  // `onTrustContract` runs before React has re-rendered, so reading the state
  // closure there would reuse the pre-update allowlist and keep flagging the
  // contract the user just approved.
  const knownContractsRef = useRef(knownContracts);
  const pendingNetworkRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    readKnownContracts().then((list) => {
      if (!mounted.current) return;
      knownContractsRef.current = list;
      setKnownContracts(list);
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Parse, simulate and summarise the envelope, then present the panel.
   *
   * @param {string} xdr
   * @param {string} [networkOverride] — use this network instead of the store's
   * @returns {Promise<'shown' | 'pass' | 'error'>} — see `REVIEW_SHOWN` etc.
   */
  const beginReview = useCallback(
    async (xdr, networkOverride) => {
      if (!xdr?.trim()) return REVIEW_ERROR;
      setReviewing(true);
      setReviewError(null);
      try {
        const reviewNetwork = networkOverride || network;
        const result = await reviewTransaction(xdr, {
          network: reviewNetwork,
          account: accountData,
          knownContracts: knownContractsRef.current,
        });
        if (!mounted.current) return REVIEW_ERROR;
        if (result.error) {
          // Fail closed. An envelope we cannot decode is one we cannot describe,
          // so it must never reach a signing call.
          setSummary(null);
          setPendingXdr(null);
          setReviewError(result.error);
          return REVIEW_ERROR;
        }
        setSummary(result.summary);
        setPendingXdr(xdr);
        // Remember how this envelope was reviewed so any follow-up review of the
        // same envelope uses the same network.
        pendingNetworkRef.current = reviewNetwork;
        return REVIEW_SHOWN;
      } catch (error) {
        if (mounted.current) setReviewError(error?.message || 'Risk review failed');
        return REVIEW_ERROR;
      } finally {
        if (mounted.current) setReviewing(false);
      }
    },
    // `knownContracts` is read through `knownContractsRef`, which is kept in
    // sync above, so it is deliberately not a dependency here.
    [network, accountData]
  );

  const cancelReview = useCallback(() => {
    setSummary(null);
    setPendingXdr(null);
    pendingNetworkRef.current = null;
  }, []);

  /**
   * Run the wallet signing call only after the user acknowledged the summary.
   *
   * The reviewed envelope is passed to `signFn` rather than having it re-read
   * from component state: the user can still edit an XDR field while the panel
   * is open, and signing anything other than what was reviewed would defeat the
   * point of the review.
   *
   * @param {(xdr: string) => Promise<unknown>} signFn
   */
  const onAcknowledged = useCallback(
    async (signFn) => {
      const reviewed = pendingXdr;
      setSummary(null);
      setPendingXdr(null);
      await signFn?.(reviewed);
    },
    [pendingXdr]
  );

  const onTrustContract = useCallback(async () => {
    const contractId = summary?.flaggedContracts?.[0];
    if (!contractId) return;
    const next = await trustContract(contractId);
    if (!mounted.current) return;
    knownContractsRef.current = next;
    setKnownContracts(next);
    // Re-run the review so the freshly approved contract is no longer flagged,
    // keeping the network the envelope was originally reviewed against.
    if (pendingXdr) await beginReview(pendingXdr, pendingNetworkRef.current || undefined);
  }, [summary, pendingXdr, beginReview]);

  return {
    summary,
    pendingXdr,
    reviewing,
    reviewError,
    beginReview,
    cancelReview,
    onAcknowledged,
    onTrustContract,
    knownContracts,
  };
}

export default usePreSignRiskSummary;
