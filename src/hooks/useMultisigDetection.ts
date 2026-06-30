/**
 * useMultisigDetection
 *
 * Fetches the connected account from the Stellar network and determines whether
 * it requires multi-signature authorisation.  The hook re-runs whenever
 * `connectedAddress` or `network` changes.
 *
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5
 */

import { useEffect, useState } from 'react';
import { fetchAccount } from '../lib/stellar';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – multisig.js has no type declarations
import { parseAccountSigners } from '../lib/multisig.js';
import type { NetworkName } from '../lib/stellar';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SignerEntry {
  /** Stellar G… public key */
  key: string;
  /** Contribution weight (0–255) */
  weight: number;
  /** "ed25519_public_key" | "hash_x" | "pre_auth_tx" */
  type: string;
  /** True when this entry is the source account's own master key */
  isMaster: boolean;
}

export interface MultisigAccountInfo {
  /** True when the account needs more than the master key to authorise a transaction */
  isMultisig: boolean;
  /** Full signer list as returned by parseAccountSigners */
  signers: SignerEntry[];
  /** Account threshold values */
  thresholds: { low: number; medium: number; high: number };
  /** Weight of the master (source) key */
  masterWeight: number;
  /** True while the account fetch is in flight */
  loading: boolean;
  /** Non-null when the fetch failed; describes the problem */
  error: string | null;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const INITIAL_STATE: MultisigAccountInfo = {
  isMultisig: false,
  signers: [],
  thresholds: { low: 0, medium: 0, high: 0 },
  masterWeight: 1,
  loading: false,
  error: null,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * @param connectedAddress - The G… public key of the currently connected wallet,
 *                           or null / empty string when no wallet is connected.
 * @param network          - The Stellar network context to query.
 * @returns MultisigAccountInfo
 */
export function useMultisigDetection(
  connectedAddress: string | null,
  network: NetworkName,
): MultisigAccountInfo {
  const [state, setState] = useState<MultisigAccountInfo>(INITIAL_STATE);

  useEffect(() => {
    // Nothing to do when no address is available.
    if (!connectedAddress) {
      setState(INITIAL_STATE);
      return;
    }

    let cancelled = false;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetchAccount(connectedAddress, network)
      .then((accountData) => {
        if (cancelled) return;

        const { signers, thresholds, masterWeight } = parseAccountSigners(accountData) as {
          signers: SignerEntry[];
          thresholds: { low: number; medium: number; high: number };
          masterWeight: number;
        };

        // Req 1.2: detect multisig when co-signers with non-zero weight exist,
        // OR the master key weight alone is insufficient for low-threshold ops.
        const hasCoSigners = signers.some((s) => !s.isMaster && s.weight > 0);
        const masterInsufficientForLow = thresholds.low > masterWeight;
        const isMultisig = hasCoSigners || masterInsufficientForLow;

        // Req 1.5: suppress panel when master weight meets low threshold.
        // (isMultisig already handles this — it is false in that case.)

        setState({
          isMultisig,
          signers,
          thresholds,
          masterWeight,
          loading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        // Req 1.4: on fetch failure, fall back to single-signer flow.
        const message =
          err instanceof Error
            ? err.message
            : 'Multisig detection unavailable. Proceeding with single-signer flow.';

        setState({
          isMultisig: false,
          signers: [],
          thresholds: { low: 0, medium: 0, high: 0 },
          masterWeight: 1,
          loading: false,
          error: message,
        });
      });

    return () => {
      // Prevent stale updates if the address changes before the fetch resolves.
      cancelled = true;
    };
  }, [connectedAddress, network]);

  return state;
}

export default useMultisigDetection;
