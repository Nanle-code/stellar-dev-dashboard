/**
 * themeTypes.ts — Theme Builder data model
 * Extends the binary light/dark system with a fully typed custom theme definition.
 */

// ─── Theme ID ──────────────────────────────────────────────────────────────────

export type ThemeId = string

// ─── Reference ─────────────────────────────────────────────────────────────────

/** Built-in theme this custom theme was derived from */
export type ThemePresetRef = 'light' | 'dark' | 'highContrast'

// ─── Colors ────────────────────────────────────────────────────────────────────

export interface ThemeColors {
  background: string
  surface: string
  primary: string
  secondary: string
  text: string
}

// ─── Typography ────────────────────────────────────────────────────────────────

export interface ThemeTypography {
  fontFamily: string
  fontScale: number
}

// ─── Spacing ───────────────────────────────────────────────────────────────────

export interface ThemeSpacing {
  baseUnit: number
}

// ─── Accessibility ─────────────────────────────────────────────────────────────

export interface ThemeAccessibility {
  score: number
  contrastPass: boolean
}

// ─── Full Definition ───────────────────────────────────────────────────────────

export interface ThemeDefinition {
  id: ThemeId
  name: string
  preset?: ThemePresetRef
  colors: ThemeColors
  typography: ThemeTypography
  spacing: ThemeSpacing
  accessibility?: ThemeAccessibility
}

// ─── Storage key ───────────────────────────────────────────────────────────────

export const CUSTOM_THEME_STORAGE_KEY = 'stellar-custom-theme'

// ─── Built-in presets ──────────────────────────────────────────────────────────

export const PRESET_THEMES: ThemeDefinition[] = [
  {
    id: 'dark',
    name: 'Dark',
    preset: 'dark',
    colors: {
      background: '#080c10',
      surface: '#0d1318',
      primary: '#00e5ff',
      secondary: '#ffb300',
      text: '#e8f4f8',
    },
    typography: {
      fontFamily: "'Syne', sans-serif",
      fontScale: 1.0,
    },
    spacing: {
      baseUnit: 8,
    },
  },
  {
    id: 'light',
    name: 'Light',
    preset: 'light',
    colors: {
      background: '#f1f5f9',
      surface: '#ffffff',
      primary: '#0284c7',
      secondary: '#ffb300',
      text: '#0f172a',
    },
    typography: {
      fontFamily: "'Syne', sans-serif",
      fontScale: 1.0,
    },
    spacing: {
      baseUnit: 8,
    },
  },
  {
    id: 'highContrast',
    name: 'High Contrast',
    preset: 'highContrast',
    colors: {
      background: '#000000',
      surface: '#1a1a1a',
      primary: '#ffff00',
      secondary: '#00ffff',
      text: '#ffffff',
    },
    typography: {
      fontFamily: "'Syne', sans-serif",
      fontScale: 1.15,
    },
    spacing: {
      baseUnit: 10,
    },
  },
]

// ─── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_THEME_DEFINITION: ThemeDefinition = PRESET_THEMES[0]

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Check if two color sets are identical */
export function colorsMatch(a: ThemeColors, b: ThemeColors): boolean {
  return a.background === b.background &&
    a.surface === b.surface &&
    a.primary === b.primary &&
    a.secondary === b.secondary &&
    a.text === b.text
}

/** Find which preset matches the given colors, or 'custom' if none */
export function getActivePresetId(colors: ThemeColors): ThemePresetRef | 'custom' {
  for (const preset of PRESET_THEMES) {
    if (colorsMatch(preset.colors, colors)) return preset.preset || preset.id as ThemePresetRef
  }
  return 'custom'
}

