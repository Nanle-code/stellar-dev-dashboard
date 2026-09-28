/**
 * Cohort Retention Library
 *
 * Provides cohort analysis for Stellar account activity.
 * Groups accounts by their first-seen period (Day, Week, or Month)
 * and calculates retention rates across subsequent activity periods.
 */

export type CohortGranularity = 'day' | 'week' | 'month';

export type ActivityFilter = 'all' | 'payment' | 'contract' | 'trade';

export interface AccountActivityRecord {
  /** Account ID or Public Key (e.g. "GABC...") */
  accountId: string;
  /** ISO timestamp string or epoch milliseconds or Date object */
  timestamp: string | number | Date;
  /** Optional activity or operation type (e.g. "payment", "invoke_host_function", "trade") */
  activityType?: string;
  /** Optional transaction amount */
  amount?: number;
  /** Optional transaction hash */
  txHash?: string;
}

export interface CohortRetentionOptions {
  /** Time period grouping: 'day', 'week', or 'month'. Default: 'week' */
  granularity?: CohortGranularity;
  /** Optional filter by activity type. Default: 'all' */
  activityFilter?: ActivityFilter;
  /** Maximum number of cohorts to evaluate. Default: 12 */
  maxCohorts?: number;
  /** Maximum number of subsequent periods to display (Period 0 to N). Default: 8 */
  maxPeriods?: number;
  /** Minimum cohort size required to include in analysis. Default: 1 */
  minCohortSize?: number;
}

export interface CohortRow {
  /** Unique identifier for the cohort (e.g., "2026-W01" or "2026-06-15") */
  cohortKey: string;
  /** Human-readable title for the cohort (e.g., "Jun 15 - Jun 21, 2026") */
  cohortLabel: string;
  /** Start ISO timestamp for the cohort period */
  cohortStartDate: string;
  /** Total unique accounts first seen in this cohort (Period 0) */
  totalAccounts: number;
  /** Retention percentage (0 to 100) for Period 0, 1, 2, ... */
  retentionByPeriod: number[];
  /** Count of unique active accounts for Period 0, 1, 2, ... */
  activeAccountsByPeriod: number[];
}

export interface CohortCurvePoint {
  period: number;
  periodLabel: string;
  avgRetentionRate: number;
  totalActiveAccounts: number;
  evaluatedCohorts: number;
}

export interface CohortSummaryStats {
  /** Total cohorts evaluated */
  totalCohorts: number;
  /** Total unique accounts across all cohorts */
  totalUniqueAccounts: number;
  /** Average retention rate (%) in Period 1 (+1 day/week/month) */
  avgPeriod1Retention: number;
  /** Average retention rate (%) in Period 4 (+4 days/weeks/months) */
  avgPeriod4Retention: number;
  /** Overall average retention rate across all periods > 0 */
  overallAvgRetention: number;
  /** Cohort key with the highest Period 1 retention */
  bestCohortKey: string | null;
  /** Average retention curve aggregated across all cohorts */
  retentionCurve: CohortCurvePoint[];
}

export interface CohortDataSnapshot {
  granularity: CohortGranularity;
  activityFilter: ActivityFilter;
  cohorts: CohortRow[];
  periodsHeader: string[];
  stats: CohortSummaryStats;
  generatedAt: string;
}

export type CohortErrorCode =
  'INVALID_INPUT' | 'UNSUPPORTED_ENVIRONMENT' | 'CALCULATION_FAILED' | 'NO_DATA';

export interface CohortError {
  code: CohortErrorCode;
  message: string;
  details?: string;
}

export type CohortRetentionResult =
  { ok: true; data: CohortDataSnapshot } | { ok: false; error: CohortError };

// ─── Environment & Validation Helpers ─────────────────────────────────────────

/**
 * Safely parses any valid timestamp format into epoch milliseconds.
 * Returns NaN if invalid.
 */
