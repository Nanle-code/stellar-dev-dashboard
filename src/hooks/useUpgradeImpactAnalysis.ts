import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '../lib/store'
import {
  analyzeUpgradeImpact,
  getUpgradeHistory,
  getModelAccuracy,
  recordOutcome,
} from '../lib/upgradeAnalysis'
import type {
  ContractSpec,
  UpgradeAnalysisResult,
  UpgradeHistoryEntry,
  AnalysisOptions,
} from '../lib/upgradeAnalysis'

const ANALYSIS_CACHE = new Map<string, UpgradeAnalysisResult>()

export function useUpgradeImpactAnalysis(options: AnalysisOptions = {}) {
  const network = useStore((s) => s.network)
  const [result, setResult] = useState<UpgradeAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<UpgradeHistoryEntry[]>([])
  const [accuracy, setAccuracy] = useState({ accuracy: 0, totalPredictions: 0, status: 'learning' })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setHistory(getUpgradeHistory())
    setAccuracy(getModelAccuracy())
  }, [])

  const runAnalysis = useCallback(async (
    oldSpec: ContractSpec | null,
    newSpec: ContractSpec,
    contractId: string = '',
    oldVersion: string = 'previous',
    newVersion: string = 'current',
    analysisOptions?: AnalysisOptions
  ) => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)
    setResult(null)

    const cacheKey = `${contractId}:${oldVersion}:${newVersion}:${JSON.stringify(oldSpec?.functions?.length)}:${JSON.stringify(newSpec?.functions?.length)}`
    const cached = ANALYSIS_CACHE.get(cacheKey)
    if (cached) {
      setResult(cached)
      setLoading(false)
      return cached
    }

    const opts = { ...options, ...analysisOptions }

    const startTime = performance.now()

    try {
      const analysis = await analyzeUpgradeImpact(
        oldSpec,
        newSpec,
        contractId,
        oldVersion,
        newVersion,
        opts
      )

      const elapsed = performance.now() - startTime

      if (elapsed > 30000) {
        console.warn('Upgrade impact analysis exceeded 30s threshold:', Math.round(elapsed), 'ms')
      }

      ANALYSIS_CACHE.set(cacheKey, analysis)
      if (ANALYSIS_CACHE.size > 50) {
        const firstKey = ANALYSIS_CACHE.keys().next().value
        if (firstKey) ANALYSIS_CACHE.delete(firstKey)
      }

      setResult(analysis)
      setHistory(getUpgradeHistory())
      setAccuracy(getModelAccuracy())
      return analysis
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [options])

  const submitFeedback = useCallback((
    contractId: string,
    oldVersion: string,
    newVersion: string,
    changeCount: number,
    breakingCount: number,
    actualImpact: 'none' | 'low' | 'medium' | 'high' | 'critical'
  ) => {
    recordOutcome(contractId, oldVersion, newVersion, changeCount, breakingCount, actualImpact)
    setHistory(getUpgradeHistory())
    setAccuracy(getModelAccuracy())
  }, [])

  const refreshHistory = useCallback(() => {
    setHistory(getUpgradeHistory())
    setAccuracy(getModelAccuracy())
  }, [])

  const clearCache = useCallback(() => {
    ANALYSIS_CACHE.clear()
  }, [])

  return {
    result,
    loading,
    error,
    history,
    accuracy,
    runAnalysis,
    submitFeedback,
    refreshHistory,
    clearCache,
  }
}

export default useUpgradeImpactAnalysis
