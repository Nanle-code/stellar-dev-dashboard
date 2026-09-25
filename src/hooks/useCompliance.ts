/**
 * Compliance Hooks (#447)
 *
 * React hooks for compliance reporting, retention policies,
 * log search, and audit analytics.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  generateSOC2Report,
  generateGDPRReport,
  generateCustomReport,
  exportReport,
  ReportType,
  ReportFormat,
} from '../lib/complianceReports.js';
import {
  getRetentionPolicies,
  setRetentionPolicy,
  applyRetentionPolicies,
  getArchives,
  getArchiveSummary,
  restoreArchive,
  deleteArchive,
  resetRetentionPolicies,
  estimateRetentionImpact,
} from '../lib/retentionPolicies.js';
import {
  searchAuditLogs,
  searchCount,
  exportFilteredLogs,
  getSavedSearches,
  saveSearch,
  deleteSavedSearch,
  getDateRangeForPreset,
  DateRangePreset,
  logFilterEngine,
} from '../lib/logSearch.js';
import {
  getAuditAnalytics,
  getComplianceMetrics,
  performRiskAssessment,
  subscribeComplianceMetrics,
  getUserBehaviorAnalytics,
  getActivityHeatmap,
} from '../lib/auditAnalytics.js';
import { getAuditEntries } from '../utils/audit.js';

// ─── Compliance Reports ────────────────────────────────────────────────────────

/**
 * Filters/overrides accepted when generating a compliance report.
 */
export type ComplianceReportFilters = Record<string, unknown>;

/**
 * Return value of the {@link useComplianceReport} hook.
 */
export interface UseComplianceReportReturn<TReport = unknown> {
  report: TReport | null;
  loading: boolean;
  error: string | null;
  generate: (overrides?: ComplianceReportFilters) => Promise<TReport | null>;
  exportAs: (format?: string, filename?: string) => void;
}

export function useComplianceReport<TReport = unknown>(
  type: string = ReportType.SOC2,
  filters: ComplianceReportFilters = {}
): UseComplianceReportReturn<TReport> {
  const [report, setReport] = useState<TReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (overrides: ComplianceReportFilters = {}): Promise<TReport | null> => {
    setLoading(true);
    setError(null);
    try {
      const opts = { ...filters, ...overrides };
      let result;
      switch (type) {
        case ReportType.SOC2:
          result = await generateSOC2Report(opts);
          break;
        case ReportType.GDPR:
          result = await generateGDPRReport(opts);
          break;
        case ReportType.CUSTOM:
          result = generateCustomReport(opts);
          break;
        default:
          result = generateCustomReport(opts);
      }
      setReport(result);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [type, JSON.stringify(filters)]);

  const exportAs = useCallback((format: string = ReportFormat.JSON, filename?: string): void => {
    if (!report) return;
    exportReport(report, format, filename || `${type}-report-${Date.now()}`);
  }, [report, type]);

  return { report, loading, error, generate, exportAs };
}

// ─── Retention Policies ────────────────────────────────────────────────────────

/**
 * Return value of the {@link useRetentionPolicies} hook.
 */
export interface UseRetentionPoliciesReturn<TPolicies = Record<string, unknown>> {
  policies: TPolicies;
  loading: boolean;
  updatePolicy: (category: string, policy: unknown) => Promise<void>;
  applyNow: () => Promise<unknown>;
  reset: () => Promise<void>;
}

export function useRetentionPolicies<TPolicies = Record<string, unknown>>(): UseRetentionPoliciesReturn<TPolicies> {
  const [policies, setPolicies] = useState<TPolicies>({} as TPolicies);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    getRetentionPolicies().then((p) => {
      setPolicies(p);
      setLoading(false);
    });
  }, []);

  const updatePolicy = useCallback(async (category: string, policy: unknown): Promise<void> => {
    await setRetentionPolicy(category, policy);
    const updated = await getRetentionPolicies();
    setPolicies(updated);
  }, []);

  const applyNow = useCallback(async () => {
    return await applyRetentionPolicies();
  }, []);

  const reset = useCallback(async () => {
    await resetRetentionPolicies();
    const updated = await getRetentionPolicies();
    setPolicies(updated);
  }, []);

  return { policies, loading, updatePolicy, applyNow, reset };
}

// ─── Archives ───────────────────────────────────────────────────────────────────

/**
 * Return value of the {@link useArchives} hook.
 */
