/**
 * url-context.ts — the global dashboard context (network + time range) that is
 * persisted in the URL query string (#987).
 *
 * This module is deliberately React-free (no `react` / `react-router`
 * imports) so the parsing, validation and serialisation rules can be unit
 * tested in isolation and reused by the provider in
 * `src/context/DashboardContext.tsx`.
 *
 * URL contract
 * ------------
 *   ?network=testnet
 *   ?range=24h
 *   ?range=custom&from=2026-09-01&to=2026-09-14
 *
 * Rules:
 *   - `network` must be one of `NETWORK_NAMES`; anything else falls back to
 *     `DEFAULT_NETWORK` and raises the `unknown-network` issue.
 *   - `range` must be a known preset or `custom`. A `custom` range must carry
 *     parseable `from`/`to` bounds with `from <= to`, otherwise it falls back
 *     to `DEFAULT_TIME_RANGE` and raises an issue.
 */

export const NETWORK_NAMES = ['mainnet', 'testnet', 'futurenet', 'local', 'custom'] as const;

export type NetworkName = (typeof NETWORK_NAMES)[number];

export const DEFAULT_NETWORK: NetworkName = 'testnet';

export const TIME_RANGE_PRESETS = [
  '15m',
  '1h',
  '6h',
  '24h',
  '7d',
  '30d',
  '90d',
  '1y',
  'all',
] as const;

export type TimeRangePreset = (typeof TIME_RANGE_PRESETS)[number];
export type TimeRangeValue = TimeRangePreset | 'custom';

export const DEFAULT_TIME_RANGE: TimeRangePreset = '24h';

export const NETWORK_LABELS: Record<NetworkName, string> = {
  mainnet: 'Mainnet',
  testnet: 'Testnet',
  futurenet: 'Futurenet',
  local: 'Local',
  custom: 'Custom',
};

export const TIME_RANGE_LABELS: Record<TimeRangeValue, string> = {
  '15m': 'Last 15 minutes',
  '1h': 'Last hour',
  '6h': 'Last 6 hours',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '1y': 'Last year',
  all: 'All time',
  custom: 'Custom range',
};

/** Fixed look-back window for each preset in milliseconds (`all` = unbounded). */
export const PRESET_DURATION_MS: Record<TimeRangePreset, number | null> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
  all: null,
};

export type ContextIssue =
  | 'unknown-network'
  | 'invalid-range'
  | 'incomplete-custom-range'
  | 'reversed-custom-range';

export interface TimeRange {
  value: TimeRangeValue;
  /** ISO-8601 UTC lower bound, only present when `value === 'custom'`. */
  from?: string;
  /** ISO-8601 UTC upper bound, only present when `value === 'custom'`. */
  to?: string;
}

export interface DashboardUrlContext {
  /** Validated network after applying fallbacks. */
  network: NetworkName;
  /** Raw `network` param exactly as supplied in the URL, or `null` when absent. */
  requestedNetwork: string | null;
  /** `true` when `requestedNetwork` was invalid and `DEFAULT_NETWORK` was used. */
  networkFallback: boolean;
  /** Validated time range after applying fallbacks. */
  range: TimeRange;
  /** `true` when the requested range was invalid and `DEFAULT_TIME_RANGE` was used. */
  rangeFallback: boolean;
  /** Every validation problem discovered while parsing, in discovery order. */
  issues: ContextIssue[];
}

