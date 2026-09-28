/**
 * intelligentColorScheme.ts — Issue #612
 *
 * AI/ML-assisted intelligent color scheme generation for data visualizations.
 *
 * Features:
 *  - Color theory–based palette generation (complementary, analogous, triadic,
 *    split-complementary, tetradic)
 *  - WCAG accessibility constraint checking reusing themeTypes.ts helpers
 *  - Preference learning via localStorage (tracks user selections to bias future
 *    recommendations)
 *  - Data-characteristic aware scheme selection (categorical, sequential,
 *    diverging)
 *  - Sub-50 ms synchronous generation (no async IO on the hot path)
 */

import {
  calculateContrastRatio,
  getWCAGLevel,
  type WCAGLevel,
} from '../styles/themeTypes'

// ─── Public types ─────────────────────────────────────────────────────────────

export type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'tetradic'
  | 'monochromatic'

export type DataCharacteristic = 'categorical' | 'sequential' | 'diverging'

export interface ColorScheme {
  /** Unique identifier for this scheme */
  id: string
  /** Human-readable name */
  name: string
  /** Ordered array of hex color strings (6-digit, #-prefixed) */
  colors: string[]
  /** Recommended background color for accessibility checks */
  background: string
  /** Color theory family used to derive this scheme */
  harmony: HarmonyType
  /** Type of data this scheme is optimised for */
  dataCharacteristic: DataCharacteristic
  /** Minimum WCAG contrast ratio achieved across all colors vs. background */
  minContrastRatio: number
  /** WCAG level of the weakest color pair */
  wcagLevel: WCAGLevel
  /** Whether every color passes WCAG AA (4.5:1) against the background */
  isAccessible: boolean
  /** Score in [0, 100] combining aesthetics and accessibility */
  score: number
}

export interface GenerationOptions {
  /** Base hue in degrees [0, 360). Defaults to pseudo-random from seed. */
  baseHue?: number
  /** Number of colors to generate. Defaults to 6. */
  count?: number
  /** Target WCAG level. Schemes below this threshold are filtered out. */
  minWCAGLevel?: WCAGLevel
  /** Background hex used for contrast calculations. Defaults to '#0d1318'. */
  background?: string
  /** Preferred harmony type(s). All types generated if omitted. */
  harmonies?: HarmonyType[]
  /** Characteristic of the data being visualised. */
  dataCharacteristic?: DataCharacteristic
  /** Arbitrary string used as a reproducible seed for hue generation. */
  seed?: string
}

export interface GenerationResult {
  /** All generated schemes, sorted by score descending */
  schemes: ColorScheme[]
  /** The single highest-scoring scheme (convenient shorthand) */
  recommended: ColorScheme
  /** Elapsed time in ms (for performance auditing) */
  elapsedMs: number
}

export interface UserPreference {
  schemeId: string
  harmony: HarmonyType
  baseHue: number
  dataCharacteristic: DataCharacteristic
  selectedAt: number
}

/** Storage key used to persist learned preferences */
export const COLOR_SCHEME_PREFERENCES_KEY = 'stellar-color-scheme-preferences'

// ─── Internal color math ──────────────────────────────────────────────────────

/** Convert HSL to a 6-digit hex string */
function hslToHex(h: number, s: number, l: number): string {
  // Normalise hue to [0,360)
  h = ((h % 360) + 360) % 360
  const hNorm = h / 360
  const sNorm = s / 100
  const lNorm = l / 100

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((hNorm * 6) % 2) - 1))
  const m = lNorm - c / 2

  let r = 0, g = 0, b = 0
  const sector = Math.floor(hNorm * 6)
  switch (sector) {
    case 0: r = c; g = x; b = 0; break
    case 1: r = x; g = c; b = 0; break
    case 2: r = 0; g = c; b = x; break
    case 3: r = 0; g = x; b = c; break
    case 4: r = x; g = 0; b = c; break
    default: r = c; g = 0; b = x; break
  }

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Parse a 6-digit hex color to [r, g, b] in [0, 255] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** Convert RGB to HSL */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rN = r / 255, gN = g / 255, bN = b / 255
  const max = Math.max(rN, gN, bN)
  const min = Math.min(rN, gN, bN)
  const l = (max + min) / 2

  if (max === min) return [0, 0, Math.round(l * 100)]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  if (max === rN) h = ((gN - bN) / d + (gN < bN ? 6 : 0)) / 6
  else if (max === gN) h = ((bN - rN) / d + 2) / 6
  else h = ((rN - gN) / d + 4) / 6

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

