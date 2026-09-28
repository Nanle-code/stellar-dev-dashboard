/**
 * useSharedView — apply and expose a shared view encoded in the URL query.
 *
 * A shared link is only useful if opening it *rebuilds* the view, so this hook
 * is the bridge between the URL and the store. It runs in three steps:
 *
 *   1. **Parse** the query string into a validated snapshot (`parseShareUrl`).
 *   2. **Apply** it to the store — network, route, entity, filters, ledger pin.
 *   3. **Report** the deltas the recipient needs to know about: a network
 *      mismatch and whether this view can actually honour the pinned ledger.
 *
 * Applying is idempotent and guarded by the raw query string, so navigating
 * around inside a shared view does not fight the URL, and re-rendering does not
 * re-apply (which would clobber edits the recipient made after opening the link).
 *
 * Only the fields the link declares are ever written. Wallet state, session
 * state, and the recipient's own connected address are never touched by a
 * shared link: a link describes *what to look at*, never *who you are*.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import {
  buildFilterPatch,
  isNetworkMismatch,
  parseShareUrl,
  stripShareParams,
  type EntityKind,
  type ViewSnapshot,
} from '../lib/shareLinks';
import { describeLedgerPinSupport, type LedgerPinSupport } from '../lib/ledgerPin';
import type { NetworkName } from '../lib/stellar';

export interface SharedView {
  /** The decoded snapshot, or `null` when the URL is not a shared view. */
  snapshot: ViewSnapshot | null;
  /** Non-fatal decode problems (unknown tab, bad ledger, …). */
  warnings: string[];
  /** True when the URL currently describes a shared view. */
  isSharedView: boolean;
  /** The network the link was captured on. */
  snapshotNetwork: NetworkName | null;
  /** True when that network differs from the recipient's active network. */
  networkMismatch: boolean;
  /** The recipient's currently active network. */
  activeNetwork: NetworkName;
  /** Whether the pinned ledger is actually applied for this route. */
  ledgerSupport: LedgerPinSupport;
  /** Currently applied pin. */
  ledgerPin: number | null;
  /** Remove the share params from the URL and clear the applied snapshot. */
  exitSharedView: () => void;
  /** Adopt the link's network, then clear the mismatch banner. */
  switchToSnapshotNetwork: () => void;
}

export interface UseSharedViewOptions {
  /**
   * Route ids the app can render. An unknown `t=` value is dropped (the view
   * falls back to the overview) rather than routed to something unexpected.
   */
  knownTabs?: readonly string[];
  /** Disable applying the snapshot (e.g. in a test harness). */
  apply?: boolean;
}

