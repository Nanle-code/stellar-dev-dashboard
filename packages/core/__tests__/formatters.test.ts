import { describe, it, expect } from 'vitest';
import {
  formatXLM,
  shortAddress,
  formatStroops,
  formatInstructions,
  formatBytes,
  formatDate,
  formatRelativeTime,
} from '../src/formatters.js';

describe('Formatters', () => {
  describe('formatXLM', () => {
    it('should format number with 2 decimal places', () => {
      expect(formatXLM(10)).toBe('10.00');
    });

    it('should format string number', () => {
      expect(formatXLM('10.5')).toBe('10.50');
    });

    it('should format with up to 7 decimal places', () => {
      expect(formatXLM(10.1234567)).toBe('10.1234567');
    });

    it('should truncate to 7 decimal places', () => {
      expect(formatXLM(10.12345678)).toBe('10.1234568');
    });

    it('should handle large numbers with commas', () => {
      expect(formatXLM(1000000)).toBe('1,000,000.00');
    });

    it('should handle zero', () => {
      expect(formatXLM(0)).toBe('0.00');
    });

    it('should handle NaN gracefully', () => {
      expect(formatXLM(NaN)).toBe('0.00');
    });
  });

  describe('shortAddress', () => {
    it('should shorten long address', () => {
      const addr = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
      expect(shortAddress(addr)).toBe('GAAAAA…AAWHF');
    });

    it('should use custom chars', () => {
      const addr = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
      expect(shortAddress(addr, 4)).toBe('GAAA…AWHF');
    });

    it('should return empty for null', () => {
      expect(shortAddress(null)).toBe('');
    });

    it('should return empty for undefined', () => {
      expect(shortAddress(undefined)).toBe('');
    });

    it('should return empty for empty string', () => {
      expect(shortAddress('')).toBe('');
    });

    it('should return full address if shorter than 2*chars', () => {
      expect(shortAddress('abc', 10)).toBe('abc');
    });
  });

  describe('formatStroops', () => {
    it('should format stroops to XLM', () => {
      expect(formatStroops(10000000)).toBe('1.0000000 XLM (10,000,000 stroops)');
    });

    it('should format number input', () => {
      expect(formatStroops(50000000)).toBe('5.0000000 XLM (50,000,000 stroops)');
    });

    it('should format string input', () => {
      expect(formatStroops('10000000')).toBe('1.0000000 XLM (10,000,000 stroops)');
    });

    it('should handle invalid input', () => {
      expect(formatStroops('invalid')).toBe('—');
    });
  });

  describe('formatInstructions', () => {
    it('should format small numbers as-is', () => {
      expect(formatInstructions(500)).toBe('500');
    });

    it('should format thousands with K', () => {
      expect(formatInstructions(1500)).toBe('1.50K');
      expect(formatInstructions(100000)).toBe('100.00K');
    });

    it('should format millions with M', () => {
      expect(formatInstructions(1500000)).toBe('1.50M');
      expect(formatInstructions(10000000)).toBe('10.00M');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes as-is', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('should format KB', () => {
      expect(formatBytes(1536)).toBe('1.50 KB');
      expect(formatBytes(1048576)).toBe('1024.00 KB');
    });

    it('should format MB', () => {
      expect(formatBytes(1572864)).toBe('1.50 MB');
    });
  });

  describe('formatDate', () => {
    it('should format valid ISO date', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      expect(result).toContain('2024');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    it('should return original string for invalid date', () => {
      expect(formatDate('invalid-date')).toBe('invalid-date');
    });
  });

  describe('formatRelativeTime', () => {
    const now = Date.now();

    it('should show "just now" for < 60 seconds', () => {
      expect(formatRelativeTime(now - 30000)).toBe('just now');
    });

    it('should show minutes for < 1 hour', () => {
      expect(formatRelativeTime(now - 300000)).toBe('5m ago');
    });

    it('should show hours for < 24 hours', () => {
      expect(formatRelativeTime(now - 7200000)).toBe('2h ago');
    });

    it('should show days for >= 24 hours', () => {
      expect(formatRelativeTime(now - 86400000 * 3)).toBe('3d ago');
    });
  });
});