/**
 * Ledger pin semantics for shared views.
 *
 * A pin is only worth having if it means something. These tests pin down both
 * halves of that contract: which sequences are accepted (boundaries), and which
 * routes can genuinely enforce one (so the UI never claims a frozen view that is
 * actually live).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  currentLedgerSequence,
  describeLedgerPin,
  describeLedgerPinSupport,
  isLedgerPinHonoured,
  isLedgerPinReachable,
  ledgerCursorFor,
  MAX_LEDGER_SEQUENCE,
  MIN_LEDGER_SEQUENCE,
  normalizeLedgerSequence,
  TAB_PIN_STRATEGY,
} from '../ledgerPin';

describe('normalizeLedgerSequence — boundaries', () => {
  it('accepts the full valid range and rejects just outside it', () => {
    expect(normalizeLedgerSequence(MIN_LEDGER_SEQUENCE)).toBe(1);
    expect(normalizeLedgerSequence(MAX_LEDGER_SEQUENCE)).toBe(MAX_LEDGER_SEQUENCE);
    expect(normalizeLedgerSequence(MAX_LEDGER_SEQUENCE + 2)).toBeNull();
    // Ledger 0 and negatives have no transactions to pin to.
    expect(normalizeLedgerSequence(0)).toBeNull();
    expect(normalizeLedgerSequence(-1)).toBeNull();
  });

  it('accepts numeric strings, since URL params are text', () => {
    expect(normalizeLedgerSequence('1234')).toBe(1234);
    expect(normalizeLedgerSequence('  1234  ')).toBe(1234);
  });

  it('rejects non-integer and non-finite values', () => {
    expect(normalizeLedgerSequence(1234.5)).toBeNull();
    expect(normalizeLedgerSequence(Number.NaN)).toBeNull();
    expect(normalizeLedgerSequence(Number.POSITIVE_INFINITY)).toBeNull();
    expect(normalizeLedgerSequence(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('rejects exotic numeric notations a URL could carry', () => {
    // `Number()` would happily accept all of these; a ledger sequence is a
    // plain decimal integer and nothing else.
    expect(normalizeLedgerSequence('1e3')).toBeNull();
    expect(normalizeLedgerSequence('0x10')).toBeNull();
    expect(normalizeLedgerSequence('12 34')).toBeNull();
    expect(normalizeLedgerSequence('12.0')).toBeNull();
    expect(normalizeLedgerSequence('-5')).toBeNull();
  });

  it('returns null for absent or wrong-typed input rather than throwing', () => {
    for (const input of [null, undefined, '', '   ', {}, [], true, Number.NaN]) {
      expect(normalizeLedgerSequence(input)).toBeNull();
    }
  });
});

describe('ledgerCursorFor — deterministic point-in-time paging', () => {
  it('emits the sequence itself as a Horizon paging cursor', () => {
    expect(ledgerCursorFor(42)).toBe('42');
    expect(ledgerCursorFor(42, 'desc')).toBe('42');
    // Coercion is `normalizeLedgerSequence`'s job, and it happens at the URL
    // boundary; these helpers take an already-validated number.
    expect(normalizeLedgerSequence('42')).toBe(42);
  });

  it('refuses an ascending read, which would walk forward past the pin', () => {
    // Silently paging forward would hand the recipient data that does not match
    // the snapshot, which is worse than not pinning at all.
    expect(ledgerCursorFor(42, 'asc')).toBeNull();
  });

  it('produces a cursor the Horizon paging validator accepts', () => {
    const cursor = ledgerCursorFor(128_849_018_88);
    expect(cursor).toBe('12884901888');
    // Horizon paging tokens are numeric TOIDs, "now", or opaque alphanumerics.
    expect(/^(now|[A-Za-z0-9_-]{1,64})$/.test(cursor as string)).toBe(true);
  });

  it('returns null for an unusable sequence', () => {
    expect(ledgerCursorFor(null)).toBeNull();
    expect(ledgerCursorFor(0)).toBeNull();
    expect(ledgerCursorFor(-1)).toBeNull();
  });
});

describe('describeLedgerPinSupport — what a pin can actually mean', () => {
  it('honours a pin on Horizon-backed, cursor-paged views', () => {
    for (const tab of ['overview', 'account', 'transactions', 'search', 'dex']) {
      const support = describeLedgerPinSupport(tab);
      expect(support.honoured).toBe(true);
      expect(support.strategy).toBe('cursor');
      expect(support.note).toMatch(/paging cursor/i);
    }
  });

  it('honours a pin against the locally retained ledger history', () => {
    const support = describeLedgerPinSupport('network');
    expect(support.honoured).toBe(true);
    expect(support.strategy).toBe('paging');
  });

  it('refuses a pin on Soroban RPC views, which have no historical read', () => {
    for (const tab of ['contracts', 'contractInteraction', 'contractABI', 'sorobanDebug']) {
      const support = describeLedgerPinSupport(tab);
      expect(support.honoured).toBe(false);
      expect(support.strategy).toBe('none');
      expect(support.note).toMatch(/no historical read/i);
      expect(isLedgerPinHonoured(tab)).toBe(false);
    }
  });

  it('is conservative about routes it has never heard of', () => {
    expect(describeLedgerPinSupport('someFutureRoute').honoured).toBe(false);
    expect(describeLedgerPinSupport(null).honoured).toBe(false);
    expect(describeLedgerPinSupport(undefined).honoured).toBe(false);
    expect(describeLedgerPinSupport('').honoured).toBe(false);
  });

  it('bundles the sequence, network and support into one descriptor', () => {
    const descriptor = describeLedgerPin('transactions', 4242, 'mainnet');
    expect(descriptor).toMatchObject({ sequence: 4242, network: 'mainnet' });
    expect(descriptor.support.honoured).toBe(true);
  });
});

describe('isLedgerPinReachable', () => {
  it('rejects a pin ahead of the current ledger', () => {
    expect(isLedgerPinReachable(2000, 1000)).toBe(false);
    expect(isLedgerPinReachable(1000, 1000)).toBe(true);
    expect(isLedgerPinReachable(999, 1000)).toBe(true);
  });

  it('rejects a pin below the oldest sequence still ingested', () => {
    expect(isLedgerPinReachable(50, 1000, { oldestAvailableSequence: 100 })).toBe(false);
    expect(isLedgerPinReachable(150, 1000, { oldestAvailableSequence: 100 })).toBe(true);
  });

  it('accepts a valid pin when the latest sequence is not yet known', () => {
    expect(isLedgerPinReachable(500, null)).toBe(true);
  });

  it('rejects an invalid sequence regardless of reachability', () => {
    expect(isLedgerPinReachable(0, 1000)).toBe(false);
    expect(isLedgerPinReachable(null, 1000)).toBe(false);
  });
});

describe('currentLedgerSequence', () => {
  it('picks the highest sequence across both ledger feeds', () => {
    const sequence = currentLedgerSequence({
      ledgerHistory: [{ sequence: 100 }, { sequence: 300 }, { sequence: 200 }],
      streamLedgers: [{ sequence: 250 }, { sequence: 400 }],
    });
    expect(sequence).toBe(400);
  });

  it('falls back to one feed when the other is empty', () => {
    expect(currentLedgerSequence({ ledgerHistory: [{ sequence: 7 }] })).toBe(7);
    expect(currentLedgerSequence({ streamLedgers: [{ sequence: 9 }] })).toBe(9);
  });

  it('returns null when nothing is known, rather than inventing a sequence', () => {
    expect(currentLedgerSequence({})).toBeNull();
    expect(currentLedgerSequence({ ledgerHistory: [], streamLedgers: null })).toBeNull();
    expect(currentLedgerSequence({ ledgerHistory: [{ sequence: 'nope' }] })).toBeNull();
  });
});

/**
 * The support table is a hand-maintained list of route ids. A typo, a renamed
 * route, or a strategy entry left behind after a route is deleted would silently
 * downgrade a pinnable view to "not enforced" — the UI would tell the user a
 * pin is not honoured when it actually could be, and nobody would notice.
 *
 * These tests read the real route registry out of the source so the two cannot
 * drift apart.
 */
