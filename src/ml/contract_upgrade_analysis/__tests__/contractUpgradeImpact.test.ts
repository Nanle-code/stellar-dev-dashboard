import { describe, expect, it } from 'vitest'
import { analyzeContractUpgrade, trainCompatibilityModel, predictImpact } from '../contractUpgradeAnalysis.js'

describe('contract upgrade impact analysis', () => {
  it('detects breaking ABI and bytecode changes with actionable migration guidance', () => {
    const previousAbi = [
      { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'Address' }], outputs: [] },
      { type: 'function', name: 'get_balance', inputs: [{ name: 'owner', type: 'Address' }], outputs: [{ type: 'i128' }] },
      { type: 'event', name: 'Transfer', inputs: [{ name: 'from', type: 'Address' }] },
    ]

    const currentAbi = [
      { type: 'function', name: 'send', inputs: [{ name: 'to', type: 'Address' }, { name: 'amount', type: 'i128' }], outputs: [] },
      { type: 'function', name: 'get_balance', inputs: [{ name: 'account', type: 'Address' }], outputs: [{ type: 'u64' }] },
      { type: 'event', name: 'Transfer', inputs: [{ name: 'sender', type: 'Address' }] },
    ]

    const result = analyzeContractUpgrade({
      previousAbi,
      currentAbi,
      previousBytecode: '0x1234567890abcdef',
      currentBytecode: '0xabcdef1234567890',
      upgradeHistory: [
        { breakingChangeCount: 1, removedFunctionCount: 0, signatureChangeCount: 1, eventChangeCount: 0, bytecodeChanged: false, stateLayoutChanged: false, authChanged: false, impactScore: 0.35 },
        { breakingChangeCount: 3, removedFunctionCount: 1, signatureChangeCount: 1, eventChangeCount: 1, bytecodeChanged: true, stateLayoutChanged: false, authChanged: true, impactScore: 0.82 },
      ],
    })

    expect(result.breakingChanges.length).toBeGreaterThanOrEqual(3)
    expect(result.breakingChanges.some(change => change.type === 'removedFunction')).toBe(true)
    expect(result.breakingChanges.some(change => change.type === 'functionSignatureChange')).toBe(true)
    expect(result.breakingChanges.some(change => change.type === 'eventChange')).toBe(true)
    expect(result.compatibilityScore).toBeLessThan(70)
    expect(result.migrationRecommendations.length).toBeGreaterThan(0)
    expect(result.migrationRecommendations.some(rec => /shim|adapter|wrapper/i.test(rec.action))).toBe(true)
    expect(result.performanceMs).toBeLessThan(1000)
  })

  it('trains a lightweight model and predicts high impact for severe upgrades', () => {
    const model = trainCompatibilityModel([
      { features: { breakingChangeCount: 0, removedFunctionCount: 0, signatureChangeCount: 0, eventChangeCount: 0, bytecodeChanged: false, stateLayoutChanged: false, authChanged: false }, impactScore: 0.15 },
      { features: { breakingChangeCount: 2, removedFunctionCount: 1, signatureChangeCount: 1, eventChangeCount: 0, bytecodeChanged: true, stateLayoutChanged: false, authChanged: false }, impactScore: 0.7 },
      { features: { breakingChangeCount: 4, removedFunctionCount: 2, signatureChangeCount: 1, eventChangeCount: 1, bytecodeChanged: true, stateLayoutChanged: true, authChanged: true }, impactScore: 0.95 },
    ])

    const prediction = predictImpact(model, {
      breakingChangeCount: 4,
      removedFunctionCount: 2,
      signatureChangeCount: 1,
      eventChangeCount: 1,
      bytecodeChanged: true,
      stateLayoutChanged: true,
      authChanged: true,
    })

    expect(prediction.score).toBeGreaterThan(0.6)
    expect(['high', 'critical']).toContain(prediction.level)
  })
})