export function parseTimestamp(ts: string | number | Date | undefined | null): number {
  if (ts === undefined || ts === null) return NaN;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') {
    if (!Number.isFinite(ts) || ts <= 0) return NaN;
    return ts;
  }
  if (typeof ts === 'string') {
    const trimmed = ts.trim();
    if (!trimmed) return NaN;
    // Check if numeric string
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : NaN;
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

/**
 * Normalizes a date to the start of its cohort period (day, week, or month).
 * Week starts on Monday.
 */
export function getPeriodStartTimestamp(timeMs: number, granularity: CohortGranularity): number {
  const d = new Date(timeMs);
  if (isNaN(d.getTime())) return NaN;

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const date = d.getUTCDate();

  if (granularity === 'day') {
    return Date.UTC(year, month, date);
  }

  if (granularity === 'week') {
    // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
    const dayOfWeek = d.getUTCDay();
    // Calculate distance to previous Monday (ISO week)
    const diffToMonday = (dayOfWeek + 6) % 7;
    return Date.UTC(year, month, date - diffToMonday);
  }

  if (granularity === 'month') {
    return Date.UTC(year, month, 1);
  }

  return NaN;
}

/**
 * Computes period offset between two cohort timestamps based on granularity.
 */
export function getPeriodDiff(
  startMs: number,
  currentMs: number,
  granularity: CohortGranularity
): number {
  if (currentMs < startMs) return -1;
  const msDiff = currentMs - startMs;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  if (granularity === 'day') {
    return Math.floor(msDiff / MS_PER_DAY);
  }

  if (granularity === 'week') {
    return Math.floor(msDiff / (7 * MS_PER_DAY));
  }

  if (granularity === 'month') {
    const dStart = new Date(startMs);
    const dCurr = new Date(currentMs);
    const months =
      (dCurr.getUTCFullYear() - dStart.getUTCFullYear()) * 12 +
      (dCurr.getUTCMonth() - dStart.getUTCMonth());
    return months;
  }

  return -1;
}

/**
 * Formats a period start timestamp into a human-readable cohort key and label.
 */
export function formatCohortHeader(
  startMs: number,
  granularity: CohortGranularity
): { key: string; label: string } {
  const d = new Date(startMs);
  const isoDate = d.toISOString().slice(0, 10);

  if (granularity === 'day') {
    return {
      key: isoDate,
      label: d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    };
  }

  if (granularity === 'week') {
    const endOfWeek = new Date(startMs + 6 * 24 * 60 * 60 * 1000);
    const startStr = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const endStr = endOfWeek.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return {
      key: `W-${isoDate}`,
      label: `${startStr} – ${endStr}`,
    };
  }

  // Month
  const monthStr = d.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const key = isoDate.slice(0, 7); // YYYY-MM
  return {
    key: `M-${key}`,
    label: monthStr,
  };
}

/**
 * Generates header labels for periods (+0, +1, +2, ...).
 */
export function generatePeriodsHeader(
  maxPeriods: number,
  granularity: CohortGranularity
): string[] {
  const unit = granularity === 'day' ? 'Day' : granularity === 'week' ? 'Wk' : 'Mo';
  const headers: string[] = [`${unit} 0`];
  for (let i = 1; i < maxPeriods; i++) {
    headers.push(`+${i} ${unit}`);
  }
  return headers;
}

// ─── Core Calculation Logic ───────────────────────────────────────────────────

/**
 * Calculates cohort retention rates for account activity data.
 */
export function calculateCohortRetention(
  records: AccountActivityRecord[] | null | undefined,
  options: CohortRetentionOptions = {}
): CohortRetentionResult {
  try {
    // 1. Validate environment
    if (typeof Date === 'undefined' || typeof Math === 'undefined') {
      return {
        ok: false,
        error: {
          code: 'UNSUPPORTED_ENVIRONMENT',
          message:
            'The current runtime environment lacks required JavaScript Date or Math built-ins.',
        },
      };
    }

    // 2. Validate input
    if (!records || !Array.isArray(records)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Input records must be a valid array of account activity entries.',
        },
      };
    }

    const {
      granularity = 'week',
      activityFilter = 'all',
      maxCohorts = 12,
      maxPeriods = 8,
      minCohortSize = 1,
    } = options;

    if (!['day', 'week', 'month'].includes(granularity)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: `Invalid granularity "${granularity}". Must be one of: "day", "week", "month".`,
        },
      };
    }

    if (maxCohorts <= 0 || maxPeriods <= 0 || minCohortSize < 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Parameters maxCohorts, maxPeriods, and minCohortSize must be positive numbers.',
        },
      };
    }

    // 3. Filter records by activity type if specified
    const filteredRecords = records.filter((rec) => {
      if (!rec || typeof rec.accountId !== 'string' || !rec.accountId.trim()) return false;
      const tsMs = parseTimestamp(rec.timestamp);
      if (isNaN(tsMs)) return false;

      if (activityFilter === 'all') return true;
      if (!rec.activityType) return true;

      const actLower = rec.activityType.toLowerCase();
      if (activityFilter === 'payment') {
        return (
          actLower.includes('payment') || actLower.includes('send') || actLower.includes('receive')
        );
      }
      if (activityFilter === 'contract') {
        return (
          actLower.includes('contract') ||
          actLower.includes('host') ||
          actLower.includes('invoke') ||
          actLower.includes('wasm')
        );
      }
      if (activityFilter === 'trade') {
        return (
          actLower.includes('trade') ||
          actLower.includes('offer') ||
          actLower.includes('swap') ||
          actLower.includes('dex')
        );
      }
      return true;
    });

    if (filteredRecords.length === 0) {
      return {
        ok: true,
        data: {
          granularity,
          activityFilter,
          cohorts: [],
          periodsHeader: generatePeriodsHeader(maxPeriods, granularity),
          stats: {
            totalCohorts: 0,
            totalUniqueAccounts: 0,
            avgPeriod1Retention: 0,
            avgPeriod4Retention: 0,
            overallAvgRetention: 0,
            bestCohortKey: null,
            retentionCurve: [],
          },
          generatedAt: new Date().toISOString(),
        },
      };
    }

    // 4. Determine first-seen period for each account
    const accountFirstSeenMap = new Map<string, number>(); // accountId -> firstPeriodStartMs
    const accountActivityMap = new Map<string, Map<number, Set<string>>>(); // periodStartMs -> Map<periodIndex, Set<accountId>>

    // Pre-calculate parsed timestamps & period starts
    const validActivities: { accountId: string; tsMs: number; periodStartMs: number }[] = [];
    for (const rec of filteredRecords) {
      const tsMs = parseTimestamp(rec.timestamp);
      const periodStartMs = getPeriodStartTimestamp(tsMs, granularity);
      if (isNaN(periodStartMs)) continue;
      validActivities.push({ accountId: rec.accountId.trim(), tsMs, periodStartMs });

      const prevFirst = accountFirstSeenMap.get(rec.accountId.trim());
      if (prevFirst === undefined || periodStartMs < prevFirst) {
        accountFirstSeenMap.set(rec.accountId.trim(), periodStartMs);
      }
    }

    if (accountFirstSeenMap.size === 0) {
      return {
        ok: true,
        data: {
          granularity,
          activityFilter,
          cohorts: [],
          periodsHeader: generatePeriodsHeader(maxPeriods, granularity),
          stats: {
            totalCohorts: 0,
            totalUniqueAccounts: 0,
            avgPeriod1Retention: 0,
            avgPeriod4Retention: 0,
            overallAvgRetention: 0,
            bestCohortKey: null,
            retentionCurve: [],
          },
          generatedAt: new Date().toISOString(),
        },
      };
    }

    // Group accounts into cohorts by their first-seen period
    const cohortAccountSetMap = new Map<number, Set<string>>(); // cohortStartMs -> Set<accountId>
    accountFirstSeenMap.forEach((firstSeenMs, accountId) => {
      let set = cohortAccountSetMap.get(firstSeenMs);
      if (!set) {
        set = new Set<string>();
        cohortAccountSetMap.set(firstSeenMs, set);
      }
      set.add(accountId);
    });

    // 5. Build activity index for each cohort
    // cohortStartMs -> Map<subsequentPeriodIndex, Set<activeAccountId>>
    const cohortActivityIndex = new Map<number, Map<number, Set<string>>>();

    // Initialize indexes
    cohortAccountSetMap.forEach((accounts, cohortStartMs) => {
      const periodMap = new Map<number, Set<string>>();
      for (let p = 0; p < maxPeriods; p++) {
        periodMap.set(p, new Set<string>());
      }
      cohortActivityIndex.set(cohortStartMs, periodMap);
    });

    // Populate activity for each account's subsequent events
    for (const act of validActivities) {
      const cohortStartMs = accountFirstSeenMap.get(act.accountId);
      if (cohortStartMs === undefined) continue;

      const pDiff = getPeriodDiff(cohortStartMs, act.tsMs, granularity);
      if (pDiff >= 0 && pDiff < maxPeriods) {
        const periodMap = cohortActivityIndex.get(cohortStartMs);
        if (periodMap) {
          const activeSet = periodMap.get(pDiff);
          if (activeSet) {
            activeSet.add(act.accountId);
          }
        }
      }
    }

    // Sort cohort timestamps chronologically (descending to show latest first, or ascending for chronological)
    // We sort ascending for cohort timeline order
    const sortedCohortStarts = Array.from(cohortAccountSetMap.keys()).sort((a, b) => a - b);

    // Limit to maxCohorts (take the most recent maxCohorts)
    const activeCohortStarts = sortedCohortStarts.slice(-maxCohorts);

    const cohortRows: CohortRow[] = [];
    let bestCohortKey: string | null = null;
    let highestP1Retention = -1;

    for (const cohortStartMs of activeCohortStarts) {
      const accountsInCohort = cohortAccountSetMap.get(cohortStartMs);
      const totalCohortSize = accountsInCohort ? accountsInCohort.size : 0;

      if (totalCohortSize < minCohortSize) continue;

      const { key, label } = formatCohortHeader(cohortStartMs, granularity);
      const periodMap = cohortActivityIndex.get(cohortStartMs);

      const activeAccountsByPeriod: number[] = [];
      const retentionByPeriod: number[] = [];

      for (let p = 0; p < maxPeriods; p++) {
        const activeSet = periodMap?.get(p);
        const activeCount = activeSet ? activeSet.size : p === 0 ? totalCohortSize : 0;
        activeAccountsByPeriod.push(activeCount);

        const rate = totalCohortSize > 0 ? (activeCount / totalCohortSize) * 100 : 0;
        // Round to 1 decimal place
        retentionByPeriod.push(Math.round(rate * 10) / 10);
      }

      if (retentionByPeriod.length > 1 && retentionByPeriod[1] > highestP1Retention) {
        highestP1Retention = retentionByPeriod[1];
        bestCohortKey = key;
      }

      cohortRows.push({
        cohortKey: key,
        cohortLabel: label,
        cohortStartDate: new Date(cohortStartMs).toISOString(),
        totalAccounts: totalCohortSize,
        retentionByPeriod,
        activeAccountsByPeriod,
      });
    }

    // 6. Aggregate summary statistics & retention curve
    const retentionCurve: CohortCurvePoint[] = [];
    const periodsHeader = generatePeriodsHeader(maxPeriods, granularity);

    let sumP1 = 0;
    let countP1 = 0;
    let sumP4 = 0;
    let countP4 = 0;
    let sumOverall = 0;
    let countOverall = 0;

    for (let p = 0; p < maxPeriods; p++) {
      let periodSumRate = 0;
      let periodTotalActive = 0;
      let evaluatedCohortsForP = 0;

      for (const row of cohortRows) {
        if (p < row.retentionByPeriod.length) {
          const rate = row.retentionByPeriod[p];
          periodSumRate += rate;
          periodTotalActive += row.activeAccountsByPeriod[p] || 0;
          evaluatedCohortsForP++;

          if (p === 1) {
            sumP1 += rate;
            countP1++;
          }
          if (p === 4) {
            sumP4 += rate;
            countP4++;
          }
          if (p > 0) {
            sumOverall += rate;
            countOverall++;
          }
        }
      }

      const avgRate =
        evaluatedCohortsForP > 0 ? periodSumRate / evaluatedCohortsForP : p === 0 ? 100 : 0;

      retentionCurve.push({
        period: p,
        periodLabel: periodsHeader[p] || `Period ${p}`,
        avgRetentionRate: Math.round(avgRate * 10) / 10,
        totalActiveAccounts: periodTotalActive,
        evaluatedCohorts: evaluatedCohortsForP,
      });
    }

    const stats: CohortSummaryStats = {
      totalCohorts: cohortRows.length,
      totalUniqueAccounts: accountFirstSeenMap.size,
      avgPeriod1Retention: countP1 > 0 ? Math.round((sumP1 / countP1) * 10) / 10 : 0,
      avgPeriod4Retention: countP4 > 0 ? Math.round((sumP4 / countP4) * 10) / 10 : 0,
      overallAvgRetention: countOverall > 0 ? Math.round((sumOverall / countOverall) * 10) / 10 : 0,
      bestCohortKey,
      retentionCurve,
    };

    return {
      ok: true,
      data: {
        granularity,
        activityFilter,
        cohorts: cohortRows,
        periodsHeader,
        stats,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'CALCULATION_FAILED',
        message:
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred during cohort calculation.',
        details: String(err),
      },
    };
  }
}

