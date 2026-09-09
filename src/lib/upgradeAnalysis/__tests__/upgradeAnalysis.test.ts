import { describe, it, expect } from 'vitest'
import { compareContractSpecs, detectBreakingChanges, analyzeChangePatterns, compareBytecode } from '../comparator'
import { computeCompatibilityScore } from '../compatibilityScorer'
import { generateMigrationRecommendations } from '../migrationGenerator'
import { analyzeChangePatterns as analyzePatterns } from '../comparator'
import type { ContractSpec, ContractFunction, ContractChange } from '../types'

function makeSpec(fns: Partial<ContractFunction>[]): ContractSpec {
  return {
    functions: fns.map(f => ({
      name: f.name || '',
      doc: f.doc || '',
      summary: f.summary || '',
      parameters: f.parameters || [],
      returnType: f.returnType || 'void',
      returnTypes: f.returnTypes || [f.returnType || 'void'],
      signature: f.signature || `${f.name}() -> ${f.returnType || 'void'}`,
    })),
    errorTypes: [],
    customTypes: [],
  }
}

describe('compareContractSpecs', () => {
  it('detects no changes between identical specs', () => {
    const spec = makeSpec([
      { name: 'transfer', parameters: [{ name: 'to', type: 'Address', description: '', required: true }], returnType: 'void' },
      { name: 'balanceOf', parameters: [{ name: 'id', type: 'Address', description: '', required: true }], returnType: 'i128' },
    ])

    const result = compareContractSpecs(spec, spec)
    expect(result.changes).toHaveLength(0)
    expect(result.breakingCount).toBe(0)
    expect(result.nonBreakingCount).toBe(0)
  })

  it('detects removed function as breaking', () => {
    const oldSpec = makeSpec([
      { name: 'transfer', parameters: [], returnType: 'void' },
      { name: 'oldFunction', parameters: [], returnType: 'void' },
    ])
    const newSpec = makeSpec([
      { name: 'transfer', parameters: [], returnType: 'void' },
    ])

    const result = compareContractSpecs(oldSpec, newSpec)
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0].kind).toBe('function-removed')
    expect(result.changes[0].category).toBe('breaking')
    expect(result.breakingCount).toBe(1)
  })

  it('detects added function as non-breaking', () => {
    const oldSpec = makeSpec([
      { name: 'transfer', parameters: [], returnType: 'void' },
    ])
    const newSpec = makeSpec([
      { name: 'transfer', parameters: [], returnType: 'void' },
      { name: 'newFeature', parameters: [], returnType: 'i128' },
    ])

    const result = compareContractSpecs(oldSpec, newSpec)
    const added = result.changes.filter(c => c.kind === 'function-added')
    expect(added).toHaveLength(1)
    expect(added[0].category).toBe('non-breaking')
    expect(result.nonBreakingCount).toBeGreaterThanOrEqual(1)
  })

  it('detects parameter removal as breaking', () => {
    const oldSpec = makeSpec([
      { name: 'transfer', parameters: [
        { name: 'to', type: 'Address', description: '', required: true },
        { name: 'amount', type: 'i128', description: '', required: true },
      ], returnType: 'void' },
    ])
    const newSpec = makeSpec([
      { name: 'transfer', parameters: [
        { name: 'to', type: 'Address', description: '', required: true },
      ], returnType: 'void' },
    ])

    const result = compareContractSpecs(oldSpec, newSpec)
    const paramRemoved = result.changes.filter(c => c.kind === 'parameter-removed')
    expect(paramRemoved).toHaveLength(1)
    expect(paramRemoved[0].category).toBe('breaking')
  })

  it('detects parameter type change as breaking', () => {
    const oldSpec = makeSpec([
      { name: 'setLimit', parameters: [
        { name: 'limit', type: 'u32', description: '', required: true },
      ], returnType: 'void' },
    ])
    const newSpec = makeSpec([
      { name: 'setLimit', parameters: [
        { name: 'limit', type: 'i128', description: '', required: true },
      ], returnType: 'void' },
    ])

    const result = compareContractSpecs(oldSpec, newSpec)
    const typeChanged = result.changes.filter(c => c.kind === 'parameter-type-changed')
    expect(typeChanged).toHaveLength(1)
    expect(typeChanged[0].category).toBe('breaking')
  })

  it('detects return type change as breaking', () => {
    const oldSpec = makeSpec([
      { name: 'balanceOf', parameters: [], returnType: 'u32' },
    ])
    const newSpec = makeSpec([
      { name: 'balanceOf', parameters: [], returnType: 'i128' },
    ])

    const result = compareContractSpecs(oldSpec, newSpec)
    const returnChanged = result.changes.filter(c => c.kind === 'return-type-changed')
    expect(returnChanged).toHaveLength(1)
    expect(returnChanged[0].category).toBe('breaking')
  })

  it('detects added required parameter as breaking', () => {
    const oldSpec = makeSpec([
      { name: 'transfer', parameters: [
        { name: 'to', type: 'Address', description: '', required: true },
        { name: 'amount', type: 'i128', description: '', required: true },
      ], returnType: 'void' },
    ])
    const newSpec = makeSpec([
      { name: 'transfer', parameters: [
        { name: 'to', type: 'Address', description: '', required: true },
        { name: 'amount', type: 'i128', description: '', required: true },
        { name: 'memo', type: 'String', description: '', required: true },
      ], returnType: 'void' },
    ])

    const result = compareContractSpecs(oldSpec, newSpec)
    const paramAdded = result.changes.filter(c => c.kind === 'parameter-added')
    expect(paramAdded).toHaveLength(1)
    expect(paramAdded[0].category).toBe('breaking')
  })

  it('detects added optional parameter as non-breaking', () => {
    const oldSpec = makeSpec([
      { name: 'transfer', parameters: [
        { name: 'to', type: 'Address', description: '', required: true },
        { name: 'amount', type: 'i128', description: '', required: true },
      ], returnType: 'void' },
    ])
    const newSpec = makeSpec([
      { name: 'transfer', parameters: [
        { name: 'to', type: 'Address', description: '', required: true },
        { name: 'amount', type: 'i128', description: '', required: true },
        { name: 'memo', type: 'String', description: '', required: false },
      ], returnType: 'void' },
    ])

    const result = compareContractSpecs(oldSpec, newSpec)
    const paramAdded = result.changes.filter(c => c.kind === 'parameter-added')
    expect(paramAdded).toHaveLength(1)
    expect(paramAdded[0].category).toBe('non-breaking')
  })
})