export function generateThemeId(): ThemeId {
  return `theme-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function isThemeDefinition(value: unknown): value is ThemeDefinition {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.colors === 'object' &&
    v.colors !== null &&
    typeof (v.colors as Record<string, unknown>).background === 'string' &&
    typeof (v.colors as Record<string, unknown>).surface === 'string' &&
    typeof (v.colors as Record<string, unknown>).primary === 'string' &&
    typeof (v.colors as Record<string, unknown>).secondary === 'string' &&
    typeof (v.colors as Record<string, unknown>).text === 'string' &&
    typeof v.typography === 'object' &&
    v.typography !== null &&
    typeof (v.typography as Record<string, unknown>).fontFamily === 'string' &&
    typeof (v.typography as Record<string, unknown>).fontScale === 'number' &&
    typeof v.spacing === 'object' &&
    v.spacing !== null &&
    typeof (v.spacing as Record<string, unknown>).baseUnit === 'number'
  )
}

export function serializeTheme(theme: ThemeDefinition): string {
  return JSON.stringify(theme, null, 2)
}

export function deserializeTheme(json: string): ThemeDefinition {
  const parsed = JSON.parse(json)
  if (!isThemeDefinition(parsed)) {
    throw new Error('Invalid theme definition')
  }
  return parsed
}

// ─── Import / Export ───────────────────────────────────────────────────────────

export interface ThemeExportMeta {
  exportedAt: string
  version: number
}

/** Wrap a theme with export metadata and serialize to JSON */
export function exportTheme(theme: ThemeDefinition): string {
  const wrapped = {
    ...theme,
    _meta: {
      exportedAt: new Date().toISOString(),
      version: 1,
    } satisfies ThemeExportMeta,
  }
  return JSON.stringify(wrapped, null, 2)
}

/** Parse exported JSON, strip metadata, validate, and return the ThemeDefinition */
export function importTheme(json: string): ThemeDefinition {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid file: not valid JSON')
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid theme: expected a JSON object')
  }
  const { _meta, ...themeData } = parsed as Record<string, unknown>
  if (!isThemeDefinition(themeData)) {
    throw new Error('Invalid theme: missing or invalid required fields')
  }
  return themeData
}

// ─── Storage key for FOUC prevention ──────────────────────────────────────────

export const THEME_VARS_STORAGE_KEY = 'stellar-theme-vars'

// ─── DOM application (CSS custom property injection) ─────────────────────────

const THEME_CSS_KEYS = [
  '--bg-base', '--bg-surface', '--bg-elevated', '--bg-card',
  '--cyan', '--amber',
  '--text-primary',
  '--font-display', '--font-scale',
  '--radius-sm', '--radius-md', '--radius-lg',
] as const

/** Extract CSS custom property map from a ThemeDefinition */
export function getThemeCSSVars(theme: ThemeDefinition): Record<string, string> {
  return {
    '--bg-base': theme.colors.background,
    '--bg-surface': theme.colors.surface,
    '--bg-elevated': theme.colors.surface,
    '--bg-card': theme.colors.surface,
    '--cyan': theme.colors.primary,
    '--amber': theme.colors.secondary,
    '--text-primary': theme.colors.text,
    '--font-display': theme.typography.fontFamily,
    '--font-scale': String(theme.typography.fontScale),
    '--radius-sm': `${Math.max(2, theme.spacing.baseUnit / 2)}px`,
    '--radius-md': `${Math.max(4, theme.spacing.baseUnit)}px`,
    '--radius-lg': `${theme.spacing.baseUnit * 2}px`,
  }
}

/** Inject a ThemeDefinition into the document as CSS custom properties */
export function applyCustomThemeToDOM(theme: ThemeDefinition): void {
  const root = document.documentElement
  if (!root) return
  const vars = getThemeCSSVars(theme)
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

/** Remove all custom theme CSS properties from the document */
export function removeCustomThemeFromDOM(): void {
  const root = document.documentElement
  if (!root) return
  for (const key of THEME_CSS_KEYS) root.style.removeProperty(key)
}

/** Persist CSS vars to localStorage for FOUC prevention on next page load */
export function saveThemeVarsToStorage(theme: ThemeDefinition): void {
  try {
    const vars = getThemeCSSVars(theme)
    localStorage.setItem(THEME_VARS_STORAGE_KEY, JSON.stringify(vars))
    localStorage.setItem('stellar-dashboard-theme', 'custom')
  } catch { /* quota exceeded or blocked */ }
}

/** Remove persisted theme vars from localStorage */
export function clearThemeVarsFromStorage(): void {
  try {
    localStorage.removeItem(THEME_VARS_STORAGE_KEY)
  } catch { /* ignore */ }
}

// ─── WCAG contrast (pure math, no DOM) ─────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function srgbChannel(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
}

export function calculateContrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground)
  const l2 = relativeLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

const CRITICAL_PAIRS: [fg: keyof ThemeColors, bg: keyof ThemeColors][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['secondary', 'background'],
  ['secondary', 'surface'],
]

export function getThemeAccessibility(theme: ThemeDefinition): ThemeAccessibility {
  const ratios = CRITICAL_PAIRS.map(([fg, bg]) =>
    calculateContrastRatio(theme.colors[fg], theme.colors[bg])
  )
  const minRatio = Math.min(...ratios)
  return {
    score: Math.round(minRatio * 10) / 10,
    contrastPass: minRatio >= 4.5,
  }
}

// ─── WCAG Levels ────────────────────────────────────────────────────────────────

export type WCAGLevel = 'fail' | 'AA-large' | 'AA' | 'AAA'

export function getWCAGLevel(ratio: number): WCAGLevel {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA-large'
  return 'fail'
}

// ─── Rich Accessibility Report ─────────────────────────────────────────────────

export interface ContrastPairResult {
  label: string
  foreground: string
  background: string
  ratio: number
  level: WCAGLevel
  pass: boolean
}

export interface AccessibilityReport {
  score: number
  pairs: ContrastPairResult[]
  pass: boolean
  warnings: string[]
}

const PAIR_LABELS: Record<string, string> = {
  'text/background': 'Body text on background',
  'text/surface': 'Body text on surface',
  'primary/background': 'Primary accent on background',
  'primary/surface': 'Primary accent on surface',
  'secondary/background': 'Secondary accent on background',
  'secondary/surface': 'Secondary accent on surface',
}

function contrastScore(minRatio: number): number {
  let score: number
  if (minRatio < 3) {
    score = (minRatio / 3) * 30
  } else if (minRatio < 4.5) {
    score = 30 + ((minRatio - 3) / 1.5) * 30
  } else if (minRatio < 7) {
    score = 60 + ((minRatio - 4.5) / 2.5) * 30
  } else {
    score = 90 + Math.min((minRatio - 7) / 14, 1) * 10
  }
  return Math.round(Math.min(100, Math.max(0, score)))
}

export function getAccessibilityReport(theme: ThemeDefinition): AccessibilityReport {
  const pairs: ContrastPairResult[] = []
  let minRatio = Infinity

  for (const [fgKey, bgKey] of CRITICAL_PAIRS) {
    const fg = theme.colors[fgKey]
    const bg = theme.colors[bgKey]
    const ratio = calculateContrastRatio(fg, bg)
    const level = getWCAGLevel(ratio)
    pairs.push({
      label: PAIR_LABELS[`${fgKey}/${bgKey}`] || `${fgKey} on ${bgKey}`,
      foreground: fg,
      background: bg,
      ratio,
      level,
      pass: level !== 'fail',
    })
    if (ratio < minRatio) minRatio = ratio
  }

  const score = contrastScore(minRatio)
  const pass = pairs.every((p) => p.pass)

  const warnings: string[] = []
  for (const p of pairs) {
    if (!p.pass) {
      warnings.push(`${p.label}: fails WCAG AA (${p.ratio.toFixed(1)}:1)`)
    } else if (p.level === 'AA-large') {
      warnings.push(`${p.label}: passes for large text only (${p.ratio.toFixed(1)}:1)`)
    }
    if (p.ratio >= 4.5 && p.ratio < 5) {
      warnings.push(`${p.label}: marginal AA pass (${p.ratio.toFixed(1)}:1)`)
    }
  }

  return { score, pairs, pass, warnings }
}

// ─── Color Blindness Simulation ────────────────────────────────────────────────

export type ColorBlindnessType = 'protanopia' | 'deuteranopia' | 'tritanopia'

const CB_MATRICES: Record<ColorBlindnessType, readonly [number, number, number][]> = {
  protanopia: [
    [0.152, 0.848, 0.000],
    [0.152, 0.848, 0.000],
    [0.004, 0.000, 0.996],
  ],
  deuteranopia: [
    [0.292, 0.708, 0.000],
    [0.292, 0.708, 0.000],
    [0.000, 0.000, 1.000],
  ],
  tritanopia: [
    [0.967, 0.000, 0.033],
    [0.000, 0.730, 0.270],
    [0.000, 0.730, 0.270],
  ],
}

export const CB_LABELS: Record<ColorBlindnessType, string> = {
  protanopia: 'Protanopia (red-blind)',
  deuteranopia: 'Deuteranopia (green-blind)',
  tritanopia: 'Tritanopia (blue-blind)',
}

function linearizeSRGB(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function delinearizeSRGB(l: number): number {
  const s = Math.max(0, Math.min(1, l))
  const c = s <= 0.0031308 ? 12.92 * s : 1.055 * Math.pow(s, 1 / 2.4) - 0.055
  return Math.round(Math.max(0, Math.min(255, c * 255)))
}

function applyCBMatrix(hex: string, matrix: readonly [number, number, number][]): string {
  const [r, g, b] = hexToRgb(hex)
  const [lr, lg, lb] = [r, g, b].map(linearizeSRGB)
  const nr = matrix[0][0] * lr + matrix[0][1] * lg + matrix[0][2] * lb
  const ng = matrix[1][0] * lr + matrix[1][1] * lg + matrix[1][2] * lb
  const nb = matrix[2][0] * lr + matrix[2][1] * lg + matrix[2][2] * lb
  const [cr, cg, cb] = [nr, ng, nb].map(delinearizeSRGB)
  return `#${cr.toString(16).padStart(2, '0')}${cg.toString(16).padStart(2, '0')}${cb.toString(16).padStart(2, '0')}`
}

export function simulateColorBlindColor(hex: string, type: ColorBlindnessType): string {
  return applyCBMatrix(hex, CB_MATRICES[type])
}

export const THEME_COLOR_KEYS: (keyof ThemeColors)[] = ['background', 'surface', 'primary', 'secondary', 'text']

export function simulateColorBlindTheme(
  theme: ThemeDefinition,
  type: ColorBlindnessType
): ThemeDefinition {
  const colors = { ...theme.colors }
  for (const key of THEME_COLOR_KEYS) {
    colors[key] = simulateColorBlindColor(colors[key], type)
  }
  return { ...theme, colors }
}

export interface ColorBlindnessResult {
  type: ColorBlindnessType
  label: string
  score: number
  pairs: ContrastPairResult[]
}

export function getColorBlindnessResults(theme: ThemeDefinition): ColorBlindnessResult[] {
  const types: ColorBlindnessType[] = ['protanopia', 'deuteranopia', 'tritanopia']
  return types.map((type) => {
    const simulated = simulateColorBlindTheme(theme, type)
    const report = getAccessibilityReport(simulated)
    return {
      type,
      label: CB_LABELS[type],
      score: report.score,
      pairs: report.pairs,
    }
  })
}
