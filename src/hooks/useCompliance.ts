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

export function useComplianceReport(type = ReportType.SOC2, filters = {}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generate = useCallback(async (overrides = {}) => {
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

  const exportAs = useCallback((format = ReportFormat.JSON, filename) => {
    if (!report) return;
    exportReport(report, format, filename || `${type}-report-${Date.now()}`);
  }, [report, type]);

  return { report, loading, error, generate, exportAs };
}

// ─── Retention Policies ────────────────────────────────────────────────────────

export function useRetentionPolicies() {
  const [policies, setPolicies] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRetentionPolicies().then((p) => {
      setPolicies(p);
      setLoading(false);
    });
  }, []);

  const updatePolicy = useCallback(async (category, policy) => {
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

export function useArchives() {
  const [archives, setArchives] = useState({});
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
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

  const restore = useCallback(async (archiveId) => {
    const result = await restoreArchive(archiveId);
    if (result) await refresh();
    return result;
  }, [refresh]);

  const remove = useCallback(async (archiveId) => {
    const result = await deleteArchive(archiveId);
    if (result) await refresh();
    return result;
  }, [refresh]);

  return { archives, summary, loading, refresh, restore, remove };
}

// ─── Log Search ─────────────────────────────────────────────────────────────────

export function useLogSearch(initialFilters = {}) {
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(initialFilters);

  const search = useCallback(async (overrides = {}) => {
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

  const exportResults = useCallback((format = 'json', filename) => {
    if (results.length === 0) return;
    exportFilteredLogs({ ...filters, format, filename: filename || 'audit-search-results' });
  }, [filters, results]);

  return { results, totalCount, loading, filters, setFilters, search, exportResults };
}

// ─── Saved Searches ─────────────────────────────────────────────────────────────

export function useSavedSearches() {
  const [searches, setSearches] = useState(() => getSavedSearches());

  const save = useCallback((name, filters) => {
    const updated = saveSearch(name, filters);
    setSearches(updated);
  }, []);

  const remove = useCallback((id) => {
    const updated = deleteSavedSearch(id);
    setSearches(updated);
  }, []);

  return { searches, save, remove };
}

// ─── Date Range ─────────────────────────────────────────────────────────────────

export function useDateRange(initialPreset = DateRangePreset.LAST_24H) {
  const [preset, setPreset] = useState(initialPreset);
  const [customRange, setCustomRange] = useState({ from: null, to: null });

  const range = useMemo(() => {
    if (preset === DateRangePreset.CUSTOM) return customRange;
    return getDateRangeForPreset(preset);
  }, [preset, customRange]);

  return { preset, setPreset, range, customRange, setCustomRange };
}

// ─── Audit Analytics ────────────────────────────────────────────────────────────

export function useAuditAnalytics(filters = {}) {
  const [analytics, setAnalytics] = useState(null);

  const refresh = useCallback(() => {
    setAnalytics(getAuditAnalytics(filters));
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return { analytics, refresh };
}

// ─── Compliance Metrics ─────────────────────────────────────────────────────────

export function useComplianceMetrics() {
  const [metrics, setMetrics] = useState(() => getComplianceMetrics());

  useEffect(() => {
    const unsub = subscribeComplianceMetrics(setMetrics);
    return unsub;
  }, []);

  return metrics;
}

// ─── Risk Assessment ───────────────────────────────────────────────────────────

export function useRiskAssessment() {
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);

  const assess = useCallback(() => {
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

export function useUserBehavior(actor, filters = {}) {
  const [behavior, setBehavior] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async () => {
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

export function useActivityHeatmap(filters = {}) {
  const [heatmap, setHeatmap] = useState({});

  const refresh = useCallback(() => {
    setHeatmap(getActivityHeatmap(filters));
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return { heatmap, refresh };
}

// ─── Retention Impact Estimate ──────────────────────────────────────────────────

export function useRetentionImpact() {
  const [impact, setImpact] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    estimateRetentionImpact().then((data) => {
      setImpact(data);
      setLoading(false);
    });
  }, []);

  return { impact, loading };
}
