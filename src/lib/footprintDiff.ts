/**
 * Footprint diff viewer for Soroban simulations (#849).
 *
 * `simulateContractCall` in `src/lib/stellar.ts` already serializes the
 * simulated footprint (read-only / read-write ledger keys plus the minimum
 * resource fee). This module diffs two of those footprints so unexpected
 * resource access between successive simulations is highlighted before a
 * transaction is signed and submitted.
 *
 * Every function is pure and DOM-free, so it runs in jsdom tests, node tools,
 * and the browser. All inputs are validated: footprints captured from a
 * failed simulation (`footprint: null`) are surfaced as a clear failure
 * instead of throwing deep inside the render tree.
 */

/** Serialized ledger key as produced by `simulateContractCall`. */
export interface SerializedLedgerKey {
  type: string;
  xdr: string;
}

export interface FootprintSnapshot {
  readOnly: SerializedLedgerKey[];
  readWrite: SerializedLedgerKey[];
  minResourceFee: string;
}

export type FootprintEntryKind = 'added' | 'removed' | 'unchanged';

export interface FootprintEntryChange {
  /** Key classification: which side of the diff it belongs to. */
  kind: FootprintEntryKind;
  /** `readOnly` or `readWrite` — the footprint section the key lives in. */
  section: 'readOnly' | 'readWrite';
  /** Serialized ledger key (xdr + type). */
  key: SerializedLedgerKey;
}

export interface FootprintDiffWarning {
  code: 'unexpected-write' | 'write-grew' | 'fee-increased' | 'unknown-key-type';
  message: string;
  /** XDR of the ledger key responsible, when the warning is key-specific. */
  key?: string;
}

export interface FootprintDiff {
  added: FootprintEntryChange[];
  removed: FootprintEntryChange[];
  unchanged: FootprintEntryChange[];
  /** Net counts for quick display in headers and summaries. */
  summary: {
    addedCount: number;
    removedCount: number;
    unchangedCount: number;
    readWriteAdded: number;
    readWriteRemoved: number;
    baseMinResourceFee: string | null;
    nextMinResourceFee: string | null;
    minResourceFeeDelta: string | null;
  };
  warnings: FootprintDiffWarning[];
  /** True when both footprints declare exactly the same keys and fee. */
  identical: boolean;
}

export interface FootprintSectionChange {
  section: 'readOnly' | 'readWrite';
  added: SerializedLedgerKey[];
  removed: SerializedLedgerKey[];
  unchanged: SerializedLedgerKey[];
}

export interface FootprintDiffReport {
  identical: boolean;
  sections: FootprintSectionChange[];
  summary: FootprintDiff['summary'];
  warnings: FootprintDiffWarning[];
}

const VALID_SECTIONS = ['readOnly', 'readWrite'] as const;

const SURPRISING_WRITE_TYPES = new Set([
  'LEDGER_KEY_CONTRACT_CODE',
  'LEDGER_KEY_CLAIMABLE_BALANCE',
  'LEDGER_KEY_LIQUIDITY_POOL',
  'LEDGER_KEY_TRUSTLINE',
]);

function isSerializedLedgerKey(value: unknown): value is SerializedLedgerKey {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SerializedLedgerKey).xdr === 'string' &&
    typeof (value as SerializedLedgerKey).type === 'string'
  );
}

function isFootprintLike(value: unknown): value is FootprintSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<FootprintSnapshot> & Record<string, unknown>;
  return (
    Array.isArray(candidate.readOnly) &&
    Array.isArray(candidate.readWrite) &&
    candidate.readOnly.every(isSerializedLedgerKey) &&
    candidate.readWrite.every(isSerializedLedgerKey) &&
    (candidate.minResourceFee === undefined ||
      typeof candidate.minResourceFee === 'string')
  );
}

/** Human-readable reason why a value is not a usable footprint snapshot. */
export function explainInvalidFootprint(value: unknown): string | null {
  if (value === null || value === undefined) {
    return 'Footprint is missing: the simulation failed or returned no transaction data.';
  }
  if (!isFootprintLike(value)) {
    return 'Footprint is malformed: expected readOnly and readWrite arrays of serialized ledger keys.';
  }
  for (const section of VALID_SECTIONS) {
    const entries = value[section];
    const invalid = entries.find((entry) => !entry.xdr.trim() || !entry.type.trim());
    if (invalid) {
      return `Footprint contains an invalid ledger key in ${section}: empty xdr or type.`;
    }
  }
  return null;
}

function parseFee(fee: string | null | undefined): number | null {
  if (fee == null) return null;
  const parsed = Number(fee);
  return Number.isFinite(parsed) ? parsed : null;
}

function dedupeAndIndex(
  keys: SerializedLedgerKey[],
): Map<string, SerializedLedgerKey> {
  const index = new Map<string, SerializedLedgerKey>();
  for (const key of keys) {
    if (!index.has(key.xdr)) {
      index.set(key.xdr, key);
    }
  }
  return index;
}

