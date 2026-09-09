/**
 * useErrorRecoveryGuidance.ts
 *
 * React hook that bridges the ErrorRecoveryEngine to React components.
 * Provides error analysis, solution recommendations, and resolution tracking.
 *
 * Usage:
 *   const { guidance, analyzeError, recordSuccess, recordFailure, expertiseLevel, setExpertise } = useErrorRecoveryGuidance()
 *
 *   // When an error occurs:
 *   const guidance = analyzeError(error)
 *   // Show the guidance in UI
 *   // When user resolves the issue:
 *   recordSuccess(guidance.solutions[0].solution.id, guidance.classification.errorMessage)
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  analyzeError as analyzeErrorEngine,
  recordResolution,
  getExpertiseLevel,
  setExpertiseLevel,
  getRecoveryStats,
  type RecoveryGuidance,
  type ExpertiseLevel,
  type ResolutionFeedback,
} from '../lib/errorHandling/ErrorRecoveryEngine'

export interface ErrorRecoveryGuidanceResult {
  /** Current recovery guidance (if an error has been analyzed) */
  guidance: RecoveryGuidance | null
  /** Current user expertise level */
  expertiseLevel: ExpertiseLevel
  /** Analyze an error and generate guidance */
  analyzeError: (error: unknown, context?: string) => RecoveryGuidance
  /** Clear the current guidance */
  clearGuidance: () => void
  /** Record a successful resolution */
  recordSuccess: (solutionId: string, errorSignature: string, context?: string) => void
  /** Record a failed resolution */
  recordFailure: (solutionId: string, errorSignature: string, context?: string) => void
  /** Set the user's expertise level */
  setExpertise: (level: ExpertiseLevel) => void
  /** Recovery statistics (success rate, etc.) */
  stats: ReturnType<typeof getRecoveryStats>
  /** Refresh stats from localStorage */
  refreshStats: () => void
}

export function useErrorRecoveryGuidance(): ErrorRecoveryGuidanceResult {
  const [guidance, setGuidance] = useState<RecoveryGuidance | null>(null)
  const [expertiseLevel, setLevel] = useState<ExpertiseLevel>('beginner')
  const [stats, setStats] = useState(() => getRecoveryStats())
  const guidanceRef = useRef<RecoveryGuidance | null>(null)

  // Initialize expertise level from storage
  useEffect(() => {
    setLevel(getExpertiseLevel())
  }, [])

  const analyzeError = useCallback(
    (error: unknown, context?: string): RecoveryGuidance => {
      const result = analyzeErrorEngine(error, { context })
      guidanceRef.current = result
      setGuidance(result)
      return result
    },
    [],
  )

  const clearGuidance = useCallback(() => {
    guidanceRef.current = null
    setGuidance(null)
  }, [])

  const recordSuccess = useCallback(
    (solutionId: string, errorSignature: string, context?: string) => {
      const feedback: ResolutionFeedback = {
        solutionId,
        errorSignature,
        successful: true,
        timestamp: new Date().toISOString(),
        expertiseLevel,
        context,
      }
      recordResolution(feedback)
      setStats(getRecoveryStats())
    },
    [expertiseLevel],
  )

  const recordFailure = useCallback(
    (solutionId: string, errorSignature: string, context?: string) => {
      const feedback: ResolutionFeedback = {
        solutionId,
        errorSignature,
        successful: false,
        timestamp: new Date().toISOString(),
        expertiseLevel,
        context,
      }
      recordResolution(feedback)
      setStats(getRecoveryStats())
    },
    [expertiseLevel],
  )

  const setExpertise = useCallback((level: ExpertiseLevel) => {
    setExpertiseLevel(level)
    setLevel(level)
  }, [])

  const refreshStats = useCallback(() => {
    setStats(getRecoveryStats())
  }, [])

  return {
    guidance,
    expertiseLevel,
    analyzeError,
    clearGuidance,
    recordSuccess,
    recordFailure,
    setExpertise,
    stats,
    refreshStats,
  }
}

export default useErrorRecoveryGuidance
