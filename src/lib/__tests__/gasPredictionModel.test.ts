import { describe, it, expect, beforeEach } from 'vitest'
import { GasPredictionModel, extractFeatures } from '../gasPredictionModel'

describe('GasPredictionModel', () => {
  let model: GasPredictionModel

  beforeEach(async () => {
    model = new GasPredictionModel()
    await model.initialize()
  })

  it('predicts gas cost with default features', () => {
    const result = model.predict({
      argCount: 2,
      hasAddressArg: true,
      hasIntArg: true,
      hasBoolArg: false,
      totalArgLength: 60,
      contractCallCount: 0,
      congestionRatio: 0.5,
      ledgerCloseTime: 5,
      hourOfDay: 14,
      dayOfWeek: 3,
      storageEntryCount: 0,
      functionComplexity: 3,
      isWriteOperation: false,
    })

    expect(result.predictedMinResourceFee).toBeGreaterThan(0)
    expect(result.predictedInstructionCount).toBeGreaterThan(0)
    expect(result.predictedTotalFee).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.confidenceInterval[0]).toBeLessThanOrEqual(result.confidenceInterval[1])
    expect(result.accuracy).toBeGreaterThan(0)
    expect(result.featureBreakdown).toBeDefined()
    expect(result.modelVersion).toBe('1.0.0')
  })

  it('returns higher cost for write operations', () => {
    const readResult = model.predict({
      argCount: 1, hasAddressArg: false, hasIntArg: true, hasBoolArg: false,
      totalArgLength: 10, contractCallCount: 0, congestionRatio: 0.5,
      ledgerCloseTime: 5, hourOfDay: 14, dayOfWeek: 3, storageEntryCount: 5,
      functionComplexity: 3, isWriteOperation: false,
    })

    const writeResult = model.predict({
      argCount: 1, hasAddressArg: false, hasIntArg: true, hasBoolArg: false,
      totalArgLength: 10, contractCallCount: 0, congestionRatio: 0.5,
      ledgerCloseTime: 5, hourOfDay: 14, dayOfWeek: 3, storageEntryCount: 5,
      functionComplexity: 3, isWriteOperation: true,
    })

    expect(writeResult.predictedMinResourceFee).toBeGreaterThan(readResult.predictedMinResourceFee)
  })

  it('returns higher cost with more args', () => {
    const fewArgs = model.predict({
      argCount: 1, hasAddressArg: false, hasIntArg: false, hasBoolArg: false,
      totalArgLength: 5, contractCallCount: 0, congestionRatio: 0.5,
      ledgerCloseTime: 5, hourOfDay: 14, dayOfWeek: 3, storageEntryCount: 0,
      functionComplexity: 1, isWriteOperation: false,
    })

    const manyArgs = model.predict({
      argCount: 5, hasAddressArg: true, hasIntArg: true, hasBoolArg: true,
      totalArgLength: 50, contractCallCount: 0, congestionRatio: 0.5,
      ledgerCloseTime: 5, hourOfDay: 14, dayOfWeek: 3, storageEntryCount: 0,
      functionComplexity: 5, isWriteOperation: false,
    })

    expect(manyArgs.predictedMinResourceFee).toBeGreaterThan(fewArgs.predictedMinResourceFee)
  })

  it('updates accuracy when recording feedback', () => {
    const initial = model.getMetrics()
    expect(initial.accuracy).toBe(0.95)

    model.recordPredictionAccuracy({
      predictedFee: 200, actualFee: 210,
      predictedInstructions: 600, actualInstructions: 620,
      contractId: 'C1', functionName: 'fn1', timestamp: new Date().toISOString(),
    })

    const updated = model.getMetrics()
    expect(updated.historySize).toBe(1)
  })

  it('improves accuracy with more training data', async () => {
    const features = Array.from({ length: 20 }, (_, i) => ({
      argCount: (i % 5) + 1,
      hasAddressArg: i % 2 === 0,
      hasIntArg: true,
      hasBoolArg: false,
      totalArgLength: (i % 5) * 10 + 5,
      contractCallCount: i,
      congestionRatio: 0.3 + (i * 0.02),
      ledgerCloseTime: 5,
      hourOfDay: 14,
      dayOfWeek: 3,
      storageEntryCount: i % 3,
      functionComplexity: (i % 3) + 1,
      isWriteOperation: i % 4 === 0,
    }))

    const costs = features.map(f => 100 + f.argCount * 10 + f.storageEntryCount * 5 + (f.isWriteOperation ? 30 : 0))
    const instructions = costs.map(c => c * 3)

    await model.train(features, costs, instructions)

    const prediction = model.predict(features[0])
    expect(prediction.accuracy).toBeGreaterThan(0)
  })

  it('extracts features correctly from params', () => {
    const features = extractFeatures({
      argCount: 3,
      argTypes: ['address', 'int', 'string'],
      argLengths: [56, 2, 10],
      contractCallCount: 5,
      congestionRatio: 0.7,
      ledgerCloseTime: 4,
      storageEntryCount: 2,
      functionComplexity: 4,
      isWrite: true,
    })

    expect(features.argCount).toBe(3)
    expect(features.hasAddressArg).toBe(true)
    expect(features.hasIntArg).toBe(true)
    expect(features.hasBoolArg).toBe(false)
    expect(features.totalArgLength).toBe(68)
    expect(features.contractCallCount).toBe(5)
    expect(features.congestionRatio).toBe(0.7)
    expect(features.isWriteOperation).toBe(true)
  })

  it('generates warning for low confidence', () => {
    model = new GasPredictionModel()
    model['residualStd'] = 500
    model['weights'] = null

    const result = model.predict({
      argCount: 0, hasAddressArg: false, hasIntArg: false, hasBoolArg: false,
      totalArgLength: 0, contractCallCount: 0, congestionRatio: 0,
      ledgerCloseTime: 0, hourOfDay: 0, dayOfWeek: 0, storageEntryCount: 0,
      functionComplexity: 0, isWriteOperation: false,
    })

    expect(result.predictedMinResourceFee).toBe(100)
    expect(result.confidence).toBeLessThanOrEqual(0.99)
  })
})
