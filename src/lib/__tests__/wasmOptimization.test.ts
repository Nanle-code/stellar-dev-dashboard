/**
 * Tests for WASM Size Analysis and Optimization Tips
 * #852 - Add Wasm size and optimization tips in upload flow
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeWasmSize,
  formatSize,
  getSeverityColor,
  getSeverityIcon,
  MAX_WASM_BYTES,
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
} from '../wasmOptimization';

describe('WASM Size Analysis', () => {
  describe('analyzeWasmSize', () => {
    it('should return safe status for small files', () => {
      const analysis = analyzeWasmSize(1024 * 1024); // 1 MB
      expect(analysis.severity).toBe('safe');
      expect(analysis.warnings).toHaveLength(0);
      expect(analysis.sizeMb).toBe(1);
    });

    it('should return warning at threshold', () => {
      const thresholdBytes = MAX_WASM_BYTES * WARNING_THRESHOLD;
      const analysis = analyzeWasmSize(thresholdBytes);
      expect(analysis.severity).toBe('warning');
      expect(analysis.warnings.length).toBeGreaterThan(0);
    });

    it('should return critical near limit', () => {
      const criticalBytes = MAX_WASM_BYTES * CRITICAL_THRESHOLD;
      const analysis = analyzeWasmSize(criticalBytes);
      expect(analysis.severity).toBe('critical');
      expect(analysis.warnings.length).toBeGreaterThan(0);
    });

    it('should return exceeded when over limit', () => {
      const overLimit = MAX_WASM_BYTES + 1;
      const analysis = analyzeWasmSize(overLimit);
      expect(analysis.severity).toBe('exceeded');
      expect(analysis.warnings).toContain(
        `WASM file exceeds network limit of ${MAX_WASM_BYTES / (1024 * 1024)} MB`
      );
    });

    it('should provide optimization tips', () => {
      const analysis = analyzeWasmSize(5 * 1024 * 1024); // 5 MB
      expect(analysis.optimizationTips.length).toBeGreaterThan(0);
      expect(analysis.optimizationTips[0]).toHaveProperty('title');
      expect(analysis.optimizationTips[0]).toHaveProperty('description');
      expect(analysis.optimizationTips[0]).toHaveProperty('impact');
    });

    it('should include size-specific tips for large files', () => {
      const analysis = analyzeWasmSize(15 * 1024 * 1024); // 15 MB
      const hasSplittingTip = analysis.optimizationTips.some(
        (tip) => tip.title === 'Consider Contract Splitting'
      );
      expect(hasSplittingTip).toBe(true);
    });

    it('should calculate percentage correctly', () => {
      const analysis = analyzeWasmSize(MAX_WASM_BYTES / 2);
      expect(analysis.percentageOfLimit).toBe(50);
    });

    it('should warn about large files', () => {
      const analysis = analyzeWasmSize(6 * 1024 * 1024); // 6 MB
      expect(analysis.warnings).toContain('Large WASM files may have higher deployment costs and slower load times.');
    });

    it('should warn about very large files', () => {
      const analysis = analyzeWasmSize(11 * 1024 * 1024); // 11 MB
      expect(analysis.warnings).toContain(
        'Very large WASM files may approach transaction size limits on some networks.'
      );
    });
  });

  describe('formatSize', () => {
    it('should format bytes correctly', () => {
      expect(formatSize(500)).toBe('500 B');
      expect(formatSize(1024)).toBe('1.00 KB');
      expect(formatSize(1536)).toBe('1.50 KB');
      expect(formatSize(1024 * 1024)).toBe('1.00 MB');
      expect(formatSize(2.5 * 1024 * 1024)).toBe('2.50 MB');
    });
  });

  describe('getSeverityColor', () => {
    it('should return correct colors', () => {
      expect(getSeverityColor('safe')).toBe('#22c55e');
      expect(getSeverityColor('warning')).toBe('#f59e0b');
      expect(getSeverityColor('critical')).toBe('#ef4444');
      expect(getSeverityColor('exceeded')).toBe('#dc2626');
    });
  });

  describe('getSeverityIcon', () => {
    it('should return correct icons', () => {
      expect(getSeverityIcon('safe')).toBe('✓');
      expect(getSeverityIcon('warning')).toBe('⚠');
      expect(getSeverityIcon('critical')).toBe('🔴');
      expect(getSeverityIcon('exceeded')).toBe('🚫');
    });
  });

  describe('Optimization Tips Structure', () => {
    it('should include general tips', () => {
      const analysis = analyzeWasmSize(1024);
      const hasGeneralTips = analysis.optimizationTips.some((tip) => tip.category === 'general');
      expect(hasGeneralTips).toBe(true);
    });

    it('should include Rust-specific tips', () => {
      const analysis = analyzeWasmSize(1024);
      const hasRustTips = analysis.optimizationTips.some((tip) => tip.category === 'rust');
      expect(hasRustTips).toBe(true);
    });

    it('should include AssemblyScript tips', () => {
      const analysis = analyzeWasmSize(1024);
      const hasAsTips = analysis.optimizationTips.some((tip) => tip.category === 'assemblyscript');
      expect(hasAsTips).toBe(true);
    });

    it('should include C++ tips', () => {
      const analysis = analyzeWasmSize(1024);
      const hasCppTips = analysis.optimizationTips.some((tip) => tip.category === 'c++');
      expect(hasCppTips).toBe(true);
    });

    it('should include build tips', () => {
      const analysis = analyzeWasmSize(1024);
      const hasBuildTips = analysis.optimizationTips.some((tip) => tip.category === 'build');
      expect(hasBuildTips).toBe(true);
    });

    it('should have valid impact levels', () => {
      const analysis = analyzeWasmSize(1024);
      const validImpacts = ['high', 'medium', 'low'];
      analysis.optimizationTips.forEach((tip) => {
        expect(validImpacts).toContain(tip.impact);
      });
    });
  });
});
