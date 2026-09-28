import { describe, expect, it } from 'vitest';
import {
  calculateCohortRetention,
  exportCohortDataAsCsv,
  exportCohortDataAsJson,
  formatCohortHeader,
  generateMockAccountActivities,
  generatePeriodsHeader,
  getPeriodDiff,
  getPeriodStartTimestamp,
  parseTimestamp,
  type AccountActivityRecord,
} from '../cohortRetention';

describe('Cohort Retention Library', () => {
  // ── 1. Primary Flows ─────────────────────────────────────────────────────────

  describe('Primary Calculation Flow', () => {
    it('calculates weekly cohort retention correctly', () => {
      const baseMs = Date.UTC(2026, 5, 1); // Monday, Jun 1, 2026
      const weekMs = 7 * 24 * 60 * 60 * 1000;

      const records: AccountActivityRecord[] = [
        // Cohort 1: Account A & B (first seen week 0)
        { accountId: 'GACCOUNT_A', timestamp: baseMs, activityType: 'payment' },
        { accountId: 'GACCOUNT_B', timestamp: baseMs + 1000, activityType: 'payment' },

        // Week 1 activity: Account A returns, Account B inactive
        { accountId: 'GACCOUNT_A', timestamp: baseMs + weekMs, activityType: 'payment' },

        // Week 2 activity: Account A & B both active
        { accountId: 'GACCOUNT_A', timestamp: baseMs + 2 * weekMs, activityType: 'payment' },
        { accountId: 'GACCOUNT_B', timestamp: baseMs + 2 * weekMs, activityType: 'payment' },

        // Cohort 2: Account C (first seen week 1)
        { accountId: 'GACCOUNT_C', timestamp: baseMs + weekMs, activityType: 'payment' },
        { accountId: 'GACCOUNT_C', timestamp: baseMs + 2 * weekMs, activityType: 'payment' },
      ];

      const result = calculateCohortRetention(records, {
        granularity: 'week',
        maxPeriods: 3,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { cohorts, stats, periodsHeader } = result.data;
      expect(periodsHeader).toEqual(['Wk 0', '+1 Wk', '+2 Wk']);
      expect(cohorts.length).toBe(2);

      // Cohort 1 (Jun 1)
      const cohort1 = cohorts[0];
      expect(cohort1.totalAccounts).toBe(2);
      expect(cohort1.retentionByPeriod).toEqual([100, 50, 100]); // Wk 0: 100%, Wk 1: 50% (A only), Wk 2: 100% (A & B)
      expect(cohort1.activeAccountsByPeriod).toEqual([2, 1, 2]);

      // Cohort 2 (Jun 8)
      const cohort2 = cohorts[1];
      expect(cohort2.totalAccounts).toBe(1);
      expect(cohort2.retentionByPeriod).toEqual([100, 100, 0]); // Wk 0: 100%, Wk 1: 100% (C), Wk 2: 0%
      expect(cohort2.activeAccountsByPeriod).toEqual([1, 1, 0]);

      // Summary Stats
      expect(stats.totalCohorts).toBe(2);
      expect(stats.totalUniqueAccounts).toBe(3);
      expect(stats.avgPeriod1Retention).toBe(75); // (50 + 100) / 2
    });

    it('supports daily cohort retention', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const baseMs = Date.UTC(2026, 5, 1);

      const records: AccountActivityRecord[] = [
        { accountId: 'GA', timestamp: baseMs },
        { accountId: 'GA', timestamp: baseMs + dayMs },
      ];

      const result = calculateCohortRetention(records, { granularity: 'day', maxPeriods: 2 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.periodsHeader).toEqual(['Day 0', '+1 Day']);
      expect(result.data.cohorts[0].retentionByPeriod).toEqual([100, 100]);
    });

    it('supports monthly cohort retention', () => {
      const baseMs = Date.UTC(2026, 0, 15); // Jan 15, 2026
      const febMs = Date.UTC(2026, 1, 10); // Feb 10, 2026

      const records: AccountActivityRecord[] = [
        { accountId: 'GA', timestamp: baseMs },
        { accountId: 'GA', timestamp: febMs },
      ];

      const result = calculateCohortRetention(records, { granularity: 'month', maxPeriods: 2 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.periodsHeader).toEqual(['Mo 0', '+1 Mo']);
      expect(result.data.cohorts[0].retentionByPeriod).toEqual([100, 100]);
    });

    it('filters by activity type correctly', () => {
      const baseMs = Date.UTC(2026, 5, 1);
      const records: AccountActivityRecord[] = [
        { accountId: 'GA', timestamp: baseMs, activityType: 'payment' },
        { accountId: 'GA', timestamp: baseMs + 86400000, activityType: 'invoke_host_function' },
      ];

      const paymentResult = calculateCohortRetention(records, {
        granularity: 'day',
        activityFilter: 'payment',
        maxPeriods: 2,
      });

      expect(paymentResult.ok).toBe(true);
      if (!paymentResult.ok) return;
      expect(paymentResult.data.cohorts[0].retentionByPeriod).toEqual([100, 0]);
    });

    it('exports CSV and JSON formatted output', () => {
      const records = generateMockAccountActivities(10, 30);
      const result = calculateCohortRetention(records, { granularity: 'week' });

      const csv = exportCohortDataAsCsv(result);
      expect(csv).toContain('# Cohort Retention Report (WEEK)');
      expect(csv).toContain('Cohort Size (Accounts)');

      const json = exportCohortDataAsJson(result);
      const parsed = JSON.parse(json);
      expect(parsed.ok).toBe(true);
      expect(parsed.data.cohorts.length).toBeGreaterThan(0);
    });
  });

  // ── 2. Boundary Cases ───────────────────────────────────────────────────────

  describe('Boundary Cases', () => {
    it('handles empty records array gracefully', () => {
      const result = calculateCohortRetention([]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.cohorts).toEqual([]);
      expect(result.data.stats.totalCohorts).toBe(0);
      expect(result.data.stats.totalUniqueAccounts).toBe(0);
    });

    it('handles single account with single activity', () => {
      const result = calculateCohortRetention([
        { accountId: 'GA', timestamp: '2026-06-01T10:00:00Z' },
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.cohorts.length).toBe(1);
      expect(result.data.cohorts[0].totalAccounts).toBe(1);
      expect(result.data.cohorts[0].retentionByPeriod[0]).toBe(100);
    });

    it('handles 0% retention in all subsequent periods', () => {
      const baseMs = Date.UTC(2026, 5, 1);
      const records: AccountActivityRecord[] = [
        { accountId: 'GA', timestamp: baseMs },
        { accountId: 'GB', timestamp: baseMs },
      ];

      const result = calculateCohortRetention(records, { granularity: 'week', maxPeriods: 4 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.cohorts[0].retentionByPeriod).toEqual([100, 0, 0, 0]);
    });

    it('filters cohorts by minCohortSize', () => {
      const baseMs = Date.UTC(2026, 5, 1);
      const records: AccountActivityRecord[] = [
        { accountId: 'GA', timestamp: baseMs },
        { accountId: 'GB', timestamp: baseMs },
        { accountId: 'GC', timestamp: baseMs + 7 * 86400000 },
      ];

      const result = calculateCohortRetention(records, { granularity: 'week', minCohortSize: 2 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Only the first cohort has >= 2 accounts
      expect(result.data.cohorts.length).toBe(1);
      expect(result.data.cohorts[0].totalAccounts).toBe(2);
    });

    it('parses timestamps in string, number, and Date formats', () => {
      expect(parseTimestamp('2026-06-01T00:00:00Z')).toBe(1780272000000);
      expect(parseTimestamp(1780272000000)).toBe(1780272000000);
      expect(parseTimestamp(new Date(1780272000000))).toBe(1780272000000);
      expect(Number.isNaN(parseTimestamp('invalid-date'))).toBe(true);
      expect(Number.isNaN(parseTimestamp(null))).toBe(true);
    });

    it('calculates period differences correctly across month boundaries', () => {
      const jan15 = Date.UTC(2026, 0, 15);
      const feb15 = Date.UTC(2026, 1, 15);
      const mar01 = Date.UTC(2026, 2, 1);

      expect(getPeriodDiff(jan15, feb15, 'month')).toBe(1);
      expect(getPeriodDiff(jan15, mar01, 'month')).toBe(2);
    });
  });

  // ── 3. Failure Paths ────────────────────────────────────────────────────────

  describe('Failure Paths & Invalid Input', () => {
    it('returns error when input is null or non-array', () => {
      const resultNull = calculateCohortRetention(null as any);
      expect(resultNull.ok).toBe(false);
      if (!resultNull.ok) {
        expect(resultNull.error.code).toBe('INVALID_INPUT');
      }

      const resultNotArray = calculateCohortRetention({} as any);
      expect(resultNotArray.ok).toBe(false);
      if (!resultNotArray.ok) {
        expect(resultNotArray.error.code).toBe('INVALID_INPUT');
      }
    });

    it('returns error for invalid granularity option', () => {
      const result = calculateCohortRetention([], { granularity: 'year' as any });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toContain('Invalid granularity');
      }
    });

    it('returns error for negative maxPeriods or maxCohorts', () => {
      const result = calculateCohortRetention([], { maxPeriods: -5 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('ignores malformed records missing accountId or valid timestamp without crashing', () => {
      const records: any[] = [
        { accountId: '', timestamp: '2026-06-01' },
        { accountId: 'GA', timestamp: 'invalid-date' },
        { accountId: null, timestamp: 12345 },
        { accountId: 'GVALID', timestamp: '2026-06-01T00:00:00Z' },
      ];

      const result = calculateCohortRetention(records);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.cohorts.length).toBe(1);
      expect(result.data.cohorts[0].totalAccounts).toBe(1);
    });

    it('handles CSV export error state gracefully', () => {
      const csv = exportCohortDataAsCsv({
        ok: false,
        error: { code: 'CALCULATION_FAILED', message: 'Test failure' },
      });
      expect(csv).toContain('Error,CALCULATION_FAILED,Test failure');
    });
  });
});
