/**
 * useCapacityPrediction.ts
 * React hook that drives the capacity prediction engine.
 *
 * Reads ledger history from the Zustand store, converts it to
 * CapacityDataPoint[], runs predictCapacity(), and re-runs whenever
 * the history grows or the forecast window changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../lib/store'
import {
  predictCapacity,
  ledgerHistoryToCapacityPoints,
  FORECAST_WINDOWS,
  CAPACITY_LIMIT_OPS,
} from '../lib/capacityPrediction'
import type { CapacityPredictionResult } from '../lib/capacityPrediction'

export type ForecastWindow = (typeof FORECAST_WINDOWS)[number]

export interface UseCapacityPredictionOptions {
  /** Forecast horizon in days. Must be one of FORECAST_WINDOWS. Default: 30 */
  horizonDays?: ForecastWindow
  /** Override for the capacity ceiling (ops/ledger). Default: CAPACITY_LIMIT_OPS */
  capacityLimit?: number
  /** Re-run prediction when ledger history length changes by at least this amount. Default: 1 */
  refreshThreshold?: number
}

export interface UseCapacityPredictionReturn {
  /** Full prediction result, null while loading or before first run */
  result: CapacityPredictionResult | null
  /** True while the prediction engine is running */
  loading: boolean
  /** Error message if the engine threw */
  error: string | null
  /** Current forecast horizon in days */
  horizonDays: ForecastWindow
  /** Change the forecast horizon and trigger a re-run */
  setHorizonDays: (days: ForecastWindow) => void
  /** Manually trigger a fresh prediction run */
  refresh: () => void
  /** Number of data points available */
  dataPoints: number
}

const DEFAULT_HORIZON: ForecastWindow = 30

export function useCapacityPrediction(
  options: UseCapacityPredictionOptions = {},
): UseCapacityPredictionReturn {
  const {
    horizonDays: initialHorizon = DEFAULT_HORIZON,
    capacityLimit = CAPACITY_LIMIT_OPS,
    refreshThreshold = 1,
  } = options

  const ledgerHistory = useStore((s) => s.ledgerHistory)
  const storedHorizon = useStore((s) => s.capacityPredictionHorizon)
  const setStoredHorizon = useStore((s) => s.setCapacityPredictionHorizon)

  // Prefer the persisted store value, fall back to option/default
  const resolvedInitial = (
    FORECAST_WINDOWS.includes(storedHorizon as ForecastWindow)
      ? storedHorizon
      : initialHorizon
  ) as ForecastWindow

  const [horizonDays, setHorizonDaysLocal] = useState<ForecastWindow>(resolvedInitial)
  const [result, setResult] = useState<CapacityPredictionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setHorizonDays = useCallback(
    (days: ForecastWindow) => {
      setHorizonDaysLocal(days)
      setStoredHorizon(days)
    },
    [setStoredHorizon],
  )

  // Track last data-length that triggered a run so we only re-run on meaningful changes
  const lastRunLengthRef = useRef<number>(-1)
  const lastHorizonRef = useRef<ForecastWindow>(horizonDays)

  const runPrediction = useCallback(() => {
    setLoading(true)
    setError(null)
    try {
      const points = ledgerHistoryToCapacityPoints(ledgerHistory)
      const prediction = predictCapacity(points, horizonDays, capacityLimit)
      setResult(prediction)
      lastRunLengthRef.current = ledgerHistory.length
      lastHorizonRef.current = horizonDays
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Capacity prediction failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [ledgerHistory, horizonDays, capacityLimit])

  useEffect(() => {
    const lengthChanged =
      Math.abs(ledgerHistory.length - lastRunLengthRef.current) >= refreshThreshold
    const horizonChanged = horizonDays !== lastHorizonRef.current

    if (lengthChanged || horizonChanged || lastRunLengthRef.current === -1) {
      runPrediction()
    }
  }, [ledgerHistory.length, horizonDays, refreshThreshold, runPrediction])

  return {
    result,
    loading,
    error,
    horizonDays,
    setHorizonDays,
    refresh: runPrediction,
    dataPoints: ledgerHistory.length,
  }
}

export default useCapacityPrediction
