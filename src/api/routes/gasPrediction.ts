import { Router, Request, Response } from 'express'
import { getGasPredictionService } from '../../lib/gasPredictionService'
import { cacheMiddleware } from '../middleware/predictCache'

const router = Router()
let thresholdsStore: Array<{
  id: string
  label: string
  maxResourceFee: number
  enabled: boolean
  notifyOnExceed: boolean
}> = []

router.post('/v1/gas/predict', cacheMiddleware, async (req: Request, res: Response) => {
  try {
    const { contractId, functionName, args, congestionRatio, ledgerCloseTime, storageEntryCount, functionComplexity, isWrite } = req.body

    if (!contractId || !functionName) {
      return res.status(400).json({ error: 'contractId and functionName are required' })
    }

    const service = getGasPredictionService()
    const prediction = await service.predictGas({
      argCount: args?.length ?? 0,
      argTypes: args?.map((a: any) => a.type) ?? [],
      argLengths: args?.map((a: any) => String(a.value ?? '').length) ?? [],
      contractId,
      functionName,
      congestionRatio: congestionRatio ?? 0.5,
      ledgerCloseTime: ledgerCloseTime ?? 5,
      storageEntryCount: storageEntryCount ?? 0,
      functionComplexity: functionComplexity ?? 3,
      isWrite: isWrite ?? false,
    })

    res.json(prediction)
  } catch (err) {
    console.error('[GasPrediction API] predict error:', err)
    res.status(500).json({ error: 'Failed to generate gas prediction' })
  }
})

router.post('/v1/gas/record', async (req: Request, res: Response) => {
  try {
    const { contractId, functionName, predictedFee, actualFee, predictedInstructions, actualInstructions } = req.body

    if (!contractId || !functionName || actualFee === undefined) {
      return res.status(400).json({ error: 'contractId, functionName, and actualFee are required' })
    }

    const service = getGasPredictionService()
    service.recordActualCost({
      contractId,
      functionName,
      predictedFee: predictedFee ?? 0,
      actualFee,
      predictedInstructions: predictedInstructions ?? 0,
      actualInstructions: actualInstructions ?? 0,
    })

    res.json({ success: true })
  } catch (err) {
    console.error('[GasPrediction API] record error:', err)
    res.status(500).json({ error: 'Failed to record prediction accuracy' })
  }
})

router.get('/v1/gas/metrics', async (_req: Request, res: Response) => {
  try {
    const service = getGasPredictionService()
    const metrics = service.getMetrics()
    const history = service.getPredictionHistory()
    res.json({ metrics, history })
  } catch (err) {
    console.error('[GasPrediction API] metrics error:', err)
    res.status(500).json({ error: 'Failed to retrieve metrics' })
  }
})

router.get('/v1/gas/thresholds', async (_req: Request, res: Response) => {
  res.json(thresholdsStore)
})

router.post('/v1/gas/thresholds', async (req: Request, res: Response) => {
  try {
    const { thresholds } = req.body
    if (!Array.isArray(thresholds)) {
      return res.status(400).json({ error: 'thresholds must be an array' })
    }
    thresholdsStore = thresholds
    const service = getGasPredictionService()
    service.setThresholds(thresholds)
    res.json({ success: true, thresholds: thresholdsStore })
  } catch (err) {
    console.error('[GasPrediction API] set thresholds error:', err)
    res.status(500).json({ error: 'Failed to set thresholds' })
  }
})

export default router