/** Derive hue from an arbitrary seed string */
function seedToHue(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash % 360
}

// ─── Hue angle sets per harmony type ─────────────────────────────────────────

function harmonyAngles(type: HarmonyType, base: number): number[] {
  switch (type) {
    case 'complementary':
      return [base, base + 180]
    case 'analogous':
      return [base - 30, base, base + 30]
    case 'triadic':
      return [base, base + 120, base + 240]
    case 'split-complementary':
      return [base, base + 150, base + 210]
    case 'tetradic':
      return [base, base + 90, base + 180, base + 270]
    case 'monochromatic':
      return [base, base, base, base, base, base]
  }
}

// ─── Lightness / saturation profiles per data characteristic ─────────────────

interface ColorStep {
  s: number
  l: number
}

function dataProfile(
  type: DataCharacteristic,
  index: number,
  total: number,
  harmony: HarmonyType,
): ColorStep {
  switch (type) {
    case 'sequential': {
      // Single hue family; lightness ramps from medium-light to light
      // (starts at 45 to ensure WCAG AA-large contrast on dark backgrounds)
      const t = total <= 1 ? 0 : index / (total - 1)
      return { s: 65, l: Math.round(45 + t * 35) }
    }
    case 'diverging': {
      // Lightness is highest at the ends and lowest in the middle
      const t = total <= 1 ? 0 : index / (total - 1)
      const mid = 0.5
      const dist = Math.abs(t - mid)
      return { s: 70, l: Math.round(45 + dist * 35) }
    }
    case 'categorical':
    default: {
      // Balanced saturation/lightness; varies slightly per index
      const lVariance = [55, 60, 50, 65, 55, 60]
      const sVariance = [75, 70, 80, 65, 75, 70]
      const l = lVariance[index % lVariance.length]
      const s = harmony === 'monochromatic'
        ? sVariance[index % sVariance.length]
        : 70
      return { s, l }
    }
  }
}

// ─── Contrast / accessibility helpers ────────────────────────────────────────

function wcagLevelToNumber(level: WCAGLevel): number {
  switch (level) {
    case 'AAA': return 3
    case 'AA': return 2
    case 'AA-large': return 1
    case 'fail': return 0
  }
}

function meetsMinimum(level: WCAGLevel, minimum: WCAGLevel): boolean {
  return wcagLevelToNumber(level) >= wcagLevelToNumber(minimum)
}

// ─── Score ───────────────────────────────────────────────────────────────────

/**
 * Compute a [0, 100] quality score for a scheme.
 *
 * Weights:
 *  - 40 pts: accessibility (min contrast ratio normalised to 7:1 ceiling)
 *  - 30 pts: colour variety (average angular distance between neighbouring hues)
 *  - 30 pts: saturation balance (penalty for extreme saturation values)
 */
function computeScore(
  colors: string[],
  background: string,
  harmony: HarmonyType,
  preferenceBoost: number,
): number {
  // Accessibility: min contrast among all colors vs background
  const ratios = colors.map((c) => calculateContrastRatio(c, background))
  const minRatio = Math.min(...ratios)
  const accessibilityScore = Math.min(40, (minRatio / 7) * 40)

  // Variety: average angular distance between pairs
  const hues = colors.map((c) => {
    const [r, g, b] = hexToRgb(c)
    const [h] = rgbToHsl(r, g, b)
    return h
  })
  let totalDist = 0
  for (let i = 0; i < hues.length - 1; i++) {
    const d = Math.abs(hues[i] - hues[i + 1])
    totalDist += Math.min(d, 360 - d)
  }
  const avgDist = hues.length > 1 ? totalDist / (hues.length - 1) : 0
  const varietyScore = harmony === 'monochromatic'
    ? 20 // monochromatic by design has low variety; cap at 20
    : Math.min(30, (avgDist / 120) * 30)

  // Saturation balance
  const saturations = colors.map((c) => {
    const [r, g, b] = hexToRgb(c)
    const [, s] = rgbToHsl(r, g, b)
    return s
  })
  const avgSat = saturations.reduce((a, b) => a + b, 0) / saturations.length
  const satPenalty = Math.abs(avgSat - 65) / 65 // 0 = perfect, 1 = worst
  const satScore = Math.round((1 - satPenalty) * 30)

  return Math.round(
    Math.min(100, accessibilityScore + varietyScore + satScore + preferenceBoost),
  )
}

