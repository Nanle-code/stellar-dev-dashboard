/**
 * Sequence number reservation and local conflict detection for the
 * transaction builder.
 *
 * Stellar requires every transaction from a given source account to carry the
 * account's *next* sequence number. When a user keeps several drafts around for
 * the same source account there is no server-side lock on the sequence number,
 * so two drafts can silently target the same sequence and only one of them will
 * ever submit successfully.
 *
 * This module is intentionally pure (no network, no DOM) so the reservation and
 * conflict-detection logic can be unit tested in isolation. The browser-facing
 * integration lives in `lib/txHistory` (draft persistence) and
 * `components/dashboard/TransactionBuilder` (reservation on save + warnings).
 */

export type ReservedDraft = {
  id: string;
  name: string;
  sourceAccount: string;
  /** The sequence number this draft's transaction will consume. `null` when it
   * could not be reserved (invalid account, unreachable network, etc.). */
  reservedSequence: string | null;
  network: string;
  reservedAt?: number;
  createdAt?: number;
};

export type SequenceConflict = {
  sourceAccount: string;
  reservedSequence: string;
  draftIds: string[];
  count: number;
};

export type UnresolvedReservation = {
  sourceAccount: string;
  reason: string;
  drafts: string[];
};

export type SequenceWarnings = {
  conflicts: SequenceConflict[];
  unresolved: UnresolvedReservation[];
};

export const SEQUENCE_RESERVATION_VERSION = 1;

const SEQUENCE_NUMBER_CACHE_KEY = "tx_builder_sequence_reservation_cache_v1";

/**
 * Parse a sequence number value into a non-negative BigInt.
 *
 * Returns `null` for any value that cannot be interpreted as a valid sequence
 * number — this centralises the "invalid input" handling so callers never have
 * to worry about malformed strings or negative numbers.
 */
export function parseSequenceNumber(value: unknown): bigint | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const n = BigInt(String(value));
    if (n < 0n) return null;
    return n;
  } catch {
    return null;
  }
}

/**
 * Persist the in-memory sequence reservation cache. The cache maps a
 * `sourceAccount` to the highest reserved sequence number seen for it, so we
 * never hand out a sequence that collides with an already-stored draft.
 *
 * No-ops gracefully when `localStorage` is unavailable (SSR, private mode,
 * quota errors) so the builder degrades to network-only reservation.
 */
export function saveSequenceCache(cache: Record<string, string>): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      SEQUENCE_NUMBER_CACHE_KEY,
      JSON.stringify(cache)
    );
  } catch {
    // Storage is best-effort; reservation still works for the current session.
  }
}

/**
 * Read the persisted sequence reservation cache. Returns `{}` when storage is
 * missing, empty, or corrupted.
 */
