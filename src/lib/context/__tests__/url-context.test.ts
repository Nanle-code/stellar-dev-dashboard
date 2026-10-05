import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NETWORK,
  DEFAULT_TIME_RANGE,
  buildContextParams,
  describeTimeRange,
  issueMessage,
  parseDashboardContext,
  parseDateBoundary,
  resolveTimeRange,
} from '../url-context';

const FIXED_NOW = new Date('2026-09-20T12:00:00.000Z');

describe('parseDashboardContext', () => {
  describe('primary flow', () => {
    it('parses a valid network and preset range', () => {
      const context = parseDashboardContext('?network=mainnet&range=30d');

      expect(context.network).toBe('mainnet');
      expect(context.requestedNetwork).toBe('mainnet');
      expect(context.networkFallback).toBe(false);
      expect(context.range).toEqual({ value: '30d' });
      expect(context.rangeFallback).toBe(false);
      expect(context.issues).toEqual([]);
    });

    it('accepts a URLSearchParams instance and is case-insensitive', () => {
      const params = new URLSearchParams({ network: 'FUTURENET', range: '7D' });
      const context = parseDashboardContext(params);

      expect(context.network).toBe('futurenet');
      expect(context.range).toEqual({ value: '7d' });
    });

    it('round-trips through buildContextParams while preserving unrelated params', () => {
      const original = parseDashboardContext('?network=testnet&range=custom&from=2026-09-01&to=2026-09-14');
      const params = buildContextParams(original, '?tab=charts&address=GABC');

      expect(params.get('network')).toBe('testnet');
      expect(params.get('range')).toBe('custom');
      expect(params.get('from')).toBe('2026-09-01T00:00:00.000Z');
      expect(params.get('to')).toBe('2026-09-14T00:00:00.000Z');
      // Unrelated params survive so deep links keep working.
      expect(params.get('tab')).toBe('charts');
      expect(params.get('address')).toBe('GABC');
    });
  });

  describe('defaults', () => {
    it('uses the documented defaults when no context params are present', () => {
      const context = parseDashboardContext('');

      expect(context.network).toBe(DEFAULT_NETWORK);
      expect(context.requestedNetwork).toBeNull();
      expect(context.range).toEqual({ value: DEFAULT_TIME_RANGE });
      expect(context.issues).toEqual([]);
    });

    it('drops stale from/to params when the range is not custom', () => {
      const context = parseDashboardContext('?range=24h&from=2026-01-01&to=2026-02-01');
      const params = buildContextParams(context, '?range=24h&from=2026-01-01&to=2026-02-01');

      expect(context.range).toEqual({ value: '24h' });
      expect(params.has('from')).toBe(false);
      expect(params.has('to')).toBe(false);
    });
  });

  describe('boundary cases', () => {
    it('treats the "all" preset as an unbounded start', () => {
      const context = parseDashboardContext('?range=all');
      const resolved = resolveTimeRange(context.range, FIXED_NOW);

      expect(context.range.value).toBe('all');
      expect(resolved.start).toBeNull();
      expect(resolved.end).toEqual(FIXED_NOW);
    });

    it('allows a custom range whose bounds are equal', () => {
      const context = parseDashboardContext('?range=custom&from=2026-09-01&to=2026-09-01');

      expect(context.range.value).toBe('custom');
      expect(context.range.from).toBe('2026-09-01T00:00:00.000Z');
      expect(context.range.to).toBe('2026-09-01T00:00:00.000Z');
      expect(context.rangeFallback).toBe(false);
    });

    it('parses epoch-millisecond bounds', () => {
      const epoch = Date.UTC(2026, 8, 1); // 2026-09-01T00:00:00Z
      const context = parseDashboardContext(`?range=custom&from=${epoch}&to=${epoch + 86_400_000}`);

      expect(context.range.value).toBe('custom');
      expect(context.range.from).toBe('2026-09-01T00:00:00.000Z');
      expect(context.range.to).toBe('2026-09-02T00:00:00.000Z');
    });

    it('computes preset windows relative to now', () => {
      const resolved = resolveTimeRange({ value: '7d' }, FIXED_NOW);

      expect(resolved.end).toEqual(FIXED_NOW);
      expect(resolved.start?.toISOString()).toBe('2026-09-13T12:00:00.000Z');
    });
  });

  describe('failure cases', () => {
    it('falls back to the default network for an unknown value and flags it', () => {
      const context = parseDashboardContext('?network=not-a-network&range=7d');

      expect(context.network).toBe(DEFAULT_NETWORK);
      expect(context.requestedNetwork).toBe('not-a-network');
      expect(context.networkFallback).toBe(true);
      expect(context.issues).toContain('unknown-network');
      // The valid range is still honoured.
      expect(context.range).toEqual({ value: '7d' });
      expect(context.rangeFallback).toBe(false);
    });

    it('falls back to the default range for an unrecognised value', () => {
      const context = parseDashboardContext('?network=testnet&range=banana');

      expect(context.range).toEqual({ value: DEFAULT_TIME_RANGE });
      expect(context.rangeFallback).toBe(true);
      expect(context.issues).toContain('invalid-range');
    });

    it('rejects a custom range missing one bound', () => {
      const context = parseDashboardContext('?range=custom&from=2026-09-01');

      expect(context.range).toEqual({ value: DEFAULT_TIME_RANGE });
      expect(context.issues).toContain('incomplete-custom-range');
    });

    it('rejects a custom range with an unparseable bound', () => {
      const context = parseDashboardContext('?range=custom&from=yesterday&to=2026-09-14');

      expect(context.range).toEqual({ value: DEFAULT_TIME_RANGE });
      expect(context.issues).toContain('invalid-range');
    });

    it('rejects a reversed custom range', () => {
      const context = parseDashboardContext('?range=custom&from=2026-09-20&to=2026-09-01');

      expect(context.range).toEqual({ value: DEFAULT_TIME_RANGE });
      expect(context.issues).toContain('reversed-custom-range');
    });

    it('never throws for malformed input and reports both issues at once', () => {
      const context = parseDashboardContext('?network=%E0%A4%A&range=custom&from=&to=');

      expect(context.networkFallback).toBe(true);
      expect(context.rangeFallback).toBe(true);
      expect(context.issues).toEqual(['unknown-network', 'incomplete-custom-range']);
    });
  });
});

describe('parseDateBoundary', () => {
  it('returns null for absent or invalid values', () => {
    expect(parseDateBoundary(null)).toBeNull();
    expect(parseDateBoundary('')).toBeNull();
    expect(parseDateBoundary('2026-13-45')).toBeNull();
    expect(parseDateBoundary('not a date')).toBeNull();
  });
});

describe('describeTimeRange & issueMessage', () => {
  it('labels presets and custom windows', () => {
    expect(describeTimeRange({ value: '7d' })).toBe('Last 7 days');
    expect(describeTimeRange({ value: 'custom', from: '2026-09-01T00:00:00.000Z', to: '2026-09-14T00:00:00.000Z' })).toBe(
      '2026-09-01 → 2026-09-14',
    );
  });

  it('explains fallbacks in user-facing language', () => {
    expect(issueMessage('unknown-network', { requestedNetwork: 'foo' })).toContain('foo');
    expect(issueMessage('invalid-range')).toContain('24 hours');
    expect(issueMessage('reversed-custom-range')).toContain('after it ends');
  });
});
