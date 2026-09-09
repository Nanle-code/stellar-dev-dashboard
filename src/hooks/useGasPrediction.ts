import { useState, useEffect, useCallback, useRef } from 'react'
import { getGasPredictionService, type GasPredictionService } from '../lib/gasPredictionService'
import type { GasPrediction } from '../lib/gasPredictionModel'
import { useGasPredictionStore } from '../lib/gasPredictionStore'

export interface UseGasPredictionOptions {
  contractId?: string
  functionName?: string
  args?: Array<{ type: string; value: string }>
  enabled?: boolean
}

export function useGasPrediction(options: UseGasPredictionOptions) {
  const { contractId, functionName, args = [], enabled = true } = options
  const [prediction, setPrediction] = useState<GasPrediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const serviceRef = useRef<GasPredictionService | null>(null)
  const storeSetPrediction = useGasPredictionStore((s) => s.setPrediction)

  useEffect(() => {
    if (!enabled) return
    serviceRef.current = getGasPredictionService()
  }, [enabled])

  useEffect(() => {
    if (!enabled || !serviceRef.current || !contractId || !functionName) {
      setPrediction(null)
      return
    }

    const service = serviceRef.current
    let cancelled = false

    async function doPredict() {
      setLoading(true)
      setError(null)
      try {
        const result = await service.predictGas({
          argCount: args.length,
          argTypes: args.map((a) => a.type),
          argLengths: args.map((a) => a.value.length),
          contractId,
          functionName,
          congestionRatio: 0.5,
          ledgerCloseTime: 5,
          storageEntryCount: 0,
          functionComplexity: Math.min(10, args.length + 1),
          isWrite: functionName.startsWith('write') || functionName.startsWith('set') || functionName.startsWith('update'),
        })
        if (!cancelled) {
          setPrediction(result)
          storeSetPrediction(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gas prediction failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    doPredict()

    const unsub = service.subscribe((p) => {
      if (!cancelled) {
        setPrediction(p)
        storeSetPrediction(p)
      }
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [enabled, contractId, functionName, args, storeSetPrediction])

  const refresh = useCallback(async () => {
    if (!serviceRef.current || !contractId || !functionName) return
    setLoading(true)
    try {
      const result = await serviceRef.current.predictGas({
        argCount: args.length,
        argTypes: args.map((a) => a.type),
        argLengths: args.map((a) => a.value.length),
        contractId,
        functionName,
      })
      setPrediction(result)
      storeSetPrediction(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gas prediction failed')
    } finally {
      setLoading(false)
    }
  }, [contractId, functionName, args, storeSetPrediction])

  const recordActual = useCallback((actualFee: number, actualInstructions: number) => {
    if (!serviceRef.current || !prediction || !contractId || !functionName) return
    serviceRef.current.recordActualCost({
      contractId,
      functionName,
      predictedFee: prediction.predictedMinResourceFee,
      actualFee,
      predictedInstructions: prediction.predictedInstructionCount,
      actualInstructions,
    })
  }, [prediction, contractId, functionName])

  return {
    prediction,
    loading,
    error,
    refresh,
    recordActual,
  }
}