// ─── Export Helpers ───────────────────────────────────────────────────────────

/**
 * Converts cohort data snapshot into a clean CSV string.
 */
export function exportCohortDataAsCsv(result: CohortRetentionResult): string {
  if (result.ok === false) {
    return `Error,${result.error.code},${result.error.message}`;
  }

  const { cohorts, periodsHeader, granularity } = result.data;
  const headers = [
    'Cohort Key',
    'Cohort Label',
    'Cohort Start Date',
    'Cohort Size (Accounts)',
    ...periodsHeader.map((p) => `Retention % (${p})`),
  ];

  const rows = cohorts.map((c) => {
    return [
      `"${c.cohortKey}"`,
      `"${c.cohortLabel}"`,
      `"${c.cohortStartDate}"`,
      c.totalAccounts,
      ...c.retentionByPeriod,
    ].join(',');
  });

  return [
    `# Cohort Retention Report (${granularity.toUpperCase()})`,
    headers.join(','),
    ...rows,
  ].join('\n');
}

/**
 * Converts cohort data snapshot into formatted JSON string.
 */
export function exportCohortDataAsJson(result: CohortRetentionResult): string {
  return JSON.stringify(result, null, 2);
}

// ─── Mock Data Generator for Demos & Testing ─────────────────────────────────