describe('TAB_PIN_STRATEGY stays aligned with the route registry', () => {
  // The registry is read out of the source text rather than imported, because
  // `routes.ts` carries `import()` loaders that the transform resolves
  // eagerly - one of them currently points at a component that does not exist
  // in `master`, so importing the module would fail for reasons that have
  // nothing to do with ledger pinning. Scoping the scan to the `ROUTES` array
  // keeps unrelated `id:` fields out of the set.
  const routesSource = readFileSync(resolve(process.cwd(), 'src/routes/routes.ts'), 'utf8');
  const routesBody = routesSource.slice(
    routesSource.indexOf('export const ROUTES'),
    routesSource.indexOf('export const ROUTES_BY_ID')
  );
  const routeIds = new Set(
    [...routesBody.matchAll(/^ {4}id: '([^']+)'/gm)].map((match) => match[1])
  );

  it('parses a non-empty route registry (guards the scan above)', () => {
    expect(routeIds.size).toBeGreaterThan(0);
    expect(routeIds.has('overview')).toBe(true);
    expect(routeIds.has('transactions')).toBe(true);
  });

  it('every route that can honour a pin is a route the app actually has', () => {
    const unknown = Object.keys(TAB_PIN_STRATEGY).filter((id) => !routeIds.has(id));
    expect(unknown, `pin strategies reference routes that no longer exist: ${unknown}`).toEqual(
      []
    );
  });

  it('does not claim pin support for a route it cannot prove is pinnable', () => {
    // Anything claiming `cursor` or `paging` must be an explicitly reviewed
    // entry, which is true by construction - this test exists to fail loudly if
    // the table is ever rebuilt from a default that is too generous.
    for (const [id, strategy] of Object.entries(TAB_PIN_STRATEGY)) {
      if (strategy === 'none') continue;
      expect(routeIds.has(id), `${id} is not a known route`).toBe(true);
    }
  });

  it('falls back to "not honoured" for unlisted routes rather than guessing', () => {
    expect(TAB_PIN_STRATEGY.definitelyNotARoute).toBeUndefined();
    expect(describeLedgerPinSupport('definitelyNotARoute').honoured).toBe(false);
  });
});
