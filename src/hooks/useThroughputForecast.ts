import { useState, useEffect, useRef, useCallback } from 'react'
import { getServer, type NetworkName } from '../lib/stellar'
import ThroughputForecaster from '../ml/throughputForecaster'

interface ForecastPrediction {
  horizon: number
  timestamp: number
  predictedTps: number
  predictedOps: number
  lowerBound: number
  upperBound: number
  congestionUtilization: number
}

interface ForecastResult {
  predictions: ForecastPrediction[]
  currentLevel: number
  currentTrend: number
  trendDirection: 'increasing' | 'decreasing' | 'stable' | 'unknown'
  volatility: number
  fitQuality: number
  dataPoints: number
  forecastPeriods: number
}

interface CapacityForecast {
  currentUtilization: number
  avgUtilization: number
  maxUtilization: number
  timeHorizonHours: number
  predictions: ForecastPrediction[]
  scalingScenario: 'capacity-constrained' | 'moderate-load' | 'normal'
}

interface ThroughputForecastState {
  forecast: ForecastResult | null
  capacityForecast: CapacityForecast | null
  loading: boolean
  error: string | null
  dataPointsCount: number
  lastUpdated: Date | null
}

export function useThroughputForecast(
  network: NetworkName,
  ledgerCount: number = 100,
  forecastHorizon: number = 20,
  refreshIntervalMs: number = 30000
): ThroughputForecastState {
  const [state, setState] = useState<ThroughputForecastState>({
    forecast: null,
    capacityForecast: null,
    loading: false,
    error: null,
    dataPointsCount: 0,
    lastUpdated: null,
  })

  const forecasterRef = useRef<ThroughputForecaster | null>(null)

  const fetchAndForecast = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const server = getServer(network)
      const response = await server.ledgers()
        .order('desc')
        .limit(Math.min(ledgerCount, 200))
        .call()

      const ledgers = response.records || []

      if (!forecasterRef.current) {
        forecasterRef.current = new ThroughputForecaster()
      }

      const forecaster = forecasterRef.current
      forecaster.history = []

      for (const ledger of [...ledgers].reverse()) {
        forecaster.addLedgerData(ledger)
      }

      const forecast = forecaster.forecast(forecastHorizon)
      const capacityForecast = forecaster.forecastCapacityUtilization(1)

      setState({
        forecast,
        capacityForecast,
        loading: false,
        error: null,
        dataPointsCount: forecaster.history.length,
        lastUpdated: new Date(),
      })
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch ledger data',
      }))
    }
  }, [network, ledgerCount, forecastHorizon])

  useEffect(() => {
    fetchAndForecast()

    if (refreshIntervalMs > 0) {
      const interval = setInterval(fetchAndForecast, refreshIntervalMs)
      return () => clearInterval(interval)
    }
  }, [fetchAndForecast, refreshIntervalMs])

  return state
}

export default useThroughputForecast