export interface UseArchivesReturn<TArchive = unknown, TSummary = unknown> {
  archives: Record<string, TArchive>;
  summary: TSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
  restore: (archiveId: string) => Promise<unknown>;
  remove: (archiveId: string) => Promise<unknown>;
}

export function useArchives<TArchive = unknown, TSummary = unknown>(): UseArchivesReturn<TArchive, TSummary> {
  const [archives, setArchives] = useState<Record<string, TArchive>>({});
  const [summary, setSummary] = useState<TSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [archivesData, summaryData] = await Promise.all([
      getArchives(),
      getArchiveSummary(),
    ]);
    setArchives(archivesData);
    setSummary(summaryData);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const restore = useCallback(async (archiveId: string): Promise<unknown> => {
    const result = await restoreArchive(archiveId);
    if (result) await refresh();
    return result;
  }, [refresh]);

  const remove = useCallback(async (archiveId: string): Promise<unknown> => {
    const result = await deleteArchive(archiveId);
    if (result) await refresh();
    return result;
  }, [refresh]);

  return { archives, summary, loading, refresh, restore, remove };
}

// ─── Log Search ─────────────────────────────────────────────────────────────────

/**
 * Filters accepted by the log-search hooks.
 */
export type LogSearchFilters = Record<string, unknown>;

/**
 * Return value of the {@link useLogSearch} hook.
 */
export interface UseLogSearchReturn<TEntry = Record<string, unknown>> {
  results: TEntry[];
  totalCount: number;
  loading: boolean;
  filters: LogSearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<LogSearchFilters>>;
  search: (overrides?: LogSearchFilters) => Promise<void>;
  exportResults: (format?: string, filename?: string) => void;
}

