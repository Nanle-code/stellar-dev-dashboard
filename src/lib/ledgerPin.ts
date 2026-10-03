/**
 * ledgerPin.ts — point-in-time (ledger sequence) pinning for shared views.
 *
 * A shared view can optionally pin the ledger sequence it was captured at, so a
 * teammate looking at the link later sees the same "as of" data instead of
 * whatever the chain looks like now.
 *
 * Not every data source can honour a pin, and pretending otherwise would be
 * worse than not offering it. The support matrix below records, per view, how
 * a pin is actually applied:
 *
 *  - `cursor`   Horizon paginated endpoints (transactions, operations,
 *               payments, offers). A ledger sequence is a valid Horizon paging
 *               token, so a pinned read is a `desc` page starting at that
 *               sequence — deterministic and repeatable. See
 *               `ledgerCursorFor()`.
 *  - `paging`   Local/aggregate history assembled from the ledger feed. The
 *               store already retains a bounded `ledgerHistory`; we can slice it
 *               at the pin without touching the network.
 *  - `none`     The source has no historical read. Soroban RPC exposes current
 *               state only (no `getLedgerEntries` at a past ledger), and
 *               simulation always evaluates against the latest ledger. A pin is
 *               recorded in the URL for provenance but is NOT applied to reads.
 *
 * Honesty matters more than coverage here: `isLedgerPinHonoured()` returning
 * false is surfaced in the UI, so a recipient is never misled into thinking
 * contract state is frozen.
 */

import type { NetworkName } from './stellar';

/** How a pinned ledger sequence is applied for a given data source. */
export type LedgerPinStrategy = 'cursor' | 'paging' | 'none';

export interface LedgerPinSupport {
  /** True only when reads are actually restricted to the pinned ledger. */
  honoured: boolean;
  strategy: LedgerPinStrategy;
  /** Human-readable explanation shown in the Share panel / banner. */
  note: string;
}

/**
 * Ledger sequences are unsigned 64-bit values on the wire, but a value that
 * cannot survive a round trip through JSON.parse without precision loss must be
 * rejected outright rather than silently rounded.
 */
export const MAX_LEDGER_SEQUENCE = Number.MAX_SAFE_INTEGER;

/** Lowest sequence we accept. Ledger 0 has no transactions, so it is never a
 *  meaningful pin target and is treated as "no pin". */
export const MIN_LEDGER_SEQUENCE = 1;

/**
 * Per-tab pin strategy.
 *
 * Keyed by route id (the same keys as the `TABS` registry in
 * `src/routes/DashboardLayout.tsx`) plus the pseudo-route `connect`.
 */
export const TAB_PIN_STRATEGY: Record<string, LedgerPinStrategy> = {
  // Horizon paginated reads — pin applied as a `desc` cursor.
  overview: 'cursor',
  account: 'cursor',
  transactions: 'cursor',
  claimableBalances: 'cursor',
  search: 'cursor',
  liveActivity: 'cursor',
  compare: 'cursor',
  dex: 'cursor',
  anchors: 'cursor',
  realtime: 'cursor',
  // Bounded local history assembled from the ledger feed.
  network: 'paging',
  // Soroban RPC and derived analytics have no historical read.
  contracts: 'none',
  contractInteraction: 'none',
  contractABI: 'none',
  sorobanDebug: 'none',
  analytics: 'none',
  txAnalytics: 'none',
  portfolio: 'none',
  multisig: 'none',
};

/** Route ids known to fall back to `none` regardless of registry state. */
const DEFAULT_STRATEGY: LedgerPinStrategy = 'none';

const STRATEGY_NOTES: Record<LedgerPinStrategy, string> = {
  cursor:
    'Pinned via a Horizon paging cursor: records are read newest-first from ledger ' +
    'at the pinned sequence, so the result is deterministic.',
  paging:
    'Pinned against the locally retained ledger history. The page is sliced at the ' +
    'pinned sequence; no additional network request is made.',
  none:
    'This data source has no historical read, so the pinned sequence is recorded ' +
    'for reference only and live data is shown.',
};

export const NO_LEDGER_PIN_SUPPORTED: LedgerPinSupport = {
  honoured: false,
  strategy: 'none',
  note: STRATEGY_NOTES.none,
};

/**
 * Describe how a pin behaves for a given route id.
 * Unknown routes get the conservative `none` strategy.
 */
export function describeLedgerPinSupport(tab: string | null | undefined): LedgerPinSupport {
  const strategy = (tab && TAB_PIN_STRATEGY[tab]) || DEFAULT_STRATEGY;
  return { honoured: strategy !== 'none', strategy, note: STRATEGY_NOTES[strategy] };
}

/** Convenience predicate over {@link describeLedgerPinSupport}. */
export function isLedgerPinHonoured(tab: string | null | undefined): boolean {
  return describeLedgerPinSupport(tab).honoured;
}

