import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import {
  describeTimeRange,
  parseDashboardContext,
  parseDateBoundary,
  resolveTimeRange,
  type DashboardUrlContext,
  type NetworkName,
  type ResolvedTimeRange,
  type TimeRange,
  type TimeRangePreset,
} from '../lib/context/url-context';

export type NetworkSource = 'url' | 'url-fallback' | 'store';

export interface DashboardContextValue {
  /** Raw, validated URL context (including any fallback/issue flags). */
  context: DashboardUrlContext;
  /** Effective network — the URL value when present, else the stored preference. */
  network: NetworkName;
  /** Where the effective network came from. */
  networkSource: NetworkSource;
  range: TimeRange;
  /** Concrete `[start, end]` dates for the active range. */
  resolvedRange: ResolvedTimeRange;
  /** Short label such as `Last 7 days` for the header bar. */
  timeRangeLabel: string;
  setNetwork: (network: NetworkName) => void;
  setRange: (preset: TimeRangePreset) => void;
  /** Returns `false` (and writes nothing) when the bounds are invalid. */
  setCustomRange: (from: string, to: string) => boolean;
  /** Remove `range`/`from`/`to` from the URL, reverting to the default. */
  resetRange: () => void;
  /** Remove the `network` override so the stored preference wins again. */
  clearNetworkOverride: () => void;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

/**
 * DashboardProvider — the single source of truth for the network + time-range
 * context (#987).
 *
 * The URL query string is canonical: parsing lives in
 * `src/lib/context/url-context.ts`, and every mutation is written back with
 * `setSearchParams` (push, not replace) so browser back/forward restores the
 * previous context. Network changes are also mirrored into the Zustand store
 * because every analytics/chart view already reads `store.network`.
 */
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const storeNetwork = useStore((s) => s.network);
  const setStoreNetwork = useStore((s) => s.setNetwork);

  const parsed = useMemo(() => parseDashboardContext(searchParams), [searchParams]);

  const networkSource: NetworkSource =
    parsed.requestedNetwork === null
      ? 'store'
      : parsed.networkFallback
        ? 'url-fallback'
        : 'url';

  const network: NetworkName = networkSource === 'store' ? storeNetwork : parsed.network;
  const range = parsed.range;

  // URL → store: fresh/shared links must drive the global network before the
  // user interacts with the header bar.
  useEffect(() => {
    if (parsed.requestedNetwork === null) return;
    if (parsed.network !== storeNetwork) {
      setStoreNetwork(parsed.network);
    }
  }, [parsed.requestedNetwork, parsed.network, storeNetwork, setStoreNetwork]);

  const writeContext = useCallback(
    (next: { network?: NetworkName | null; range?: TimeRange | null }) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next.network !== undefined) {
            if (next.network === null) params.delete('network');
            else params.set('network', next.network);
          }
          if (next.range !== undefined) {
            if (next.range === null) {
              params.delete('range');
              params.delete('from');
              params.delete('to');
            } else {
              params.set('range', next.range.value);
              if (next.range.value === 'custom') {
                if (next.range.from) params.set('from', next.range.from);
                else params.delete('from');
                if (next.range.to) params.set('to', next.range.to);
                else params.delete('to');
              } else {
                params.delete('from');
                params.delete('to');
              }
            }
          }
          return params;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const setNetwork = useCallback(
    (next: NetworkName) => {
      setStoreNetwork(next);
      writeContext({ network: next });
    },
    [setStoreNetwork, writeContext],
  );

  const setRange = useCallback(
    (preset: TimeRangePreset) => writeContext({ range: { value: preset } }),
    [writeContext],
  );

  const setCustomRange = useCallback(
    (from: string, to: string) => {
      const normalizedFrom = parseDateBoundary(from);
      const normalizedTo = parseDateBoundary(to);
      if (!normalizedFrom || !normalizedTo || normalizedFrom > normalizedTo) {
        return false;
      }
      writeContext({
        range: { value: 'custom', from: normalizedFrom, to: normalizedTo },
      });
      return true;
    },
    [writeContext],
  );

  const resetRange = useCallback(() => writeContext({ range: null }), [writeContext]);
  const clearNetworkOverride = useCallback(
    () => writeContext({ network: null }),
    [writeContext],
  );

  const resolvedRange = useMemo(() => resolveTimeRange(range), [range]);
  const timeRangeLabel = useMemo(() => describeTimeRange(range), [range]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      context: parsed,
      network,
      networkSource,
      range,
      resolvedRange,
      timeRangeLabel,
      setNetwork,
      setRange,
      setCustomRange,
      resetRange,
      clearNetworkOverride,
    }),
    [
      parsed,
      network,
      networkSource,
      range,
      resolvedRange,
      timeRangeLabel,
      setNetwork,
      setRange,
      setCustomRange,
      resetRange,
      clearNetworkOverride,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardContext(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
}