/**
 * Generates synthetic account activity dataset for testing and demonstration.
 */
export function generateMockAccountActivities(
  accountCount = 80,
  daysSpan = 60
): AccountActivityRecord[] {
  const activities: AccountActivityRecord[] = [];
  const now = Date.now();
  const startMs = now - daysSpan * 24 * 60 * 60 * 1000;

  const activityTypes = [
    'payment',
    'payment',
    'invoke_host_function',
    'manage_sell_offer',
    'create_account',
    'change_trust',
  ];

  for (let i = 0; i < accountCount; i++) {
    const accountId = `G${String.fromCharCode(65 + (i % 26))}${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
    // Assign first-seen timestamp evenly across the span
    const firstSeenMs = startMs + Math.random() * (daysSpan - 14) * 24 * 60 * 60 * 1000;

    // First activity
    activities.push({
      accountId,
      timestamp: new Date(firstSeenMs).toISOString(),
      activityType: 'create_account',
      amount: 100,
    });

    // Simulate retention behavior (different decay patterns for different cohorts)
    const retentionDecay = 0.4 + Math.random() * 0.5; // 40% - 90% retention decay rate
    let currentMs = firstSeenMs;

    // Subsequent activities over the remaining time span
    while (currentMs < now) {
      // Step forward by 1-7 days
      currentMs += (1 + Math.random() * 6) * 24 * 60 * 60 * 1000;
      if (currentMs > now) break;

      // Probabilistic retention check
      if (Math.random() < retentionDecay) {
        const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
        activities.push({
          accountId,
          timestamp: new Date(currentMs).toISOString(),
          activityType: type,
          amount: Math.round(Math.random() * 500 * 100) / 100,
        });
      }
    }
  }

  return activities;
}