export interface ResolvedTimeRange {
  start: Date | null;
  end: Date | null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z?$/;
const EPOCH_MS = /^\d{10,}$/;

export function isNetworkName(value: unknown): value is NetworkName {
  return (
    typeof value === 'string' &&
    (NETWORK_NAMES as readonly string[]).includes(value)
  );
}

export function isTimeRangePreset(value: unknown): value is TimeRangePreset {
  return (
    typeof value === 'string' &&
    (TIME_RANGE_PRESETS as readonly string[]).includes(value)
  );
}

/**
 * Parse a user-supplied date bound into a canonical ISO-8601 UTC string.
 * Accepts `YYYY-MM-DD`, ISO timestamps and epoch milliseconds; returns `null`
 * for anything that cannot be resolved to a valid date.
 */
export function parseDateBoundary(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (EPOCH_MS.test(trimmed)) {
    const date = new Date(Number(trimmed));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (!DATE_ONLY.test(trimmed) && !ISO_UTC.test(trimmed)) return null;

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toSearchParams(search: string | URLSearchParams): URLSearchParams {
  if (typeof search !== 'string') return search;
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

/**
 * Parse and validate the dashboard context from a search string or
 * `URLSearchParams`. Never throws: invalid input is replaced by the documented
 * default and recorded in `issues`.
 */
export function parseDashboardContext(
  search: string | URLSearchParams = '',
): DashboardUrlContext {
  const params = toSearchParams(search);
  const issues: ContextIssue[] = [];

  // ── Network ───────────────────────────────────────────────────────────────
  const rawNetwork = params.get('network');
  let network: NetworkName = DEFAULT_NETWORK;
  let networkFallback = false;
  let requestedNetwork: string | null = null;

  if (rawNetwork !== null && rawNetwork.trim() !== '') {
    requestedNetwork = rawNetwork.trim();
    const normalized = requestedNetwork.toLowerCase();
    if (isNetworkName(normalized)) {
      network = normalized;
    } else {
      networkFallback = true;
      issues.push('unknown-network');
    }
  }

  // ── Time range ────────────────────────────────────────────────────────────
  const rawRange = params.get('range');
  const requestedRange = rawRange === null ? null : rawRange.trim().toLowerCase();
  let range: TimeRange = { value: DEFAULT_TIME_RANGE };
  let rangeFallback = false;

  if (requestedRange) {
    if (isTimeRangePreset(requestedRange)) {
      range = { value: requestedRange };
    } else if (requestedRange === 'custom') {
      const rawFrom = params.get('from');
      const rawTo = params.get('to');
      const from = parseDateBoundary(rawFrom);
      const to = parseDateBoundary(rawTo);

      if (!rawFrom || !rawTo) {
        rangeFallback = true;
        issues.push('incomplete-custom-range');
      } else if (!from || !to) {
        rangeFallback = true;
        issues.push('invalid-range');
      } else if (from > to) {
        // Both bounds are canonical ISO UTC strings, so lexicographic order
        // matches chronological order.
        rangeFallback = true;
        issues.push('reversed-custom-range');
      } else {
        range = { value: 'custom', from, to };
      }
    } else {
      rangeFallback = true;
      issues.push('invalid-range');
    }
  }

  return {
    network,
    requestedNetwork,
    networkFallback,
    range,
    rangeFallback,
    issues,
  };
}

/**
 * Merge the validated context into a query string, preserving any unrelated
 * parameters already present (deep-link params, feature flags, …).
 *
 * `network` and `range` are always written explicitly so a copied link is
 * self-describing. `from`/`to` are only written for `custom` ranges and are
 * removed otherwise (including when switching back to a preset).
 */
export function buildContextParams(
  context: Pick<DashboardUrlContext, 'network' | 'range'>,
  base: string | URLSearchParams = '',
): URLSearchParams {
  const params = new URLSearchParams(toSearchParams(base));

  if (isNetworkName(context.network)) {
    params.set('network', context.network);
  }

  params.set('range', context.range.value);

  if (context.range.value === 'custom') {
    if (context.range.from) params.set('from', context.range.from);
    if (context.range.to) params.set('to', context.range.to);
  } else {
    params.delete('from');
    params.delete('to');
  }

  return params;
}

/**
 * Turn a validated `TimeRange` into concrete `[start, end]` dates.
 *
 * `all` returns an unbounded start; a malformed `custom` range (defensive —
 * parsing already rejects these) degrades to `DEFAULT_TIME_RANGE`.
 */
export function resolveTimeRange(
  range: TimeRange,
  now: Date = new Date(),
): ResolvedTimeRange {
  if (range.value === 'custom') {
    const start = range.from ? new Date(range.from) : null;
    const end = range.to ? new Date(range.to) : null;
    if (
      start &&
      end &&
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime())
    ) {
      return { start, end };
    }
    return resolveTimeRange({ value: DEFAULT_TIME_RANGE }, now);
  }

  const duration = PRESET_DURATION_MS[range.value] ?? null;
  if (duration === null) {
    return { start: null, end: now };
  }
  return { start: new Date(now.getTime() - duration), end: now };
}

/** Human-readable label for the active range (used by the header bar). */
export function describeTimeRange(range: TimeRange): string {
  if (range.value === 'custom' && range.from && range.to) {
    return `${range.from.slice(0, 10)} → ${range.to.slice(0, 10)}`;
  }
  return TIME_RANGE_LABELS[range.value] ?? 'Custom range';
}

/** Map a parse issue to a short, user-facing explanation. */
export function issueMessage(
  issue: ContextIssue,
  detail: { requestedNetwork?: string | null } = {},
): string {
  switch (issue) {
    case 'unknown-network':
      return `Unknown network "${detail.requestedNetwork ?? ''}" — using ${NETWORK_LABELS[DEFAULT_NETWORK]}.`;
    case 'invalid-range':
      return `Unrecognised time range — using ${TIME_RANGE_LABELS[DEFAULT_TIME_RANGE]}.`;
    case 'incomplete-custom-range':
      return `Custom range needs both a start and end date — using ${TIME_RANGE_LABELS[DEFAULT_TIME_RANGE]}.`;
    case 'reversed-custom-range':
      return `Custom range starts after it ends — using ${TIME_RANGE_LABELS[DEFAULT_TIME_RANGE]}.`;
    default:
      return '';
  }
}