/**
 * Normalize a raw ledger sequence from a URL param, an input, or the ledger
 * feed into a pinnable sequence.
 *
 * Boundary rules (all return `null` rather than throwing, because this runs
 * against untrusted URL input on every page load):
 *  - non-numeric, `NaN`, `±Infinity` → `null`
 *  - fractional (`1234.5`) → `null` (a sequence is an integer ledger)
 *  - `< 1` or `> MAX_LEDGER_SEQUENCE` → `null`
 *  - empty / whitespace-only / null / undefined → `null`
 *  - numeric strings are accepted (`'1234'` → `1234`) since URL params are text
 *
 * @param raw candidate sequence
 * @returns a safe integer sequence, or `null` when not pinnable
 */
export function normalizeLedgerSequence(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  let value: number;
  if (typeof raw === 'number') {
    value = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    // Reject exponent/hex/whitespace-in-the-middle forms outright: `Number`
    // would happily accept '1e3' or '0x10', which are not ledger sequences.
    if (!/^\d+$/.test(trimmed)) return null;
    value = Number(trimmed);
  } else {
    return null;
  }

  if (!Number.isSafeInteger(value)) return null;
  if (value < MIN_LEDGER_SEQUENCE || value > MAX_LEDGER_SEQUENCE) return null;
  return value;
}

export type LedgerPageOrder = 'asc' | 'desc';

/**
 * Build the Horizon paging cursor that reads records as of a pinned sequence.
 *
 * Horizon accepts a bare ledger number as a paging token. With `order=desc` a
 * page starting at that cursor contains only records from ledgers at or before
 * the cursor, which is what "as of sequence S" means for a newest-first view.
 *
 * With `order=asc` the same cursor would walk *forward* from the pin, which is
 * the opposite of a point-in-time read, so it is rejected — silently paging
 * forward would hand the recipient data that does not match the snapshot.
 *
 * @param sequence a normalized sequence (see {@link normalizeLedgerSequence})
 * @param order the page order the caller intends to use
 * @returns the cursor string, or `null` when the sequence/order pair is unusable
 */
export function ledgerCursorFor(
  sequence: number | null | undefined,
  order: LedgerPageOrder = 'desc'
): string | null {
  const normalized = normalizeLedgerSequence(sequence);
  if (normalized === null) return null;
  if (order !== 'desc') return null;
  return String(normalized);
}

/**
 * Whether a pinned sequence is still reachable on a given network.
 *
 * A pin ahead of the network's current ledger cannot be read yet; a pin far
 * behind it may have been pruned by Horizon's ingestion window. Callers pass the
 * latest known sequence and the lower bound they consider trustworthy.
 */
export function isLedgerPinReachable(
  sequence: number | null | undefined,
  latestSequence: number | null | undefined,
  options: { oldestAvailableSequence?: number } = {}
): boolean {
  const pinned = normalizeLedgerSequence(sequence);
  if (pinned === null) return false;

  const latest = normalizeLedgerSequence(latestSequence);
  if (latest !== null && pinned > latest) return false;

  const oldest = options.oldestAvailableSequence;
  if (oldest !== undefined && oldest !== null) {
    const floor = normalizeLedgerSequence(oldest);
    if (floor !== null && pinned < floor) return false;
  }

  return true;
}

/**
 * Pick the sequence to pin by default: the most recent one the dashboard has
 * actually observed. Only the two numeric ledger feeds are consulted
 * (`ledgerHistory` and `streamLedgers`); `networkStats.latestLedger` is a
 * Horizon `LedgerRecord` object rather than a bare sequence, so it is not a
 * usable pin target here.
 *
 * Falls back to `null` (no pin) when nothing is known yet, so the Share UI can
 * explain *why* pinning is unavailable instead of fabricating a sequence.
 */
export function currentLedgerSequence(sources: {
  ledgerHistory?: ReadonlyArray<{ sequence?: unknown }> | null;
  streamLedgers?: ReadonlyArray<{ sequence?: unknown }> | null;
}): number | null {
  const candidates = [
    ...(sources.ledgerHistory ?? []).map((entry) => entry?.sequence),
    ...(sources.streamLedgers ?? []).map((entry) => entry?.sequence),
  ];

  let best: number | null = null;
  for (const candidate of candidates) {
    const seq = normalizeLedgerSequence(candidate);
    if (seq !== null && (best === null || seq > best)) best = seq;
  }
  return best;
}

export interface LedgerPinDescriptor {
  sequence: number | null;
  network: NetworkName | null;
  support: LedgerPinSupport;
}

export function describeLedgerPin(
  tab: string | null | undefined,
  sequence: number | null | undefined,
  network?: NetworkName | null
): LedgerPinDescriptor {
  return {
    sequence: normalizeLedgerSequence(sequence),
    network: network ?? null,
    support: describeLedgerPinSupport(tab),
  };
}