// ─── Unique ID generation ─────────────────────────────────────────────────────

function schemeId(harmony: HarmonyType, baseHue: number, dc: DataCharacteristic): string {
  return `scheme-${harmony}-${baseHue}-${dc}`
}

// ─── Core generator ───────────────────────────────────────────────────────────

/**
 * Generate one ColorScheme for the given harmony type, base hue, and data
 * characteristic. Returns null if no color in the scheme meets minWCAGLevel.
 */
function generateScheme(
  harmony: HarmonyType,
  baseHue: number,
  count: number,
  background: string,
  dataCharacteristic: DataCharacteristic,
  minWCAGLevel: WCAGLevel,
  preferenceBoost: number,
): ColorScheme | null {
  const angles = harmonyAngles(harmony, baseHue)

  const colors: string[] = []
  for (let i = 0; i < count; i++) {
    const hue = angles[i % angles.length]
    const { s, l } = dataProfile(dataCharacteristic, i, count, harmony)
    colors.push(hslToHex(hue, s, l))
  }

  // Accessibility check
  const ratios = colors.map((c) => calculateContrastRatio(c, background))
  const minRatio = Math.min(...ratios)
  const wcagLevel = getWCAGLevel(minRatio)

  if (!meetsMinimum(wcagLevel, minWCAGLevel)) return null

  const score = computeScore(colors, background, harmony, preferenceBoost)

  const harmonyLabels: Record<HarmonyType, string> = {
    complementary: 'Complementary',
    analogous: 'Analogous',
    triadic: 'Triadic',
    'split-complementary': 'Split-Complementary',
    tetradic: 'Tetradic',
    monochromatic: 'Monochromatic',
  }

  return {
    id: schemeId(harmony, baseHue, dataCharacteristic),
    name: `${harmonyLabels[harmony]} (${baseHue}°)`,
    colors,
    background,
    harmony,
    dataCharacteristic,
    minContrastRatio: Math.round(minRatio * 10) / 10,
    wcagLevel,
    isAccessible: minRatio >= 4.5,
    score,
  }
}

// ─── Preference learning ──────────────────────────────────────────────────────

/**
 * Load stored color-scheme preferences from localStorage.
 * Returns an empty array if nothing is stored or parsing fails.
 */
export function loadPreferences(): UserPreference[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(COLOR_SCHEME_PREFERENCES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as UserPreference[]
  } catch {
    return []
  }
}

/**
 * Persist a new preference record (max 50 entries; oldest are dropped).
 */
export function savePreference(pref: UserPreference): void {
  try {
    if (typeof localStorage === 'undefined') return
    const existing = loadPreferences()
    const updated = [pref, ...existing].slice(0, 50)
    localStorage.setItem(COLOR_SCHEME_PREFERENCES_KEY, JSON.stringify(updated))
  } catch {
    /* quota exceeded or blocked — fail silently */
  }
}

/**
 * Record that the user selected a particular scheme.
 * Call this whenever the user applies a scheme to their chart/theme.
 */
export function recordSchemeSelection(scheme: ColorScheme): void {
  savePreference({
    schemeId: scheme.id,
    harmony: scheme.harmony,
    baseHue: Math.round(scheme.colors.length > 0
      ? (() => {
          const [r, g, b] = hexToRgb(scheme.colors[0])
          const [h] = rgbToHsl(r, g, b)
          return h
        })()
      : 0),
    dataCharacteristic: scheme.dataCharacteristic,
    selectedAt: Date.now(),
  })
}

/**
 * Derive a "preference boost" score in [0, 10] for a given harmony/hue
 * combination based on historical selections. Schemes similar to previously
 * liked schemes receive a higher boost.
 */
