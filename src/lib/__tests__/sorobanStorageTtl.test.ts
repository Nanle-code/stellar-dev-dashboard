/**
 * Tests for Soroban Storage TTL Inspection
 * #851 - Support durable and temporary storage TTL inspection
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTtl,
  formatTtl,
  getTtlColor,
  getTtlRecommendations,
  parseStorageKey,
  estimateStorageSize,
  getStorageType,
  DEFAULT_WARNING_THRESHOLD,
  DEFAULT_CRITICAL_THRESHOLD,
} from '../sorobanStorageTtl';

describe('Soroban Storage TTL', () => {
  describe('calculateTtl', () => {
    it('should calculate remaining ledgers correctly', () => {
      const ttl = calculateTtl(10000, 5000);
      expect(ttl.remainingLedgers).toBe(5000);
      expect(ttl.currentLedger).toBe(5000);
      expect(ttl.liveUntilLedger).toBe(10000);
    });

    it('should identify expired entries', () => {
      const ttl = calculateTtl(5000, 10000);
      expect(ttl.isExpired).toBe(true);
      expect(ttl.remainingLedgers).toBe(-5000);
    });

    it('should identify entries expiring soon', () => {
      const ttl = calculateTtl(6000, 5000, { warningThreshold: DEFAULT_WARNING_THRESHOLD });
      expect(ttl.isExpiringSoon).toBe(true);
      expect(ttl.remainingLedgers).toBe(1000);
    });

    it('should not mark safe entries as expiring soon', () => {
      const ttl = calculateTtl(20000, 5000, { warningThreshold: DEFAULT_WARNING_THRESHOLD });
      expect(ttl.isExpiringSoon).toBe(false);
      expect(ttl.remainingLedgers).toBe(15000);
    });

    it('should estimate expiration date', () => {
      const ttl = calculateTtl(10000, 5000);
      expect(ttl.expirationDate).toBeInstanceOf(Date);
      const timeDiff = ttl.expirationDate!.getTime() - Date.now();
      expect(timeDiff).toBeGreaterThan(0);
    });

    it('should use custom config when provided', () => {
      const ttl = calculateTtl(10000, 5000, {
        warningThreshold: 2000,
        criticalThreshold: 1000,
        currentLedger: 5000,
      });
      expect(ttl.isExpiringSoon).toBe(false);
    });
  });

  describe('formatTtl', () => {
    it('should format expired TTL', () => {
      const ttl = calculateTtl(5000, 10000);
      expect(formatTtl(ttl)).toBe('Expired');
    });

    it('should format TTL in days', () => {
      const ttl = calculateTtl(50000 + 5000, 5000); // ~2 days
      const formatted = formatTtl(ttl);
      expect(formatted).toContain('day');
    });

    it('should format TTL in hours', () => {
      const ttl = calculateTtl(5000 + 1000, 5000); // ~1 hour
      const formatted = formatTtl(ttl);
      expect(formatted).toContain('hour');
    });

    it('should format TTL in minutes', () => {
      const ttl = calculateTtl(5000 + 100, 5000); // ~6 minutes
      const formatted = formatTtl(ttl);
      expect(formatted).toContain('minute');
    });

    it('should handle null TTL', () => {
      expect(formatTtl(null)).toBe('No TTL');
    });
  });

  describe('getTtlColor', () => {
    it('should return gray for null TTL', () => {
      expect(getTtlColor(null)).toBe('#6b7280');
    });

    it('should return dark red for expired', () => {
      const ttl = calculateTtl(5000, 10000);
      expect(getTtlColor(ttl)).toBe('#dc2626');
    });

    it('should return red for critical', () => {
      const ttl = calculateTtl(5000 + 1000, 5000);
      expect(getTtlColor(ttl)).toBe('#ef4444');
    });

    it('should return amber for warning', () => {
      const ttl = calculateTtl(5000 + 6000, 5000);
      expect(getTtlColor(ttl)).toBe('#f59e0b');
    });

    it('should return green for safe', () => {
      const ttl = calculateTtl(50000, 5000);
      expect(getTtlColor(ttl)).toBe('#22c55e');
    });
  });

  describe('parseStorageKey', () => {
    it('should parse simple key', () => {
      const parsed = parseStorageKey('user:123');
      expect(parsed.type).toBe('user');
      expect(parsed.identifier).toBe('123');
    });

    it('should parse complex key', () => {
      const parsed = parseStorageKey('config:theme:dark');
      expect(parsed.type).toBe('config');
      expect(parsed.identifier).toBe('theme:dark');
    });

    it('should handle unknown format', () => {
      const parsed = parseStorageKey('simplekey');
      expect(parsed.type).toBe('unknown');
      expect(parsed.identifier).toBe('simplekey');
    });
  });

  describe('estimateStorageSize', () => {
    it('should estimate string size', () => {
      const size = estimateStorageSize('hello world');
      expect(size).toBeGreaterThan(0);
    });

    it('should estimate number size', () => {
      const size = estimateStorageSize(12345);
      expect(size).toBe(8);
    });

    it('should estimate boolean size', () => {
      const size = estimateStorageSize(true);
      expect(size).toBe(1);
    });

    it('should estimate object size', () => {
      const size = estimateStorageSize({ key: 'value' });
      expect(size).toBeGreaterThan(0);
    });

    it('should handle null', () => {
      const size = estimateStorageSize(null);
      expect(size).toBe(0);
    });
  });

  describe('getStorageType', () => {
    it('should return persistent for persistent storage', () => {
      expect(getStorageType(true, true)).toBe('persistent');
    });

    it('should return temporary for TTL with no persistence', () => {
      expect(getStorageType(true, false)).toBe('temporary');
    });

    it('should return durable for no TTL', () => {
      expect(getStorageType(false, false)).toBe('durable');
    });
  });

  describe('getTtlRecommendations', () => {
    it('should recommend renewal for expired entries', () => {
      const analysis = {
        contractId: 'test',
        entries: [],
        totalEntries: 0,
        expiringSoonCount: 0,
        expiredCount: 5,
        warnings: [],
        recommendations: [],
      };

      const recommendations = getTtlRecommendations(analysis);
      expect(recommendations).toContain('Immediate action required: Renew expired entries to prevent permanent data loss');
    });

    it('should recommend renewal for expiring entries', () => {
      const analysis = {
        contractId: 'test',
        entries: [],
        totalEntries: 0,
        expiringSoonCount: 3,
        expiredCount: 0,
        warnings: [],
        recommendations: [],
      };

      const recommendations = getTtlRecommendations(analysis);
      expect(recommendations).toContain('Schedule TTL renewal for expiring entries to maintain service continuity');
    });

    it('should recommend consolidation for many entries', () => {
      const analysis = {
        contractId: 'test',
        entries: [],
        totalEntries: 60,
        expiringSoonCount: 0,
        expiredCount: 0,
        warnings: [],
        recommendations: [],
      };

      const recommendations = getTtlRecommendations(analysis);
      expect(recommendations).toContain('Consider consolidating storage entries to reduce renewal overhead');
    });

    it('should always include general recommendations', () => {
      const analysis = {
        contractId: 'test',
        entries: [],
        totalEntries: 0,
        expiringSoonCount: 0,
        expiredCount: 0,
        warnings: [],
        recommendations: [],
      };

      const recommendations = getTtlRecommendations(analysis);
      expect(recommendations).toContain('Monitor storage TTL regularly to prevent unexpected expirations');
      expect(recommendations).toContain('Set up automated alerts for TTL expiration warnings');
    });
  });
});