export function useSharedView(options: UseSharedViewOptions = {}): SharedView {
  const location = useLocation();
  const navigate = useNavigate();

  const network = useStore((state) => state.network);
  const setNetwork = useStore((state) => state.setNetwork);
  const setActiveTab = useStore((state) => state.setActiveTab);
  const setContractId = useStore((state) => state.setContractId);
  const setConnectedAddress = useStore((state) => state.setConnectedAddress);
  const setSearchFilters = useStore((state) => state.setSearchFilters);
  const setFilterExpressions = useStore((state) => state.setFilterExpressions);
  const ledgerPin = useStore((state) => state.ledgerPin);
  const setLedgerPin = useStore((state) => state.setLedgerPin);

  const search = location.search;
  const { knownTabs, apply = true } = options;

  const parsed = useMemo(
    () => parseShareUrl(search, { knownTabs: knownTabs ?? null }),
    [search, knownTabs]
  );

  // The snapshot as last *applied*, which is not necessarily the snapshot as
  // last *parsed*: the recipient may have since changed networks or tabs, and
  // the banner must describe the difference, not re-assert the link.
  const [applied, setApplied] = useState<ViewSnapshot | null>(null);
  const [unrestorableEntity, setUnrestorableEntity] = useState<EntityKind | null>(null);
  const appliedSearchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!apply) return;
    // Already processed this exact query string — do not re-apply, or a
    // recipient's own edits would be reverted on every re-render.
    if (appliedSearchRef.current === search) return;
    appliedSearchRef.current = search;

    if (!parsed.ok || !parsed.snapshot) {
      setApplied(null);
      setUnrestorableEntity(null);
      return;
    }

    const snapshot = parsed.snapshot;

    // The network is deliberately NOT auto-switched. Silently flipping the
    // recipient onto the sender's network would erase the mismatch the banner
    // exists to report, and would refetch everything under a network the
    // recipient never chose. We apply the *view*, keep their network, and let
    // `switchToSnapshotNetwork()` make the change an explicit, informed one.
    //
    // Set unconditionally. The rendered view is driven by the store's
    // `activeTab`, which nothing else reconciles with the URL (the pathname and
    // the store can legitimately disagree), so deriving this from the pathname
    // would leave the link's tab unapplied.
    setActiveTab(snapshot.tab);
    if (snapshot.entity?.kind === 'contract') {
      setContractId(snapshot.entity.id);
    } else if (snapshot.entity?.kind === 'account') {
      // The *viewed* account, not the signing wallet: this is public ledger
      // data and is what makes the shared view reproduce. `walletPublicKey` is
      // never written from a link.
      setConnectedAddress(snapshot.entity.id);
    } else if (snapshot.entity) {
      // The link is valid — the kind passed decode validation — but the store
      // has no field to represent it, so the view cannot be restored. Say so
      // rather than dropping it silently and letting the recipient believe they
      // are looking at the right transaction.
      setUnrestorableEntity(snapshot.entity.kind);
    }

    const filterPatch = buildFilterPatch(snapshot.filters);
    if (filterPatch) setSearchFilters(filterPatch);
    if (snapshot.expressions.length > 0) {
      setFilterExpressions(snapshot.expressions);
    }

    setLedgerPin(snapshot.ledger);
    setApplied(snapshot);

    // Keep the URL honest. `RouterSync` (the path→tab reconciler) is not
    // mounted, so nothing else corrects a view whose tab no longer matches the
    // path. Without this, a link with `t=transactions` would render the
    // transactions view while the address bar still read `/`, which breaks
    // reload, the back button, and "copy link to this view".
    //
    // The share params are carried across verbatim. The effect is guarded on
    // `search`, so the resulting re-render short-circuits and this cannot loop.
    const currentTab = location.pathname === '/' ? 'overview' : location.pathname.slice(1);
    if (currentTab !== snapshot.tab) {
      navigate({ pathname: `/${snapshot.tab}`, search: location.search }, { replace: true });
    }
  }, [
    apply,
    search,
    parsed,
    location.pathname,
    navigate,
    setActiveTab,
    setContractId,
    setConnectedAddress,
    setSearchFilters,
    setFilterExpressions,
    setLedgerPin,
  ]);

  const exitSharedView = useCallback(() => {
    appliedSearchRef.current = null;
    setApplied(null);
    setUnrestorableEntity(null);
    setLedgerPin(null);
    navigate(
      { pathname: location.pathname, search: stripShareParams(location.search) },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate, setLedgerPin]);

  const switchToSnapshotNetwork = useCallback(() => {
    const target = applied?.network;
    if (!target) return;
    setNetwork(target);
  }, [applied, setNetwork]);

  const warnings = useMemo(() => {
    const all = [...parsed.warnings];
    if (unrestorableEntity) all.push(`entity-not-applied:${unrestorableEntity}`);
    return all;
  }, [parsed.warnings, unrestorableEntity]);

  return {
    snapshot: applied,
    warnings,
    isSharedView: applied !== null,
    snapshotNetwork: applied?.network ?? null,
    networkMismatch: isNetworkMismatch(applied, network),
    activeNetwork: network,
    ledgerSupport: describeLedgerPinSupport(applied?.tab ?? null),
    ledgerPin,
    exitSharedView,
    switchToSnapshotNetwork,
  };
}