function computePreferenceBoost(
  harmony: HarmonyType,
  baseHue: number,
  dataCharacteristic: DataCharacteristic,
  prefs: UserPreference[],
): number {
  if (prefs.length === 0) return 0

  // Recency-weighted tally
  const now = Date.now()
  let totalWeight = 0
  let matchWeight = 0

  prefs.forEach((p, idx) => {
    // Exponential decay: most recent pref has full weight
    const age = (now - p.selectedAt) / (1000 * 60 * 60 * 24) // days
    const weight = Math.exp(-age / 30) * (1 / (idx + 1))
    totalWeight += weight

    const harmonyMatch = p.harmony === harmony ? 1 : 0
    const hueDist = Math.min(
      Math.abs(p.baseHue - baseHue),
      360 - Math.abs(p.baseHue - baseHue),
    )
    const hueMatch = Math.max(0, 1 - hueDist / 90) // full match within 90°
    const dcMatch = p.dataCharacteristic === dataCharacteristic ? 0.5 : 0

    matchWeight += weight * (harmonyMatch * 0.5 + hueMatch * 0.3 + dcMatch * 0.2)
  })

  if (totalWeight === 0) return 0
  return Math.round((matchWeight / totalWeight) * 10)
}

/**
 * Clear all stored preferences (useful for testing or user reset).
 */
export function clearPreferences(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(COLOR_SCHEME_PREFERENCES_KEY)
    }
  } catch {
    /* ignore */
  }
}

// ─── Main generator class ─────────────────────────────────────────────────────

/**
 * IntelligentColorSchemeGenerator
 *
 * Generates accessible, aesthetically-pleasing color palettes for data
 * visualizations using color theory and learned user preferences.
 *
 * @example
 * ```ts
 * const gen = new IntelligentColorSchemeGenerator()
 * const result = gen.generate({ count: 8, dataCharacteristic: 'categorical' })
 * console.log(result.recommended.colors) // ['#00e5ff', '#ff6600', …]
 *
 * // Record user choice to bias future recommendations
 * gen.recordSelection(result.recommended)
 * ```
 */
export class IntelligentColorSchemeGenerator {
  private readonly defaultBackground: string

  constructor(defaultBackground = '#0d1318') {
    this.defaultBackground = defaultBackground
  }

  /**
   * Generate a set of color schemes and return the best-matching one plus all
   * candidates sorted by score.
   *
   * This method is synchronous and consistently completes in < 50 ms.
   */
  generate(options: GenerationOptions = {}): GenerationResult {
    const t0 = performance.now()

    const {
      count = 6,
      minWCAGLevel = 'AA-large',
      background = this.defaultBackground,
      dataCharacteristic = 'categorical',
      seed,
    } = options

    // Determine base hue
    let baseHue: number
    if (options.baseHue !== undefined) {
      baseHue = ((options.baseHue % 360) + 360) % 360
    } else if (seed !== undefined) {
      baseHue = seedToHue(seed)
    } else {
      // Pseudo-random from current timestamp — still deterministic within a ms
      baseHue = Math.floor(Date.now() % 360)
    }

    const harmonies: HarmonyType[] = options.harmonies ?? [
      'complementary',
      'analogous',
      'triadic',
      'split-complementary',
      'tetradic',
      'monochromatic',
    ]

    // Load preferences once
    const prefs = loadPreferences()

    const schemes: ColorScheme[] = []

    for (const harmony of harmonies) {
      // Also try ±30° offset variants to increase diversity
      for (const hueOffset of [0, 30, -30]) {
        const hue = ((baseHue + hueOffset) % 360 + 360) % 360
        const boost = computePreferenceBoost(harmony, hue, dataCharacteristic, prefs)
        const scheme = generateScheme(
          harmony,
          hue,
          count,
          background,
          dataCharacteristic,
          minWCAGLevel,
          boost,
        )
        if (scheme) schemes.push(scheme)
      }
    }

    // Sort descending by score
    schemes.sort((a, b) => b.score - a.score)

    // Fallback: if all were filtered out by WCAG level, relax to AA-large
    if (schemes.length === 0) {
      for (const harmony of harmonies) {
        const scheme = generateScheme(
          harmony,
          baseHue,
          count,
          background,
          dataCharacteristic,
          'AA-large',
          0,
        )
        if (scheme) schemes.push(scheme)
      }
      schemes.sort((a, b) => b.score - a.score)
    }

    const elapsedMs = Math.round((performance.now() - t0) * 100) / 100

    const recommended = schemes[0] ?? this._emergencyFallback(count, background, dataCharacteristic)

    return { schemes, recommended, elapsedMs }
  }