describe('detectBreakingChanges', () => {
  it('returns only breaking changes', () => {
    const oldSpec = makeSpec([
      { name: 'removed', parameters: [], returnType: 'void' },
      { name: 'kept', parameters: [{ name: 'x', type: 'u32', description: '', required: true }], returnType: 'u32' },
    ])
    const newSpec = makeSpec([
      { name: 'kept', parameters: [{ name: 'x', type: 'i128', description: '', required: true }], returnType: 'u32' },
    ])

    const { changes } = compareContractSpecs(oldSpec, newSpec)
    const breaking = detectBreakingChanges(newSpec, changes)
    expect(breaking.length).toBeGreaterThan(0)
    breaking.forEach(c => expect(c.category).toBe('breaking'))
  })
})

describe('analyzeChangePatterns', () => {
  it('categorizes changes correctly', () => {
    const oldSpec = makeSpec([
      { name: 'removed', parameters: [], returnType: 'void' },
      { name: 'renamed', parameters: [], returnType: 'void' },
    ])
    const newSpec = makeSpec([
      { name: 'added', parameters: [], returnType: 'void' },
      { name: 'newName', parameters: [], returnType: 'void' },
    ])

    const { changes } = compareContractSpecs(oldSpec, newSpec)
    const patterns = analyzePatterns(changes)

    expect(patterns.removedFunctions).toContain('removed')
    expect(patterns.newFunctions).toContain('added')
  })
})