function diffSection(
  base: Map<string, SerializedLedgerKey>,
  next: Map<string, SerializedLedgerKey>,
  section: 'readOnly' | 'readWrite',
): FootprintSectionChange {
  const added: SerializedLedgerKey[] = [];
  const removed: SerializedLedgerKey[] = [];
  const unchanged: SerializedLedgerKey[] = [];

  for (const [xdr, key] of next) {
    if (base.has(xdr)) {
      unchanged.push(key);
    } else {
      added.push(key);
    }
  }
  for (const [xdr, key] of base) {
    if (!next.has(xdr)) {
      removed.push(key);
    }
  }

  return { section, added, removed, unchanged };
}

function isSurprisingWrite(key: SerializedLedgerKey): boolean {
  const normalizedType = key.type.replace(/^ledger_key_/i, '').toUpperCase();
  return SURPRISING_WRITE_TYPES.has(`LEDGER_KEY_${normalizedType}`) ||
    SURPRISING_WRITE_TYPES.has(normalizedType);
}

function buildWarnings(
  sections: FootprintSectionChange[],
  baseFee: string | null,
  nextFee: string | null,
): FootprintDiffWarning[] {
  const warnings: FootprintDiffWarning[] = [];

  for (const section of sections) {
    for (const key of section.added) {
      if (section.section === 'readWrite' && isSurprisingWrite(key)) {
        warnings.push({
          code: 'unexpected-write',
          message: `New read-write access to a ${key.type} ledger key was not present in the previous simulation.`,
          key: key.xdr,
        });
      }
    }

    const nextUnchanged = section.unchanged.length + section.added.length;
    const baseTotal = section.unchanged.length + section.removed.length;
    if (section.section === 'readWrite' && baseTotal > 0 && nextUnchanged > baseTotal * 2) {
      warnings.push({
        code: 'write-grew',
        message: `Read-write footprint more than doubled (${baseTotal} → ${nextUnchanged} keys). Verify the operation targets the intended storage.`,
      });
    }
  }

  const baseAmount = parseFee(baseFee);
  const nextAmount = parseFee(nextFee);
  if (baseAmount !== null && nextAmount !== null && nextAmount > baseAmount) {
    const growth = ((nextAmount - baseAmount) / baseAmount) * 100;
    if (growth >= 25) {
      warnings.push({
        code: 'fee-increased',
        message: `Minimum resource fee grew ${growth.toFixed(1)}% (${baseFee} → ${nextFee} stroops).`,
      });
    }
  }

  for (const section of sections) {
    for (const key of [...section.added, ...section.removed, ...section.unchanged]) {
      if (!key.type || key.type === 'unknown') {
        warnings.push({
          code: 'unknown-key-type',
          message: 'A ledger key in the footprint could not be classified; inspect the raw XDR before submitting.',
          key: key.xdr,
        });
      }
    }
  }

  return warnings;
}

/**
 * Diff two footprint snapshots captured from successive simulations.
 *
 * Throws a descriptive error when either snapshot is missing or malformed so
 * callers can show a clear message instead of failing mid-render.
 */
export function diffFootprints(
  base: FootprintSnapshot,
  next: FootprintSnapshot,
): FootprintDiffReport {
  const baseError = explainInvalidFootprint(base);
  if (baseError) throw new Error(`Baseline footprint: ${baseError}`);

  const nextError = explainInvalidFootprint(next);
  if (nextError) throw new Error(`Comparison footprint: ${nextError}`);

  const sections: FootprintSectionChange[] = [];
  for (const section of VALID_SECTIONS) {
    sections.push(diffSection(dedupeAndIndex(base[section]), dedupeAndIndex(next[section]), section));
  }

  const added = sections.flatMap((s) => s.added.map((key) => ({ kind: 'added' as const, section: s.section, key })));
  const removed = sections.flatMap((s) => s.removed.map((key) => ({ kind: 'removed' as const, section: s.section, key })));
  const unchanged = sections.flatMap((s) => s.unchanged.map((key) => ({ kind: 'unchanged' as const, section: s.section, key })));

  const baseMinResourceFee = base.minResourceFee ?? null;
  const nextMinResourceFee = next.minResourceFee ?? null;
  const baseFeeNumber = parseFee(baseMinResourceFee);
  const nextFeeNumber = parseFee(nextMinResourceFee);
  const minResourceFeeDelta =
    baseFeeNumber !== null && nextFeeNumber !== null
      ? String(nextFeeNumber - baseFeeNumber)
      : null;

  const identical =
    added.length === 0 &&
    removed.length === 0 &&
    (baseMinResourceFee ?? '') === (nextMinResourceFee ?? '');

  const warnings = identical ? [] : buildWarnings(sections, baseMinResourceFee, nextMinResourceFee);

  return {
    identical,
    sections,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      unchangedCount: unchanged.length,
      readWriteAdded: sections.find((s) => s.section === 'readWrite')?.added.length ?? 0,
      readWriteRemoved: sections.find((s) => s.section === 'readWrite')?.removed.length ?? 0,
      baseMinResourceFee,
      nextMinResourceFee,
      minResourceFeeDelta,
    },
    warnings,
  };
}

/** Short label for a serialized ledger key: type plus a trimmed XDR preview. */
export function describeLedgerKey(key: SerializedLedgerKey): string {
  if (!isSerializedLedgerKey(key)) return 'invalid key';
  const preview = key.xdr.length > 18 ? `${key.xdr.slice(0, 15)}…` : key.xdr;
  return `${key.type || 'unknown'} (${preview})`;
}
