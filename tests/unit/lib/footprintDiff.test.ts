import { describe, it, expect } from 'vitest';
import {
  diffFootprints,
  explainInvalidFootprint,
  describeLedgerKey,
  type FootprintSnapshot,
  type SerializedLedgerKey,
} from '../../../src/lib/footprintDiff';

function key(xdr: string, type = 'LEDGER_KEY_CONTRACT_DATA'): SerializedLedgerKey {
  return { type, xdr };
}

function snapshot(
  readOnly: SerializedLedgerKey[],
  readWrite: SerializedLedgerKey[],
  minResourceFee = '1000',
): FootprintSnapshot {
  return { readOnly, readWrite, minResourceFee };
}

const KEY_A = key('a', 'LEDGER_KEY_CONTRACT_DATA');
const KEY_B = key('b', 'LEDGER_KEY_ACCOUNT');
const KEY_CODE = key('c', 'LEDGER_KEY_CONTRACT_CODE');
const KEY_POOL = key('p', 'LEDGER_KEY_LIQUIDITY_POOL');

describe('footprintDiff', () => {
  describe('explainInvalidFootprint (failure paths)', () => {
    it('explains missing footprints from failed simulations', () => {
      expect(explainInvalidFootprint(null)).toMatch(/missing/i);
      expect(explainInvalidFootprint(undefined)).toMatch(/missing/i);
    });

    it('explains malformed footprints', () => {
      expect(explainInvalidFootprint({ readOnly: 'nope' })).toMatch(/malformed/i);
      expect(explainInvalidFootprint({ readOnly: [], readWrite: [{ type: 't' }] })).toMatch(/malformed/i);
      expect(explainInvalidFootprint('footprint')).toMatch(/malformed/i);
    });

    it('explains entries with empty xdr or type', () => {
      const invalid = snapshot([{ type: '', xdr: 'x' }], []);
      expect(explainInvalidFootprint(invalid)).toMatch(/invalid ledger key/i);
    });

    it('accepts a well-formed footprint', () => {
      expect(explainInvalidFootprint(snapshot([KEY_A], [KEY_B]))).toBeNull();
    });
  });

  describe('diffFootprints (primary flow)', () => {
    it('detects added and removed keys per section', () => {
      const base = snapshot([KEY_A, KEY_B], [KEY_CODE]);
      const next = snapshot([KEY_A], [KEY_CODE, KEY_POOL]);

      const diff = diffFootprints(base, next);

      expect(diff.identical).toBe(false);
      expect(diff.sections).toHaveLength(2);

      const ro = diff.sections.find((s) => s.section === 'readOnly');
      expect(ro?.added).toEqual([]);
      expect(ro?.removed).toEqual([KEY_B]);
      expect(ro?.unchanged).toEqual([KEY_A]);

      const rw = diff.sections.find((s) => s.section === 'readWrite');
      expect(rw?.added).toEqual([KEY_POOL]);
      expect(rw?.removed).toEqual([]);
      expect(rw?.unchanged).toEqual([KEY_CODE]);

      expect(diff.summary.addedCount).toBe(1);
      expect(diff.summary.removedCount).toBe(1);
      expect(diff.summary.readWriteAdded).toBe(1);
      expect(diff.summary.readWriteRemoved).toBe(0);
    });

    it('computes the minimum resource fee delta', () => {
      const diff = diffFootprints(
        snapshot([KEY_A], [], '1200'),
        snapshot([KEY_A], [], '1500'),
      );
      expect(diff.summary.baseMinResourceFee).toBe('1200');
      expect(diff.summary.nextMinResourceFee).toBe('1500');
      expect(diff.summary.minResourceFeeDelta).toBe('300');
    });

    it('reports identical footprints without warnings', () => {
      const base = snapshot([KEY_A], [KEY_B], '900');
      const diff = diffFootprints(base, snapshot([KEY_A], [KEY_B], '900'));

      expect(diff.identical).toBe(true);
      expect(diff.warnings).toEqual([]);
      expect(diff.summary.addedCount).toBe(0);
      expect(diff.summary.removedCount).toBe(0);
    });

    it('deduplicates repeated keys within a single footprint', () => {
      const diff = diffFootprints(
        snapshot([KEY_A, KEY_A], [KEY_B]),
        snapshot([KEY_A], [KEY_B, KEY_B]),
      );
      expect(diff.summary.unchangedCount).toBe(2);
      expect(diff.summary.addedCount).toBe(0);
      expect(diff.summary.removedCount).toBe(0);
    });
  });

  describe('boundary cases', () => {
    it('treats two empty footprints as identical', () => {
      const diff = diffFootprints(snapshot([], [], '0'), snapshot([], [], '0'));
      expect(diff.identical).toBe(true);
      expect(diff.summary.minResourceFeeDelta).toBe('0');
      expect(diff.warnings).toEqual([]);
    });

    it('warns on large fee increases only', () => {
      const small = diffFootprints(snapshot([KEY_A], [], '1000'), snapshot([KEY_A], [], '1100'));
      expect(small.warnings.some((w) => w.code === 'fee-increased')).toBe(false);

      const large = diffFootprints(snapshot([KEY_A], [], '1000'), snapshot([KEY_A], [], '1500'));
      expect(large.warnings.some((w) => w.code === 'fee-increased')).toBe(true);
    });

    it('warns when the read-write section more than doubles', () => {
      const base = snapshot([], [KEY_A], '1000');
      const next = snapshot([], [KEY_A, KEY_B, KEY_CODE], '1000');
      const diff = diffFootprints(base, next);

      expect(diff.warnings.some((w) => w.code === 'write-grew')).toBe(true);
    });

    it('does not warn on proportional growth that stays within 2x', () => {
      const base = snapshot([], [KEY_A], '1000');
      const next = snapshot([], [KEY_A, KEY_B], '1000');
      const diff = diffFootprints(base, next);

      expect(diff.warnings.some((w) => w.code === 'write-grew')).toBe(false);
    });

    it('warns on newly written contract code, liquidity pool, and trustline keys', () => {
      const diff = diffFootprints(snapshot([], [], '100'), snapshot([], [KEY_CODE, KEY_POOL], '100'));
      const unexpected = diff.warnings.filter((w) => w.code === 'unexpected-write');
      expect(unexpected).toHaveLength(2);
      expect(unexpected.every((w) => typeof w.key === 'string')).toBe(true);
    });

    it('does not warn on new contract-data writes', () => {
      const diff = diffFootprints(snapshot([], [], '100'), snapshot([], [KEY_A], '100'));
      expect(diff.warnings.some((w) => w.code === 'unexpected-write')).toBe(false);
    });

    it('keeps section warnings scoped to readWrite', () => {
      const diff = diffFootprints(snapshot([KEY_CODE], [], '100'), snapshot([KEY_CODE, KEY_POOL], [], '100'));
      expect(diff.warnings.some((w) => w.code === 'unexpected-write')).toBe(false);
    });
  });

  describe('failure cases', () => {
    it('throws a descriptive error for a missing baseline', () => {
      expect(() => diffFootprints(null as unknown as FootprintSnapshot, snapshot([], []))).toThrow(
        /baseline footprint.*missing/i,
      );
    });

    it('throws a descriptive error for a malformed comparison footprint', () => {
      expect(() =>
        diffFootprints(snapshot([], []), { readOnly: [], readWrite: null } as unknown as FootprintSnapshot),
      ).toThrow(/comparison footprint.*malformed/i);
    });

    it('throws when an entry has empty xdr', () => {
      expect(() =>
        diffFootprints(snapshot([], []), snapshot([{ type: 't', xdr: '  ' }], [])),
      ).toThrow(/invalid ledger key/i);
    });

    it('tolerates missing minResourceFee without throwing', () => {
      const base = { readOnly: [KEY_A], readWrite: [] } as FootprintSnapshot;
      const next = { readOnly: [KEY_A], readWrite: [], minResourceFee: '500' } as FootprintSnapshot;
      const diff = diffFootprints(base, next);
      expect(diff.summary.baseMinResourceFee).toBeNull();
      expect(diff.summary.nextMinResourceFee).toBe('500');
      expect(diff.summary.minResourceFeeDelta).toBeNull();
      expect(diff.identical).toBe(false);
    });
  });

  describe('describeLedgerKey', () => {
    it('trims long XDR previews', () => {
      expect(describeLedgerKey(key('abcdefghijklmnopqrstuvwxyz'))).toBe('LEDGER_KEY_CONTRACT_DATA (abcdefghijklmno…)');
    });

    it('falls back for invalid keys', () => {
      expect(describeLedgerKey(undefined as unknown as SerializedLedgerKey)).toBe('invalid key');
    });
  });
});