export function loadSequenceCache(): Record<string, string> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(SEQUENCE_NUMBER_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Compute the next sequence number to reserve for `sourceAccount`.
 *
 * The next sequence is `max(accountSequence, highest existing reservation for
 * this account) + 1`. This guarantees that successive drafts for the same
 * account never collide with each other, even when the local account sequence
 * has not yet advanced because an earlier draft was already submitted.
 *
 * Returns `null` when the supplied account sequence is not a valid non-negative
 * integer (invalid input / unsupported environment).
 */
export function computeNextReservedSequence(
  existing: ReservedDraft[],
  accountSequence: string | bigint | number,
  sourceAccount: string
): string | null {
  const base = parseSequenceNumber(accountSequence);
  if (base === null) return null;

  let max = base;
  for (const draft of existing) {
    if (draft.sourceAccount !== sourceAccount) continue;
    const reserved = parseSequenceNumber(draft.reservedSequence);
    if (reserved !== null && reserved > max) {
      max = reserved;
    }
  }

  return (max + 1n).toString();
}

/**
 * Group a list of drafts by source account and surface every sequence-number
 * collision as a conflict, plus any drafts that could not be reserved at all.
 *
 * Two drafts conflict when they share the same source account **and** the same
 * non-null `reservedSequence` — only one of them can ever submit successfully.
 */
export function detectSequenceConflicts(drafts: ReservedDraft[]): SequenceWarnings {
  const conflicts: SequenceConflict[] = [];
  const unresolved: UnresolvedReservation[] = [];

  const byAccount: Record<string, ReservedDraft[]> = {};
  const unresolvedByAccount: Record<string, string[]> = {};

  for (const draft of drafts) {
    if (!draft.sourceAccount) {
      const entry = unresolvedByAccount["__no_source_account__"];
      if (entry) entry.push(draft.id);
      else unresolvedByAccount["__no_source_account__"] = [draft.id];
      continue;
    }

    if (!draft.reservedSequence || parseSequenceNumber(draft.reservedSequence) === null) {
      const entry = unresolvedByAccount[draft.sourceAccount];
      if (entry) entry.push(draft.id);
      else unresolvedByAccount[draft.sourceAccount] = [draft.id];
      continue;
    }

    if (!byAccount[draft.sourceAccount]) byAccount[draft.sourceAccount] = [];
    byAccount[draft.sourceAccount].push(draft);
  }

  for (const sourceAccount of Object.keys(unresolvedByAccount)) {
    unresolved.push({
      sourceAccount,
      reason:
        sourceAccount === "__no_source_account__"
          ? "Draft has no source account."
          : "Sequence number could not be reserved for this draft.",
      drafts: unresolvedByAccount[sourceAccount],
    });
  }

  for (const sourceAccount of Object.keys(byAccount)) {
    const group = byAccount[sourceAccount];
    const bySeq: Record<string, ReservedDraft[]> = {};
    for (const draft of group) {
      const key = draft.reservedSequence as string;
      if (!bySeq[key]) bySeq[key] = [];
      bySeq[key].push(draft);
    }

    for (const seq of Object.keys(bySeq)) {
      const dupes = bySeq[seq];
      if (dupes.length > 1) {
        conflicts.push({
          sourceAccount,
          reservedSequence: seq,
          draftIds: dupes.map((d) => d.id),
          count: dupes.length,
        });
      }
    }
  }

  return { conflicts, unresolved };
}

/**
 * Human-readable summary used by the transaction builder UI to explain a
 * reservation outcome (reservation made, skipped, or failed).
 */
export function formatReservationNotice(
  sourceAccount: string | null,
  network: string | null,
  reservedSequence: string | null,
  error: string | null
): { type: "reserved" | "reserved-fallback" | "skipped" | "failed"; message: string } {
  if (!sourceAccount) {
    return {
      type: "skipped",
      message: "No source account set — sequence could not be reserved.",
    };
  }

  if (network === "local" || !network) {
    return {
      type: "skipped",
      message: `Local network has no reachable Horizon — sequence reservation is unavailable.`,
    };
  }

  if (reservedSequence) {
    return {
      type: "reserved",
      message: `Reserved sequence ${reservedSequence} for ${truncateAddress(sourceAccount)}.`,
    };
  }

  if (error) {
    return {
      type: "failed",
      message: `Sequence reservation failed: ${error}`,
    };
  }

  return {
    type: "skipped",
    message: "Sequence number could not be reserved.",
  };
}

function truncateAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

/**
 * Determine whether the active transaction's intended sequence number would
 * collide with any reservation already held by a saved draft for the same
 * source account.
 */
export function findActiveSequenceCollision(
  drafts: ReservedDraft[],
  sourceAccount: string,
  activeSequence: string | bigint | number
): SequenceConflict | null {
  const active = parseSequenceNumber(activeSequence);
  if (active === null || !sourceAccount) return null;

  const matching = drafts.filter(
    (d) =>
      d.sourceAccount === sourceAccount &&
      parseSequenceNumber(d.reservedSequence) === active
  );

  if (matching.length === 0) return null;

  return {
    sourceAccount,
    reservedSequence: matching[0].reservedSequence as string,
    draftIds: matching.map((d) => d.id),
    count: matching.length,
  };
}
