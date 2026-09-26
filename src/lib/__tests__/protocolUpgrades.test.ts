/**
 * Unit tests for the protocol upgrade tracker data layer (#985).
 *
 * Covers the primary flow (bundled file parses, live ledger header wins),
 * boundary cases (warning window edges, empty CAP lists, date windows), and
 * failure cases (malformed curated data fails closed with every issue listed).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProtocolUpgradesError,
  daysUntilIsoDay,
  extractProtocolVersion,
  getActiveResetNotices,
  getProtocolUpgrades,
  getUpcomingUpgrades,
  getUpgradesByVersion,
  parseProtocolUpgrades,
  resetProtocolUpgradesCacheForTests,
  resolveProtocolVersionRows,
  toProtocolUpgradesErrorReport,
} from '../protocolUpgrades';

function capUrl(cap: string): string {
  return `https://github.com/stellar/stellar-protocol/blob/master/core/${cap.toLowerCase()}.md`;
}

function validRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    dataVersion: 1,
    lastUpdated: '2026-09-26',
    updateGuide: 'docs/features/protocol-upgrade-tracker.md',
    capIndexUrl: 'https://github.com/stellar/stellar-protocol/blob/master/core/README.md',
    referenceProtocolVersions: {
      mainnet: { version: 28, lastVerified: '2026-09-26', source: 'ledger header' },
      testnet: { version: 28, lastVerified: '2026-09-26', source: 'ledger header' },
      futurenet: { version: 29, lastVerified: '2026-09-26', source: 'ledger header' },
    },
    upgrades: [
      {
        protocolVersion: 29,
        status: 'in-development',
        networks: ['futurenet'],
        targetNetworks: ['testnet', 'mainnet'],
        activationDate: null,
        activationWindow: { start: '2026-11-01', end: '2026-12-31' },
        dateConfidence: 'estimated',
        title: 'Protocol 29',
        summary: 'Next protocol',
        impacts: ['Re-run contract tests'],
        capsNote: 'Candidates only until the CAP index assigns them.',
        caps: [
          {
            number: 'CAP-0088',
            title: 'Millisecond-Resolution Close Times',
            url: capUrl('CAP-0088'),
            assignment: 'tbd',
          },
        ],
      },
      {
        protocolVersion: 28,
        status: 'activated',
        networks: ['mainnet', 'testnet'],
        activationDate: '2026-06-01',
        activationWindow: null,
        dateConfidence: 'confirmed',
        title: 'Protocol 28',
        summary: 'Current protocol',
        impacts: [],
        caps: [
          {
            number: 'CAP-0083',
            title: 'Drop transaction set',
            url: capUrl('CAP-0083'),
            assignment: 'confirmed',
          },
        ],
      },
    ],
    testnetResets: [
      {
        network: 'testnet',
        scheduledFor: '2026-11-05',
        dateConfidence: 'estimated',
        summary: 'Testnet will be wiped',
        impacts: ['Re-seed fixtures'],
        reSeedGuideUrl:
          'https://github.com/Nanle-code/stellar-dev-dashboard/blob/master/docs/features/protocol-upgrade-tracker.md#re-seeding-testnet-fixtures',
        reSeedCommand: 'pnpm demo:seed',
      },
    ],
    ...overrides,
  };
}

function rawWithResetDates(dates: Array<string | null>): Record<string, unknown> {
  return validRaw({
    testnetResets: dates.map((scheduledFor) => ({
      network: 'testnet',
      scheduledFor,
      dateConfidence: 'estimated',
      summary: 'Testnet will be wiped',
      impacts: ['Re-seed fixtures'],
      reSeedGuideUrl: 'https://example.com/reseed',
    })),
  });
}

const NOW = new Date('2026-09-26T12:00:00.000Z');

describe('protocol upgrade data', () => {
  beforeEach(() => {
    resetProtocolUpgradesCacheForTests();
  });

  it('parses the bundled curated file (primary flow)', () => {
    const data = getProtocolUpgrades();

    expect(data.schemaVersion).toBe(1);
    expect(data.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.referenceProtocolVersions.futurenet.version).toBe(29);
    expect(data.upgrades.length).toBeGreaterThanOrEqual(2);

    const versions = data.upgrades.map((upgrade) => upgrade.protocolVersion);
    expect(versions).toContain(28);
    expect(versions).toContain(29);

    for (const upgrade of data.upgrades) {
      for (const cap of upgrade.caps) {
        expect(cap.url.startsWith('https://github.com/stellar/stellar-protocol/')).toBe(true);
      }
    }
  });

  it('memoizes the bundled data and can be reset for tests', () => {
    const first = getProtocolUpgrades();
    const second = getProtocolUpgrades();
    expect(second).toBe(first);

    resetProtocolUpgradesCacheForTests();
    expect(getProtocolUpgrades()).not.toBe(first);
  });

  it('prefers the live ledger header for the active network (primary flow)', () => {
    const data = parseProtocolUpgrades(validRaw());
    const rows = resolveProtocolVersionRows(data, {
      network: 'testnet',
      ledger: { protocol_version: 30 },
    });

    const testnet = rows.find((row) => row.network === 'testnet');
    expect(testnet).toMatchObject({ version: 30, source: 'ledger-header', live: true });

    const mainnet = rows.find((row) => row.network === 'mainnet');
    expect(mainnet).toMatchObject({ version: 28, source: 'last-verified', live: false });

    expect(rows.map((row) => row.network)).toEqual(['mainnet', 'testnet', 'futurenet']);
  });

  it('falls back to the last-verified version without a live ledger', () => {
    const data = parseProtocolUpgrades(validRaw());
    const rows = resolveProtocolVersionRows(data, { network: 'testnet' });
    const testnet = rows.find((row) => row.network === 'testnet');
    expect(testnet).toMatchObject({ version: 28, source: 'last-verified', live: false });
    expect(testnet?.lastVerified).toBe('2026-09-26');
  });

  it('reads protocol versions from snake/camel case ledger headers only', () => {
    expect(extractProtocolVersion({ protocol_version: 28 })).toBe(28);
    expect(extractProtocolVersion({ protocolVersion: '29' })).toBe(29);
    expect(extractProtocolVersion({ protocol_version: 0 })).toBeNull();
    expect(extractProtocolVersion({ protocol_version: 'nope' })).toBeNull();
    expect(extractProtocolVersion({})).toBeNull();
    expect(extractProtocolVersion(null)).toBeNull();
  });

  it('lists only non-activated upgrades, newest first', () => {
    const data = parseProtocolUpgrades(validRaw());
    expect(getUpcomingUpgrades(data).map((upgrade) => upgrade.protocolVersion)).toEqual([29]);
    expect(getUpgradesByVersion(data).map((upgrade) => upgrade.protocolVersion)).toEqual([29, 28]);
  });

  it('includes resets inside the warning window and excludes the day after (boundary)', () => {
    const data = parseProtocolUpgrades(
      rawWithResetDates([
        '2026-10-11', // 15 days: outside a 14-day window
        '2026-10-10', // exactly 14 days: included
        '2026-09-26', // today: included
        '2026-09-25', // yesterday: excluded
        null, // unscheduled: excluded
      ]),
    );

    const active = getActiveResetNotices(data, { now: NOW, warningWindowDays: 14 });
    expect(active.map((notice) => notice.scheduledFor)).toEqual(['2026-09-26', '2026-10-10']);
    expect(active.map((notice) => notice.daysUntil)).toEqual([0, 14]);
  });

  it('respects a custom warning window at its edge (boundary)', () => {
    const data = parseProtocolUpgrades(
      rawWithResetDates(['2026-09-27', '2026-09-28', '2026-09-29']),
    );
    const active = getActiveResetNotices(data, { now: NOW, warningWindowDays: 2 });
    expect(active.map((notice) => notice.daysUntil)).toEqual([1, 2]);
  });

  it('computes UTC day deltas across date boundaries (boundary)', () => {
    expect(daysUntilIsoDay('2026-09-26', NOW)).toBe(0);
    expect(daysUntilIsoDay('2026-09-27', NOW)).toBe(1);
    expect(daysUntilIsoDay('2026-09-25', NOW)).toBe(-1);
    expect(daysUntilIsoDay('2026-10-10', NOW)).toBe(14);
    expect(daysUntilIsoDay(null, NOW)).toBeNull();
    expect(daysUntilIsoDay('not-a-date', NOW)).toBeNull();
  });

  it('accepts an empty CAP list when capsNote explains why (boundary)', () => {
    const raw = validRaw();
    const upgrades = raw.upgrades as Array<Record<string, unknown>>;
    upgrades[0].caps = [];
    expect(() => parseProtocolUpgrades(raw)).not.toThrow();
  });

  it('accepts an activation window whose start equals its end (boundary)', () => {
    const raw = validRaw();
    const upgrades = raw.upgrades as Array<Record<string, unknown>>;
    upgrades[0].activationWindow = { start: '2026-11-01', end: '2026-11-01' };
    const data = parseProtocolUpgrades(raw);
    expect(data.upgrades[0].activationWindow).toEqual({ start: '2026-11-01', end: '2026-11-01' });
  });

  it('rejects a non-object root (failure case)', () => {
    expect(() => parseProtocolUpgrades('not json')).toThrow(ProtocolUpgradesError);
    expect(() => parseProtocolUpgrades(null)).toThrow(/root must be an object/);
  });

  it('reports every malformed field at once instead of failing piecemeal (failure case)', () => {
    const raw = validRaw();
    const upgrades = raw.upgrades as Array<Record<string, unknown>>;
    upgrades[0].protocolVersion = 0;
    upgrades[0].title = '';
    upgrades[0].dateConfidence = 'probably';
    upgrades[0].activationDate = '01/11/2026';
    upgrades[0].caps = [
      {
        number: 'CAP-0088',
        title: 'Mismatched link',
        url: capUrl('CAP-0099'),
      },
    ];

    try {
      parseProtocolUpgrades(raw);
      throw new Error('expected parseProtocolUpgrades to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ProtocolUpgradesError);
      const issues = (error as ProtocolUpgradesError).issues;
      expect(issues.length).toBeGreaterThanOrEqual(4);
      expect(issues.join('\n')).toMatch(/protocolVersion/);
      expect(issues.join('\n')).toMatch(/title/);
      expect(issues.join('\n')).toMatch(/dateConfidence/);
      expect(issues.join('\n')).toMatch(/activationDate/);
      expect(issues.join('\n')).toMatch(/does not point at cap-0088\.md/);
    }
  });

  it('requires capsNote when an upgrade lists no CAPs (failure case)', () => {
    const raw = validRaw();
    const upgrades = raw.upgrades as Array<Record<string, unknown>>;
    upgrades[0].caps = [];
    delete upgrades[0].capsNote;
    expect(() => parseProtocolUpgrades(raw)).toThrow(/capsNote is required/);
  });

  it('rejects a reversed activation window and a non-array resets list (failure case)', () => {
    const reversed = validRaw();
    (reversed.upgrades as Array<Record<string, unknown>>)[0].activationWindow = {
      start: '2026-12-31',
      end: '2026-11-01',
    };
    expect(() => parseProtocolUpgrades(reversed)).toThrow(/start must not be after/);

    const badResets = validRaw({ testnetResets: 'nope' });
    expect(() => parseProtocolUpgrades(badResets)).toThrow(/testnetResets must be an array/);
  });

  it('rejects a CAP url that is not on the stellar-protocol repo (failure case)', () => {
    const raw = validRaw();
    const upgrades = raw.upgrades as Array<Record<string, unknown>>;
    (upgrades[0].caps as Array<Record<string, unknown>>)[0].url = 'https://example.com/cap-0088.md';
    expect(() => parseProtocolUpgrades(raw)).toThrow(/stellar-protocol/);
  });

  it('flattens unknown thrown values for the UI error path (failure case)', () => {
    expect(toProtocolUpgradesErrorReport(new ProtocolUpgradesError(['a', 'b']))).toEqual({
      name: 'ProtocolUpgradesError',
      issues: ['a', 'b'],
    });
    expect(toProtocolUpgradesErrorReport(new Error('boom'))).toEqual({
      name: 'ProtocolUpgradesError',
      issues: ['boom'],
    });
  });
});