  /**
   * Record that the user selected a scheme so future recommendations are biased
   * towards similar harmonies/hues.
   */
  recordSelection(scheme: ColorScheme): void {
    recordSchemeSelection(scheme)
  }

  /**
   * Return the user's preference history.
   */
  getPreferences(): UserPreference[] {
    return loadPreferences()
  }

  /**
   * Clear stored preferences.
   */
  clearPreferences(): void {
    clearPreferences()
  }

  /**
   * Generate a color scheme with properties similar to the existing CHART_COLORS
   * object in chartUtils.js. Useful for drop-in integration.
   */
  generateChartColors(options: GenerationOptions = {}): Record<string, string> {
    const result = this.generate({ count: 8, ...options })
    const [c0, c1, c2, c3, c4, c5, c6, c7] = result.recommended.colors
    return {
      primary: c0,
      secondary: c1,
      tertiary: c2,
      quaternary: c3,
      quinary: c4,
      senary: c5,
      septenary: c6 ?? c0,
      octonary: c7 ?? c1,
    }
  }

  /**
   * Apply an accessibility adjustment to a color scheme: any color that fails
   * the minimum contrast ratio against the background is darkened or lightened
   * until it passes.
   *
   * Returns a new scheme object (does not mutate the original).
   */
  enforceAccessibility(
    scheme: ColorScheme,
    targetLevel: WCAGLevel = 'AA',
  ): ColorScheme {
    const targetRatio = targetLevel === 'AAA' ? 7 : targetLevel === 'AA' ? 4.5 : 3

    const adjusted = scheme.colors.map((color) => {
      let ratio = calculateContrastRatio(color, scheme.background)
      if (ratio >= targetRatio) return color

      // Try adjusting lightness in steps until target is met or we give up
      const [r, g, b] = hexToRgb(color)
      let [h, s, l] = rgbToHsl(r, g, b)
      const [br, bg, bb] = hexToRgb(scheme.background)
      const [, , bgL] = rgbToHsl(br, bg, bb)

      // Move lightness away from background lightness
      const direction = l > bgL ? 1 : -1
      for (let step = 0; step <= 20; step++) {
        const candidate = hslToHex(h, s, l + direction * step * 3)
        const newRatio = calculateContrastRatio(candidate, scheme.background)
        if (newRatio >= targetRatio) return candidate
      }

      // Last resort: pure white or black
      return direction === 1 ? '#ffffff' : '#000000'
    })

    const ratios = adjusted.map((c) => calculateContrastRatio(c, scheme.background))
    const minRatio = Math.min(...ratios)
    const wcagLevel = getWCAGLevel(minRatio)

    return {
      ...scheme,
      id: `${scheme.id}-a11y`,
      colors: adjusted,
      minContrastRatio: Math.round(minRatio * 10) / 10,
      wcagLevel,
      isAccessible: minRatio >= 4.5,
      score: computeScore(adjusted, scheme.background, scheme.harmony, 0),
    }
  }

  /** Emergency fallback producing a minimal valid scheme */
  private _emergencyFallback(
    count: number,
    background: string,
    dataCharacteristic: DataCharacteristic = 'categorical',
    harmony: HarmonyType = 'complementary',
  ): ColorScheme {
    const palette = ['#00e5ff', '#ffb300', '#00e676', '#ff1744', '#7c4dff', '#ff6d00', '#00bcd4', '#f06292']
    const colors = Array.from({ length: count }, (_, i) => palette[i % palette.length])
    const ratios = colors.map((c) => calculateContrastRatio(c, background))
    const minRatio = Math.min(...ratios)
    return {
      id: 'scheme-fallback',
      name: 'Default',
      colors,
      background,
      harmony,
      dataCharacteristic,
      minContrastRatio: Math.round(minRatio * 10) / 10,
      wcagLevel: getWCAGLevel(minRatio),
      isAccessible: minRatio >= 4.5,
      score: 50,
    }
  }
}

// ─── Singleton convenience ────────────────────────────────────────────────────

/** Default generator instance — can be imported and used directly. */
export const intelligentColorScheme = new IntelligentColorSchemeGenerator()
