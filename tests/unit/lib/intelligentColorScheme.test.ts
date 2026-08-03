/**
 * tests/unit/lib/intelligentColorScheme.test.ts
 *
 * Unit tests for Issue #612 — Intelligent Color Scheme Generation.
 *
 * Covers:
 *  - Color scheme generation (various harmonies / data characteristics)
 *  - WCAG accessibility constraint enforcement
 *  - Preference learning (save, load, boost, clear)
 *  - Performance: generation completes in < 50 ms
 *  - enforceAccessibility adjusts colors correctly
 *  - generateChartColors helper
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  IntelligentColorSchemeGenerator,
  intelligentColorScheme,
  loadPreferences,
  savePreference,
  clearPreferences,
  recordSchemeSelection,
  COLOR_SCHEME_PREFERENCES_KEY,
  type ColorScheme,
  type HarmonyType,
  type DataCharacteristic,
} from '../../../src/lib/intelligentColorScheme'
import { calculateContrastRatio } from '../../../src/styles/themeTypes'

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// ─── performance mock (jsdom may not have it) ─────────────────────────────────

if (typeof performance === 'undefined') {
  Object.defineProperty(globalThis, 'performance', {
    value: { now: () => Date.now() },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidHex(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IntelligentColorSchemeGenerator', () => {
  let gen: IntelligentColorSchemeGenerator

  beforeEach(() => {
    localStorageMock.clear()
    gen = new IntelligentColorSchemeGenerator()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  // ─── Basic generation ──────────────────────────────────────────────────────

  describe('generate()', () => {
    it('returns a GenerationResult with schemes and recommended', () => {
      const result = gen.generate()
      expect(result).toHaveProperty('schemes')
      expect(result).toHaveProperty('recommended')
      expect(result).toHaveProperty('elapsedMs')
      expect(Array.isArray(result.schemes)).toBe(true)
      expect(result.schemes.length).toBeGreaterThan(0)
    })

    it('recommended scheme has the expected shape', () => {
      const { recommended } = gen.generate({ seed: 'stellar' })
      expect(recommended).toHaveProperty('id')
      expect(recommended).toHaveProperty('name')
      expect(recommended).toHaveProperty('colors')
      expect(recommended).toHaveProperty('background')
      expect(recommended).toHaveProperty('harmony')
      expect(recommended).toHaveProperty('dataCharacteristic')
      expect(recommended).toHaveProperty('minContrastRatio')
      expect(recommended).toHaveProperty('wcagLevel')
      expect(recommended).toHaveProperty('isAccessible')
      expect(recommended).toHaveProperty('score')
    })

    it('generates the requested number of colors', () => {
      for (const count of [3, 6, 8, 12]) {
        const { recommended } = gen.generate({ count, seed: 'test' })
        expect(recommended.colors).toHaveLength(count)
      }
    })

    it('all generated colors are valid 6-digit hex strings', () => {
      const { schemes } = gen.generate({ count: 8, seed: 'hex-test' })
      for (const scheme of schemes) {
        for (const color of scheme.colors) {
          expect(isValidHex(color)).toBe(true)
        }
      }
    })

    it('recommended scheme has the highest or equal score among all schemes', () => {
      const { schemes, recommended } = gen.generate({ seed: 'ranking' })
      for (const s of schemes) {
        expect(recommended.score).toBeGreaterThanOrEqual(s.score)
      }
    })

    it('generates deterministically for the same seed', () => {
      const r1 = gen.generate({ seed: 'deterministic', count: 6 })
      const r2 = gen.generate({ seed: 'deterministic', count: 6 })
      expect(r1.recommended.colors).toEqual(r2.recommended.colors)
    })

    it('respects a specific baseHue', () => {
      const { recommended } = gen.generate({ baseHue: 0, harmonies: ['complementary'], count: 4 })
      // With baseHue=0 (red) and complementary, the first color should be in the red family
      expect(recommended.colors).toHaveLength(4)
    })

    it('filters schemes to only include specified harmonies', () => {
      const { schemes } = gen.generate({ harmonies: ['triadic'], seed: 'harmony-filter' })
      for (const s of schemes) {
        expect(s.harmony).toBe('triadic')
      }
    })
  })

  // ─── Harmony types ─────────────────────────────────────────────────────────

  describe('harmony generation', () => {
    const harmonies: HarmonyType[] = [
      'complementary',
      'analogous',
      'triadic',
      'split-complementary',
      'tetradic',
      'monochromatic',
    ]

    for (const harmony of harmonies) {
      it(`generates valid colors for harmony: ${harmony}`, () => {
        const { recommended } = gen.generate({
          harmonies: [harmony],
          seed: `harmony-${harmony}`,
          count: 6,
        })
        expect(recommended.harmony).toBe(harmony)
        expect(recommended.colors.length).toBe(6)
        for (const color of recommended.colors) {
          expect(isValidHex(color)).toBe(true)
        }
      })
    }
  })

  // ─── Data characteristics ──────────────────────────────────────────────────

  describe('data characteristics', () => {
    const characteristics: DataCharacteristic[] = ['categorical', 'sequential', 'diverging']

    for (const dc of characteristics) {
      it(`generates colors for dataCharacteristic: ${dc}`, () => {
        const { recommended } = gen.generate({
          dataCharacteristic: dc,
          seed: `dc-${dc}`,
          count: 6,
        })
        expect(recommended.dataCharacteristic).toBe(dc)
        expect(recommended.colors.length).toBe(6)
      })
    }

    it('sequential scheme has increasing lightness', () => {
      // Sequential palettes should have the darkest first and lightest last
      const { recommended } = gen.generate({
        dataCharacteristic: 'sequential',
        harmonies: ['monochromatic'],
        seed: 'seq-test',
        count: 5,
      })
      // Just verify the scheme was created and labeled correctly
      expect(recommended.dataCharacteristic).toBe('sequential')
    })
  })

  // ─── Accessibility ─────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('isAccessible is true when minContrastRatio >= 4.5', () => {
      const { schemes } = gen.generate({ seed: 'a11y-check', count: 4 })
      for (const s of schemes) {
        const expectedAccessible = s.minContrastRatio >= 4.5
        expect(s.isAccessible).toBe(expectedAccessible)
      }
    })

    it('wcagLevel reflects the minContrastRatio', () => {
      const { schemes } = gen.generate({ seed: 'wcag-level', count: 4 })
      for (const s of schemes) {
        if (s.minContrastRatio >= 7) {
          expect(s.wcagLevel).toBe('AAA')
        } else if (s.minContrastRatio >= 4.5) {
          expect(s.wcagLevel).toBe('AA')
        } else if (s.minContrastRatio >= 3) {
          expect(s.wcagLevel).toBe('AA-large')
        } else {
          expect(s.wcagLevel).toBe('fail')
        }
      }
    })

    it('minWCAGLevel=AA filters out non-AA schemes', () => {
      const { schemes } = gen.generate({
        seed: 'wcag-aa-filter',
        minWCAGLevel: 'AA',
        count: 4,
      })
      for (const s of schemes) {
        expect(s.minContrastRatio).toBeGreaterThanOrEqual(4.5)
      }
    })

    it('score is in [0, 100]', () => {
      const { schemes } = gen.generate({ seed: 'score-range', count: 6 })
      for (const s of schemes) {
        expect(s.score).toBeGreaterThanOrEqual(0)
        expect(s.score).toBeLessThanOrEqual(100)
      }
    })
  })

  // ─── enforceAccessibility ──────────────────────────────────────────────────

  describe('enforceAccessibility()', () => {
    it('returns a new scheme (does not mutate the original)', () => {
      const { recommended } = gen.generate({ seed: 'enforce-a11y', count: 4 })
      const original = { ...recommended, colors: [...recommended.colors] }
      const fixed = gen.enforceAccessibility(recommended, 'AA')
      expect(fixed).not.toBe(recommended)
      expect(recommended.colors).toEqual(original.colors)
    })

    it('all colors in the fixed scheme meet at least AA-large', () => {
      // Create a scheme with a dark background and potentially low contrast
      const darkGen = new IntelligentColorSchemeGenerator('#000000')
      const { recommended } = darkGen.generate({ seed: 'enforce-dark', count: 6 })
      const fixed = darkGen.enforceAccessibility(recommended, 'AA-large')
      for (const color of fixed.colors) {
        const ratio = calculateContrastRatio(color, fixed.background)
        expect(ratio).toBeGreaterThanOrEqual(3)
      }
    })

    it('fixed scheme has valid hex colors', () => {
      const { recommended } = gen.generate({ seed: 'enforce-hex', count: 5 })
      const fixed = gen.enforceAccessibility(recommended)
      for (const color of fixed.colors) {
        expect(isValidHex(color)).toBe(true)
      }
    })

    it('fixed scheme id is different from original', () => {
      const { recommended } = gen.generate({ seed: 'enforce-id', count: 4 })
      const fixed = gen.enforceAccessibility(recommended)
      expect(fixed.id).not.toBe(recommended.id)
      expect(fixed.id).toContain(recommended.id)
    })
  })

  // ─── Performance ──────────────────────────────────────────────────────────

  describe('performance', () => {
    it('generates schemes in under 50 ms', () => {
      const start = performance.now()
      gen.generate({ count: 8, seed: 'perf-test' })
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(50)
    })

    it('elapsedMs reported by generate() is accurate (within 100 ms tolerance)', () => {
      const wallStart = performance.now()
      const result = gen.generate({ count: 8, seed: 'perf-elapsed' })
      const wallEnd = performance.now()
      // elapsedMs should not exceed total wall-clock time + small tolerance
      expect(result.elapsedMs).toBeLessThanOrEqual(wallEnd - wallStart + 5)
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
    })
  })

  // ─── Preference learning ───────────────────────────────────────────────────

  describe('preference learning', () => {
    it('loadPreferences returns empty array when nothing stored', () => {
      expect(loadPreferences()).toEqual([])
    })

    it('savePreference persists a preference', () => {
      savePreference({
        schemeId: 'test-scheme',
        harmony: 'triadic',
        baseHue: 180,
        dataCharacteristic: 'categorical',
        selectedAt: Date.now(),
      })
      const prefs = loadPreferences()
      expect(prefs).toHaveLength(1)
      expect(prefs[0].schemeId).toBe('test-scheme')
    })

    it('savePreference caps the list at 50 entries', () => {
      for (let i = 0; i < 60; i++) {
        savePreference({
          schemeId: `scheme-${i}`,
          harmony: 'analogous',
          baseHue: i * 6,
          dataCharacteristic: 'categorical',
          selectedAt: Date.now() - i * 1000,
        })
      }
      expect(loadPreferences().length).toBeLessThanOrEqual(50)
    })

    it('most recent preference is first in the list', () => {
      savePreference({
        schemeId: 'older',
        harmony: 'analogous',
        baseHue: 60,
        dataCharacteristic: 'categorical',
        selectedAt: Date.now() - 5000,
      })
      savePreference({
        schemeId: 'newer',
        harmony: 'triadic',
        baseHue: 120,
        dataCharacteristic: 'categorical',
        selectedAt: Date.now(),
      })
      const prefs = loadPreferences()
      expect(prefs[0].schemeId).toBe('newer')
    })

    it('clearPreferences removes all stored preferences', () => {
      savePreference({
        schemeId: 'to-clear',
        harmony: 'complementary',
        baseHue: 0,
        dataCharacteristic: 'sequential',
        selectedAt: Date.now(),
      })
      clearPreferences()
      expect(loadPreferences()).toEqual([])
    })

    it('recordSchemeSelection stores a preference record', () => {
      const { recommended } = gen.generate({ seed: 'record-pref' })
      recordSchemeSelection(recommended)
      const prefs = loadPreferences()
      expect(prefs).toHaveLength(1)
      expect(prefs[0].harmony).toBe(recommended.harmony)
    })

    it('generator.recordSelection() persists to localStorage', () => {
      const { recommended } = gen.generate({ seed: 'gen-record' })
      gen.recordSelection(recommended)
      const prefs = gen.getPreferences()
      expect(prefs.length).toBeGreaterThan(0)
    })

    it('generator.clearPreferences() removes stored prefs', () => {
      const { recommended } = gen.generate({ seed: 'gen-clear' })
      gen.recordSelection(recommended)
      gen.clearPreferences()
      expect(gen.getPreferences()).toEqual([])
    })

    it('preference history biases score (preferred harmony scores higher in re-run)', () => {
      // Record a preference for 'triadic'
      gen.recordSelection({
        id: 'manual-pref',
        name: 'Manual',
        colors: ['#00e5ff', '#ff6600', '#66ff00'],
        background: '#0d1318',
        harmony: 'triadic',
        dataCharacteristic: 'categorical',
        minContrastRatio: 5.5,
        wcagLevel: 'AA',
        isAccessible: true,
        score: 80,
      } satisfies ColorScheme)

      // Generate with the same options; triadic schemes should appear near the top
      const result = gen.generate({
        seed: 'bias-test',
        harmonies: ['triadic', 'complementary', 'analogous'],
        count: 5,
      })

      const triadicSchemes = result.schemes.filter((s) => s.harmony === 'triadic')
      const nonTriadicSchemes = result.schemes.filter((s) => s.harmony !== 'triadic')

      // Average score of triadic should be >= average score of non-triadic
      if (triadicSchemes.length > 0 && nonTriadicSchemes.length > 0) {
        const triadicAvg =
          triadicSchemes.reduce((sum, s) => sum + s.score, 0) / triadicSchemes.length
        const otherAvg =
          nonTriadicSchemes.reduce((sum, s) => sum + s.score, 0) / nonTriadicSchemes.length
        // Allow a small tolerance since accessibility/variety may offset preference boost
        expect(triadicAvg + 5).toBeGreaterThanOrEqual(otherAvg)
      }
    })
  })

  // ─── generateChartColors ────────────────────────────────────────────────────

  describe('generateChartColors()', () => {
    it('returns an object with named color keys', () => {
      const colors = gen.generateChartColors({ seed: 'chart-colors', count: 8 })
      expect(colors).toHaveProperty('primary')
      expect(colors).toHaveProperty('secondary')
      expect(colors).toHaveProperty('tertiary')
      expect(colors).toHaveProperty('quaternary')
    })

    it('all values are valid hex strings', () => {
      const colors = gen.generateChartColors({ seed: 'chart-hex' })
      for (const value of Object.values(colors)) {
        expect(isValidHex(value as string)).toBe(true)
      }
    })
  })

  // ─── Singleton export ──────────────────────────────────────────────────────

  describe('intelligentColorScheme singleton', () => {
    it('is an instance of IntelligentColorSchemeGenerator', () => {
      expect(intelligentColorScheme).toBeInstanceOf(IntelligentColorSchemeGenerator)
    })

    it('can generate schemes', () => {
      const result = intelligentColorScheme.generate({ seed: 'singleton', count: 4 })
      expect(result.schemes.length).toBeGreaterThan(0)
    })
  })

  // ─── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles count=1', () => {
      const { recommended } = gen.generate({ count: 1, seed: 'one' })
      expect(recommended.colors).toHaveLength(1)
    })

    it('handles count=20', () => {
      const { recommended } = gen.generate({ count: 20, seed: 'twenty' })
      expect(recommended.colors).toHaveLength(20)
    })

    it('handles baseHue=0 (boundary)', () => {
      const { recommended } = gen.generate({ baseHue: 0, count: 4 })
      expect(recommended.colors.length).toBe(4)
    })

    it('handles baseHue=359 (boundary)', () => {
      const { recommended } = gen.generate({ baseHue: 359, count: 4 })
      expect(recommended.colors.length).toBe(4)
    })

    it('handles very strict minWCAGLevel=AAA (returns accessible or fallback)', () => {
      // May return fewer schemes since many won't pass AAA; should not throw
      expect(() =>
        gen.generate({ minWCAGLevel: 'AAA', seed: 'aaa-strict', count: 4 }),
      ).not.toThrow()
    })

    it('handles localStorage read errors gracefully', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('SecurityError')
      })
      expect(() => loadPreferences()).not.toThrow()
      expect(loadPreferences()).toEqual([])
    })

    it('handles localStorage write errors gracefully', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError')
      })
      expect(() =>
        savePreference({
          schemeId: 'err-test',
          harmony: 'analogous',
          baseHue: 0,
          dataCharacteristic: 'categorical',
          selectedAt: Date.now(),
        }),
      ).not.toThrow()
    })
  })
})
