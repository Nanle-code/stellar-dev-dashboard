/**
 * useCspViolations — Issue #831
 *
 * Subscribes to the shared CSP violation reporter and exposes the sampled
 * violations + drop counters for the triage dashboard.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getCspReporter,
  type CspReporterStats,
  type CspViolation,
} from '../lib/cspReporting';

export interface UseCspViolationsReturn {
  violations: CspViolation[];
  stats: CspReporterStats;
  clear: () => void;
}

export function useCspViolations(): UseCspViolationsReturn {
  const reporter = getCspReporter();
  const [violations, setViolations] = useState<CspViolation[]>(() => reporter.getViolations());
  const [stats, setStats] = useState<CspReporterStats>(() => reporter.getStats());

  useEffect(() => {
    setViolations(reporter.getViolations());
    setStats(reporter.getStats());
    const unsubscribe = reporter.subscribe(() => {
      setViolations(reporter.getViolations());
      setStats(reporter.getStats());
    });
    return unsubscribe;
  }, [reporter]);

  const clear = useCallback(() => {
    reporter.clear();
    setViolations(reporter.getViolations());
    setStats(reporter.getStats());
  }, [reporter]);

  return { violations, stats, clear };
}