export function useLogSearch<TEntry = Record<string, unknown>>(
  initialFilters: LogSearchFilters = {}
): UseLogSearchReturn<TEntry> {
  const [results, setResults] = useState<TEntry[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [filters, setFilters] = useState<LogSearchFilters>(initialFilters);

  const search = useCallback(async (overrides: LogSearchFilters = {}): Promise<void> => {
    setLoading(true);
    const opts = { ...filters, ...overrides };
    try {
      const entries = searchAuditLogs(opts);
      setResults(entries);
      setTotalCount(searchCount(opts));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { search(); }, [search]);

  const exportResults = useCallback((format = 'json', filename?: string): void => {
    if (results.length === 0) return;
    exportFilteredLogs({ ...filters, format, filename: filename || 'audit-search-results' });
  }, [filters, results]);

  return { results, totalCount, loading, filters, setFilters, search, exportResults };
}

// ─── Saved Searches ─────────────────────────────────────────────────────────────

/**
 * Return value of the {@link useSavedSearches} hook.
 */
export interface UseSavedSearchesReturn<TSearch = Record<string, unknown>> {
  searches: TSearch[];
  save: (name: string, filters: LogSearchFilters) => void;
  remove: (id: string) => void;
}

export function useSavedSearches<TSearch = Record<string, unknown>>(): UseSavedSearchesReturn<TSearch> {
  const [searches, setSearches] = useState<TSearch[]>(() => getSavedSearches());

  const save = useCallback((name: string, filters: LogSearchFilters): void => {
    const updated = saveSearch(name, filters);
    setSearches(updated);
  }, []);

  const remove = useCallback((id: string): void => {
    const updated = deleteSavedSearch(id);
    setSearches(updated);
  }, []);

  return { searches, save, remove };
}

// ─── Date Range ─────────────────────────────────────────────────────────────────

/**
 * A custom date range with nullable bounds.
 */
export interface CustomDateRange {
  from: string | number | Date | null;
  to: string | number | Date | null;
}

/**
 * Return value of the {@link useDateRange} hook.
 */
export interface UseDateRangeReturn<TPreset = string, TRange = unknown> {
  preset: TPreset;
  setPreset: React.Dispatch<React.SetStateAction<TPreset>>;
  range: TRange;
  customRange: CustomDateRange;
  setCustomRange: React.Dispatch<React.SetStateAction<CustomDateRange>>;
}

export function useDateRange<TPreset = string, TRange = unknown>(
  initialPreset: TPreset = DateRangePreset.LAST_24H as TPreset
): UseDateRangeReturn<TPreset, TRange> {
  const [preset, setPreset] = useState<TPreset>(initialPreset);
  const [customRange, setCustomRange] = useState<CustomDateRange>({ from: null, to: null });

  const range = useMemo(() => {
    if (preset === (DateRangePreset.CUSTOM as unknown as TPreset)) return customRange as unknown as TRange;
    return getDateRangeForPreset(preset as string) as TRange;
  }, [preset, customRange]);

  return { preset, setPreset, range, customRange, setCustomRange };
}

// ─── Audit Analytics ────────────────────────────────────────────────────────────

/**
 * Return value of the {@link useAuditAnalytics} hook.
 */
export interface UseAuditAnalyticsReturn<TAnalytics = unknown> {
  analytics: TAnalytics | null;
  refresh: () => void;
}

export function useAuditAnalytics<TAnalytics = unknown>(
  filters: LogSearchFilters = {}
): UseAuditAnalyticsReturn<TAnalytics> {
  const [analytics, setAnalytics] = useState<TAnalytics | null>(null);

  const refresh = useCallback((): void => {
    setAnalytics(getAuditAnalytics(filters));
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return { analytics, refresh };
}

// ─── Compliance Metrics ─────────────────────────────────────────────────────────

export function useComplianceMetrics<TMetrics = Record<string, unknown>>(): TMetrics {
  const [metrics, setMetrics] = useState<TMetrics>(() => getComplianceMetrics());

  useEffect(() => {
    const unsub = subscribeComplianceMetrics(setMetrics);
    return unsub;
  }, []);

  return metrics;
}

// ─── Risk Assessment ───────────────────────────────────────────────────────────

/**
 * Return value of the {@link useRiskAssessment} hook.
 */
export interface UseRiskAssessmentReturn<TAssessment = unknown> {
  assessment: TAssessment | null;
  loading: boolean;
  assess: () => TAssessment;
}

export function useRiskAssessment<TAssessment = unknown>(): UseRiskAssessmentReturn<TAssessment> {
  const [assessment, setAssessment] = useState<TAssessment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const assess = useCallback((): TAssessment => {
    setLoading(true);
    const result = performRiskAssessment();
    setAssessment(result);
    setLoading(false);
    return result;
  }, []);

  useEffect(() => { assess(); }, [assess]);

  return { assessment, loading, assess };
}

// ─── User Behavior ──────────────────────────────────────────────────────────────

/**
 * Return value of the {@link useUserBehavior} hook.
 */
export interface UseUserBehaviorReturn<TBehavior = unknown> {
  behavior: TBehavior | null;
  loading: boolean;
  analyze: () => Promise<void>;
}

export function useUserBehavior<TBehavior = unknown>(
  actor: string | null | undefined,
  filters: LogSearchFilters = {}
): UseUserBehaviorReturn<TBehavior> {
  const [behavior, setBehavior] = useState<TBehavior | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const analyze = useCallback(async (): Promise<void> => {
    if (!actor) return;
    setLoading(true);
    try {
      const result = getUserBehaviorAnalytics({ actor, ...filters });
      setBehavior(result);
    } finally {
      setLoading(false);
    }
  }, [actor, JSON.stringify(filters)]);

  useEffect(() => { analyze(); }, [analyze]);

  return { behavior, loading, analyze };
}

// ─── Activity Heatmap ───────────────────────────────────────────────────────────

/**
 * Return value of the {@link useActivityHeatmap} hook.
 */
export interface UseActivityHeatmapReturn<THeatmap = Record<string, number>> {
  heatmap: THeatmap;
  refresh: () => void;
}

export function useActivityHeatmap<THeatmap = Record<string, number>>(
  filters: LogSearchFilters = {}
): UseActivityHeatmapReturn<THeatmap> {
  const [heatmap, setHeatmap] = useState<THeatmap>({} as THeatmap);

  const refresh = useCallback((): void => {
    setHeatmap(getActivityHeatmap(filters));
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return { heatmap, refresh };
}

// ─── Retention Impact Estimate ──────────────────────────────────────────────────

/**
 * Return value of the {@link useRetentionImpact} hook.
 */
export interface UseRetentionImpactReturn<TImpact = unknown> {
  impact: TImpact[];
  loading: boolean;
}

export function useRetentionImpact<TImpact = unknown>(): UseRetentionImpactReturn<TImpact> {
  const [impact, setImpact] = useState<TImpact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    estimateRetentionImpact().then((data) => {
      setImpact(data);
      setLoading(false);
    });
  }, []);

  return { impact, loading };
}