describe('compareBytecode', () => {
  it('detects identical bytecode', () => {
    const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
    const result = compareBytecode(wasm, wasm)
    expect(result.checksumChanged).toBe(false)
    expect(result.sizeDelta).toBe(0)
  })

  it('detects changed bytecode', () => {
    const oldWasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
    const newWasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 1])
    const result = compareBytecode(oldWasm, newWasm)
    expect(result.checksumChanged).toBe(true)
    expect(result.sizeDelta).toBe(0)
  })

  it('detects size differences', () => {
    const oldWasm = new Uint8Array([0, 97, 115])
    const newWasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
    const result = compareBytecode(oldWasm, newWasm)
    expect(result.sizeDelta).toBe(5)
  })
})

describe('computeCompatibilityScore', () => {
  it('returns 1.0 for identical specs', () => {
    const spec = makeSpec([
      { name: 'transfer', parameters: [{ name: 'to', type: 'Address', description: '', required: true }], returnType: 'void' },
    ])
    const { changes } = compareContractSpecs(spec, spec)
    const score = computeCompatibilityScore(spec, spec, changes)
    expect(score.overall).toBeGreaterThanOrEqual(0.9)
    expect(score.apiCompatibility).toBeGreaterThanOrEqual(0.9)
  })

  it('penalizes breaking changes', () => {
    const oldSpec = makeSpec([
      { name: 'transfer', parameters: [], returnType: 'void' },
      { name: 'balanceOf', parameters: [], returnType: 'u32' },
    ])
    const newSpec = makeSpec([
      { name: 'transfer', parameters: [], returnType: 'void' },
    ])

    const { changes } = compareContractSpecs(oldSpec, newSpec)
    const score = computeCompatibilityScore(oldSpec, newSpec, changes)
    expect(score.overall).toBeLessThan(1.0)
    expect(score.overall).toBeGreaterThanOrEqual(0)
  })
})

describe('generateMigrationRecommendations', () => {
  it('generates recommendations for breaking changes', () => {
    const oldSpec = makeSpec([
      { name: 'oldFunc', parameters: [{ name: 'x', type: 'u32', description: '', required: true }], returnType: 'void' },
    ])
    const newSpec = makeSpec([
      { name: 'newFunc', parameters: [{ name: 'y', type: 'i128', description: '', required: true }], returnType: 'i128' },
    ])

    const { changes } = compareContractSpecs(oldSpec, newSpec)
    const patterns = analyzePatterns(changes)
    const recs = generateMigrationRecommendations(changes, oldSpec, newSpec, patterns)

    expect(recs.length).toBeGreaterThan(0)
    expect(recs.some(r => r.priority === 'critical' || r.priority === 'high')).toBe(true)
  })

  it('analyzes within time threshold', async () => {
    const oldSpec = makeSpec([
      { name: 'fn1', parameters: [], returnType: 'void' },
      { name: 'fn2', parameters: [{ name: 'x', type: 'u32', description: '', required: true }], returnType: 'u32' },
    ])
    const newSpec = makeSpec([
      { name: 'fn1', parameters: [{ name: 'x', type: 'i128', description: '', required: true }], returnType: 'i128' },
      { name: 'fn2', parameters: [], returnType: 'void' },
      { name: 'fn3', parameters: [], returnType: 'void' },
    ])

    const start = performance.now()
    const { changes } = compareContractSpecs(oldSpec, newSpec)
    const patterns = analyzePatterns(changes)
    const score = computeCompatibilityScore(oldSpec, newSpec, changes)
    const recs = generateMigrationRecommendations(changes, oldSpec, newSpec, patterns)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(30000)
    expect(changes.length).toBeGreaterThan(0)
    expect(score.overall).toBeGreaterThanOrEqual(0)
    expect(recs.length).toBeGreaterThan(0)
  })
})
