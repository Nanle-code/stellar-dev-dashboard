/**
 * useColorScheme.ts — Issue #612
 *
 * React hook that wraps IntelligentColorSchemeGenerator, exposes the
 * current scheme, regeneration, and preference recording to components.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  IntelligentColorSchemeGenerator,
  type ColorScheme,
  type GenerationOptions,
  type GenerationResult,
  type UserPreference,
} from '../lib/intelligentColorScheme'

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface UseColorSchemeReturn {
  /** The currently selected/recommended scheme */
  scheme: ColorScheme
  /** All schemes from the last generation run, sorted by score */
  allSchemes: ColorScheme[]
  /** Performance timing of the last generation (ms) */
  elapsedMs: number
  /** Whether the current scheme is WCAG AA accessible */
  isAccessible: boolean
  /**
   * Regenerate schemes with (optionally new) options.
   * The recommended scheme is set immediately.
   */
  regenerate: (overrides?: GenerationOptions) => GenerationResult
  /**
   * Apply a specific scheme from allSchemes and record it as a user preference.
   */
  applyScheme: (scheme: ColorScheme) => void
  /**
   * Enforce accessibility on the current scheme (adjusts colors to meet target).
   */
  enforceAccessibility: (targetLevel?: 'AA' | 'AA-large' | 'AAA') => void
  /** Historical preference records */
  preferences: UserPreference[]
  /** Clear all learned preferences */
  clearPreferences: () => void
  /** The generation options currently in use */
  currentOptions: GenerationOptions
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useColorScheme
 *
 * @example
 * ```tsx
 * function MyChart() {
 *   const { scheme, regenerate, applyScheme, allSchemes } = useColorScheme({
 *     count: 8,
 *     dataCharacteristic: 'categorical',
 *   })
 *
 *   return (
 *     <div>
 *       <BarChart colors={scheme.colors} />
 *       <button onClick={() => regenerate()}>Suggest new palette</button>
 *       {allSchemes.slice(0, 5).map(s => (
 *         <ColorSwatch key={s.id} scheme={s} onClick={() => applyScheme(s)} />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useColorScheme(
  initialOptions: GenerationOptions = {},
): UseColorSchemeReturn {
  // Stable generator instance per hook mount
  const generatorRef = useRef<IntelligentColorSchemeGenerator | null>(null)
  if (!generatorRef.current) {
    generatorRef.current = new IntelligentColorSchemeGenerator(
      initialOptions.background,
    )
  }
  const generator = generatorRef.current

  // Track current options so callers can partially override
  const [currentOptions, setCurrentOptions] =
    useState<GenerationOptions>(initialOptions)

  // Initial generation
  const initialResult = useRef<GenerationResult | null>(null)
  if (!initialResult.current) {
    initialResult.current = generator.generate(initialOptions)
  }

  const [result, setResult] = useState<GenerationResult>(
    initialResult.current,
  )
  const [scheme, setScheme] = useState<ColorScheme>(
    result.recommended,
  )
  const [preferences, setPreferences] = useState<UserPreference[]>(
    generator.getPreferences(),
  )

  // Sync preferences from localStorage whenever the component regains focus
  useEffect(() => {
    const handleFocus = () => {
      setPreferences(generator.getPreferences())
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus)
      return () => window.removeEventListener('focus', handleFocus)
    }
  }, [generator])

  const regenerate = useCallback(
    (overrides: GenerationOptions = {}): GenerationResult => {
      const merged: GenerationOptions = { ...currentOptions, ...overrides }
      setCurrentOptions(merged)
      const newResult = generator.generate(merged)
      setResult(newResult)
      setScheme(newResult.recommended)
      return newResult
    },
    [generator, currentOptions],
  )

  const applyScheme = useCallback(
    (s: ColorScheme) => {
      setScheme(s)
      generator.recordSelection(s)
      setPreferences(generator.getPreferences())
    },
    [generator],
  )

  const enforceAccessibility = useCallback(
    (targetLevel: 'AA' | 'AA-large' | 'AAA' = 'AA') => {
      const fixed = generator.enforceAccessibility(scheme, targetLevel)
      setScheme(fixed)
    },
    [generator, scheme],
  )

  const clearPreferencesCallback = useCallback(() => {
    generator.clearPreferences()
    setPreferences([])
  }, [generator])

  return {
    scheme,
    allSchemes: result.schemes,
    elapsedMs: result.elapsedMs,
    isAccessible: scheme.isAccessible,
    regenerate,
    applyScheme,
    enforceAccessibility,
    preferences,
    clearPreferences: clearPreferencesCallback,
    currentOptions,
  }
}
