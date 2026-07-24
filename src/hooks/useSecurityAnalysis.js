/**
 * useSecurityAnalysis Hook
 *
 * Integrates the security analysis engine with the audit trail system.
 * Provides real-time analysis that updates as new audit entries arrive.
 *
 * @returns {{
 *   report: object,
 *   findings: object[],
 *   riskScore: object,
 *   isAnalyzing: boolean,
 *   refresh: () => void,
 *   filterEntries: (opts) => object[],
 * }}
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAuditEntries, subscribeAudit } from '../utils/audit.js';
import {
  generateReport,
  computeAggregateRisk,
  DEFAULT_CONFIG,
  createStreamingEngine,
} from '../utils/securityAnalysis.js';

/**
 * @param {object} [opts]
 * @param {object} [opts.filters] - Audit entry filters (category, severity, actor, etc.)
 * @param {number} [opts.analysisIntervalMs=5000] - How often to re-analyze
 * @param {object} [opts.config] - Custom analysis config overrides
 */
export function useSecurityAnalysis(opts = {}) {
  const { filters = {}, analysisIntervalMs = 5000, config: configOverrides = {} } = opts;

  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...configOverrides }),
    [JSON.stringify(configOverrides)], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const engineRef = useRef(createStreamingEngine(config));
  const [report, setReport] = useState(() => generateReport([], config));
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = useCallback(() => {
    setIsAnalyzing(true);
    try {
      const entries = getAuditEntries({ ...filters, limit: 1000 });
      const newReport = generateReport(entries, config);
      setReport(newReport);

      // Also update the streaming engine
      const engine = engineRef.current;
      engine.reset();
      for (const entry of entries) {
        engine.addEntry(entry);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [filters, config]);

  // Initial analysis and periodic refresh
  useEffect(() => {
    analyze();
    const interval = setInterval(analyze, analysisIntervalMs);
    return () => clearInterval(interval);
  }, [analyze, analysisIntervalMs]);

  // Subscribe to new audit entries for real-time updates
  useEffect(() => {
    const unsub = subscribeAudit((entry) => {
      // Quick filter check before triggering full re-analysis
      if (filters.category && entry.category !== filters.category) return;
      if (filters.severity && entry.severity !== filters.severity) return;

      // Debounce: add to engine immediately, but batch re-analysis
      engineRef.current.addEntry(entry);
    });
    return unsub;
  }, [filters]);

  const findings = useMemo(() => report.findings, [report]);
  const riskScore = useMemo(() => report.riskScore, [report]);

  const filterEntries = useCallback(
    (extraFilters) => getAuditEntries({ ...filters, ...extraFilters }),
    [filters],
  );

  return {
    report,
    findings,
    riskScore,
    isAnalyzing,
    refresh: analyze,
    filterEntries,
  };
}

export default useSecurityAnalysis;
