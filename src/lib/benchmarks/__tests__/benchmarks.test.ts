/**
 * Tests for the Soroban resource-regression benchmarks module (#980).
 *
 * Coverage:
 *  - primary flow: save → re-simulate → diff with a flagged regression
 *  - boundary: change exactly at / just under the threshold is not a regression
 *  - failure: malformed JSON import and a failing simulator
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  BenchmarkImportError,
  DEFAULT_REGRESSION_THRESHOLD_PCT,
  ZERO_RESOURCES,
  computeDeltaPct,
  createBenchmark,
  deleteBenchmark,
  deserializeBenchmarks,
  diffMeasurement,
  diffResources,
  exportBenchmarksJson,
  extractWasmHashFromLedgerEntry,
  hasRegressions,
  importBenchmarks,
  loadBenchmarks,
  loadMeasurement,
  loadThresholdPct,
  normalizeThresholdPct,
  normalizeWasmHash,
  parseBenchmarkFile,
  reSimulateBenchmark,
  reSimulateBenchmarks,
  saveThresholdPct,
  serializeBenchmarkFile,
  upsertBenchmark,
  type Benchmark,
  type BenchmarkMeasurement,
  type ResourceDiff,
} from '../index'

function measurement(
  cpuInsns: number,
  memBytes: number,
  fee: number,
  overrides: Partial<BenchmarkMeasurement> = {},
): BenchmarkMeasurement {
  return {
    wasmHash: 'wasm-v1',
    resources: { cpuInsns, memBytes, fee },
    measuredAt: '2026-09-26T00:00:00.000Z',
    success: true,
    ...overrides,
  }
}

function benchmark(name = 'transfer', overrides: Partial<Benchmark> = {}): Benchmark {
  return createBenchmark({
    name,
    contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    functionName: 'transfer',
    args: [{ type: 'address', value: 'GABC' }],
    sourceAccount: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    network: 'testnet',
    baseline: measurement(1000, 2000, 100),
    ...overrides,
  })
}

beforeEach(() => {
  localStorage.clear()
})

describe('diffResources — primary flow', () => {
  it('flags a CPU regression above the threshold and keeps other resources clean', () => {
    const rows = diffResources(
      { cpuInsns: 1000, memBytes: 2000, fee: 100 },
      { cpuInsns: 1500, memBytes: 2000, fee: 100 },
      10,
    )

    const cpu = rows.find((row) => row.key === 'cpuInsns')!
    expect(cpu.oldValue).toBe(1000)
    expect(cpu.newValue).toBe(1500)
    expect(cpu.delta).toBe(500)
    expect(cpu.deltaPct).toBeCloseTo(50)
    expect(cpu.regression).toBe(true)

    const mem = rows.find((row) => row.key === 'memBytes')!
    expect(mem.regression).toBe(false)
    expect(mem.deltaPct).toBe(0)
  })

  it('flags regressions on every resource independently', () => {
    const rows = diffResources(
      { cpuInsns: 100, memBytes: 100, fee: 100 },
      { cpuInsns: 250, memBytes: 120, fee: 140 },
      10,
    )

    expect(rows.map((row) => row.regression)).toEqual([true, true, true])
  })

  it('does not flag improvements as regressions', () => {
    const rows = diffResources(
      { cpuInsns: 1000, memBytes: 1000, fee: 1000 },
      { cpuInsns: 500, memBytes: 500, fee: 500 },
      10,
    )
    expect(rows.every((row) => !row.regression)).toBe(true)
    expect(rows[0].delta).toBe(-500)
    expect(rows[0].deltaPct).toBeCloseTo(-50)
  })
})

describe('diffResources — boundary cases', () => {
  it('treats a change exactly at the threshold as acceptable (not a regression)', () => {
    const rows = diffResources(
      { cpuInsns: 1000, memBytes: 2000, fee: 100 },
      { cpuInsns: 1100, memBytes: 2000, fee: 100 },
      10,
    )
    const cpu = rows.find((row) => row.key === 'cpuInsns')!
    expect(cpu.deltaPct).toBeCloseTo(10)
    expect(cpu.regression).toBe(false)
  })

  it('treats a change just under the threshold as acceptable', () => {
    const rows = diffResources({ cpuInsns: 1000 }, { cpuInsns: 1099 }, 10)
    expect(rows[0].regression).toBe(false)
  })

  it('treats a change just over the threshold as a regression', () => {
    const rows = diffResources({ cpuInsns: 1000 }, { cpuInsns: 1101 }, 10)
    expect(rows[0].regression).toBe(true)
  })

  it('honours a custom threshold of 0 percent', () => {
    const unchanged = diffResources({ fee: 100 }, { fee: 100 }, 0).find((row) => row.key === 'fee')!
    const grown = diffResources({ fee: 100 }, { fee: 101 }, 0).find((row) => row.key === 'fee')!
    expect(unchanged.regression).toBe(false)
    expect(grown.regression).toBe(true)
  })

  it('flags any growth from a zero baseline', () => {
    const grown = diffResources({ memBytes: 0 }, { memBytes: 1 }, 10).find((row) => row.key === 'memBytes')!
    const unchanged = diffResources({ memBytes: 0 }, { memBytes: 0 }, 10).find((row) => row.key === 'memBytes')!
    expect(grown.deltaPct).toBe(100)
    expect(grown.regression).toBe(true)
    expect(unchanged.regression).toBe(false)
  })

  it('falls back to the default threshold for invalid input', () => {
    expect(normalizeThresholdPct(undefined)).toBe(DEFAULT_REGRESSION_THRESHOLD_PCT)
    expect(normalizeThresholdPct(Number.NaN)).toBe(DEFAULT_REGRESSION_THRESHOLD_PCT)
    expect(normalizeThresholdPct(-5)).toBe(DEFAULT_REGRESSION_THRESHOLD_PCT)
    expect(normalizeThresholdPct(25)).toBe(25)
    expect(computeDeltaPct(0, 0)).toBe(0)
  })
})

describe('diffMeasurement', () => {
  it('returns a diff with regression metadata when both measurements succeeded', () => {
    const diff = diffMeasurement(
      measurement(1000, 2000, 100),
      measurement(1300, 2000, 100, { wasmHash: 'wasm-v2' }),
      10,
      { benchmarkId: 'b1', benchmarkName: 'transfer', contractId: 'C1' },
    )!

    expect(diff.benchmarkId).toBe('b1')
    expect(diff.oldWasmHash).toBe('wasm-v1')
    expect(diff.newWasmHash).toBe('wasm-v2')
    expect(diff.sameVersion).toBe(false)
    expect(diff.regressed).toBe(true)
    expect(diff.regressionCount).toBe(1)
  })

  it('detects an unchanged Wasm version', () => {
    const diff = diffMeasurement(measurement(1000, 1000, 100), measurement(1000, 1000, 100))!
    expect(diff.sameVersion).toBe(true)
    expect(diff.regressed).toBe(false)
  })

  it('returns null when either side is missing or failed', () => {
    expect(diffMeasurement(null, measurement(1, 1, 1))).toBeNull()
    expect(diffMeasurement(measurement(1, 1, 1), null)).toBeNull()
    expect(
      diffMeasurement(measurement(1, 1, 1), measurement(2, 2, 2, { success: false, error: 'boom' })),
    ).toBeNull()
  })
})

describe('JSON export/import', () => {
  it('round-trips benchmarks through the versioned envelope', () => {
    const original = benchmark()
    const json = serializeBenchmarkFile([original])
    const parsed = parseBenchmarkFile(json)

    expect(parsed.schema).toBe('stellar-dev-dashboard/benchmarks')
    expect(parsed.version).toBe(1)
    expect(parsed.benchmarks).toHaveLength(1)
    expect(parsed.benchmarks[0].name).toBe('transfer')
    expect(parsed.benchmarks[0].baseline?.resources.cpuInsns).toBe(1000)
  })

  it('accepts a bare array of benchmarks', () => {
    const json = JSON.stringify([benchmark()])
    expect(deserializeBenchmarks(json)).toHaveLength(1)
  })

  it('rejects malformed JSON (failure case)', () => {
    expect(() => parseBenchmarkFile('{ not json')).toThrow(BenchmarkImportError)
    try {
      parseBenchmarkFile('{ not json')
    } catch (error) {
      expect(error).toBeInstanceOf(BenchmarkImportError)
      expect((error as BenchmarkImportError).issues.length).toBeGreaterThan(0)
    }
  })

  it('rejects entries that violate the schema (failure case)', () => {
    expect(() => parseBenchmarkFile('{"benchmarks":[{"name":"missing-ids"}]}')).toThrow(
      BenchmarkImportError,
    )

    try {
      parseBenchmarkFile('{"benchmarks":[{"name":"","contractId":"C1","functionName":"f"}]}')
    } catch (error) {
      const issues = (error as BenchmarkImportError).issues.join(' ')
      expect(issues).toContain('name')
    }

    try {
      parseBenchmarkFile(
        '{"benchmarks":[{"name":"n","contractId":"C1","functionName":"f","baseline":{"wasmHash":"x","resources":{"cpuInsns":"many"}}}]}',
      )
    } catch (error) {
      const issues = (error as BenchmarkImportError).issues.join(' ')
      expect(issues).toContain('cpuInsns')
    }
  })

  it('rejects unsupported schemas and versions', () => {
    expect(() => parseBenchmarkFile('{"schema":"other","benchmarks":[]}')).toThrow(BenchmarkImportError)
    expect(() =>
      parseBenchmarkFile('{"schema":"stellar-dev-dashboard/benchmarks","version":99,"benchmarks":[]}'),
    ).toThrow(BenchmarkImportError)
  })

  it('rejects an empty benchmark list', () => {
    expect(() => parseBenchmarkFile('{"benchmarks":[]}')).toThrow(BenchmarkImportError)
  })
})

describe('storage persistence', () => {
  it('upserts by (contractId, name) instead of duplicating', () => {
    const first = upsertBenchmark({
      name: 'transfer',
      contractId: 'C1',
      functionName: 'transfer',
      baseline: null,
    })
    const second = upsertBenchmark({
      name: 'Transfer',
      contractId: 'C1',
      functionName: 'transfer',
      baseline: null,
    })

    expect(second.id).toBe(first.id)
    expect(loadBenchmarks()).toHaveLength(1)
  })

  it('keeps the existing baseline when re-saving without one', () => {
    const saved = upsertBenchmark({
      name: 'transfer',
      contractId: 'C1',
      functionName: 'transfer',
      baseline: measurement(1000, 1000, 100),
    })
    const resaved = upsertBenchmark({
      name: 'transfer',
      contractId: 'C1',
      functionName: 'transfer',
    })

    expect(resaved.id).toBe(saved.id)
    expect(resaved.baseline?.resources.cpuInsns).toBe(1000)
  })

  it('deletes benchmarks and their measurements', () => {
    const saved = upsertBenchmark({ name: 'transfer', contractId: 'C1', functionName: 'transfer' })
    importBenchmarks(serializeBenchmarkFile([{ ...saved, baseline: measurement(1, 1, 1) }]), { merge: true })

    localStorage.setItem(
      'stellar-dashboard:contract-benchmark-results:v1',
      JSON.stringify({ [saved.id]: measurement(1, 1, 1) }),
    )

    deleteBenchmark(saved.id)
    expect(loadBenchmarks()).toHaveLength(0)
    expect(loadMeasurement(saved.id)).toBeNull()
  })

  it('merges imported benchmarks and replaces matching entries', () => {
    const saved = upsertBenchmark({ name: 'transfer', contractId: 'C1', functionName: 'transfer' })
    const exported = serializeBenchmarkFile([{ ...saved, baseline: measurement(1, 1, 1) }])

    const summary = importBenchmarks(exported, { merge: true })
    expect(summary.replaced).toBe(1)
    expect(summary.imported).toBe(0)
    expect(loadBenchmarks()).toHaveLength(1)
  })

  it('replaces the whole list when merge is disabled', () => {
    upsertBenchmark({ name: 'old', contractId: 'C2', functionName: 'f' })
    const summary = importBenchmarks(serializeBenchmarkFile([benchmark('fresh')]), { merge: false })

    expect(summary.imported).toBe(1)
    const names = loadBenchmarks().map((entry) => entry.name)
    expect(names).toEqual(['fresh'])
  })

  it('exports the stored benchmarks as JSON', () => {
    upsertBenchmark({ name: 'transfer', contractId: 'C1', functionName: 'transfer' })
    const parsed = parseBenchmarkFile(exportBenchmarksJson())
    expect(parsed.benchmarks).toHaveLength(1)
  })

  it('persists the regression threshold and falls back to the default', () => {
    expect(loadThresholdPct()).toBe(DEFAULT_REGRESSION_THRESHOLD_PCT)
    expect(saveThresholdPct(25)).toBe(25)
    expect(loadThresholdPct()).toBe(25)
    expect(saveThresholdPct(Number.NaN)).toBe(DEFAULT_REGRESSION_THRESHOLD_PCT)
  })
})

describe('reSimulateBenchmark', () => {
  it('captures the baseline on first run and stores the measurement with its Wasm hash', async () => {
    const saved = upsertBenchmark({
      name: 'transfer',
      contractId: 'C1',
      functionName: 'transfer',
      baseline: null,
    })

    const result = await reSimulateBenchmark(saved, async () => ({
      resources: { cpuInsns: 1000, memBytes: 2000, fee: 100 },
      wasmHash: 'WASM-CURRENT',
    }))

    expect(result.measurement.success).toBe(true)
    expect(result.measurement.wasmHash).toBe('wasm-current')
    expect(result.benchmark.baseline?.resources.cpuInsns).toBe(1000)
    expect(loadMeasurement(saved.id)?.wasmHash).toBe('wasm-current')
    expect(result.diff?.regressed).toBe(false)
  })

  it('diffs a later run against the stored baseline and flags a regression', async () => {
    const saved = upsertBenchmark({
      name: 'transfer',
      contractId: 'C1',
      functionName: 'transfer',
      baseline: measurement(1000, 2000, 100),
    })

    const result = await reSimulateBenchmark(
      saved,
      async () => ({
        resources: { cpuInsns: 1300, memBytes: 2000, fee: 100 },
        wasmHash: 'wasm-v2',
      }),
      { thresholdPct: 10 },
    )

    expect(result.diff).not.toBeNull()
    const cpu = (result.diff as ResourceDiff).rows.find((row) => row.key === 'cpuInsns')!
    expect(cpu.regression).toBe(true)
    expect(result.diff?.sameVersion).toBe(false)
    expect(loadMeasurement(saved.id)?.wasmHash).toBe('wasm-v2')
  })

  it('records a failed simulation without throwing and skips the diff', async () => {
    const saved = upsertBenchmark({
      name: 'transfer',
      contractId: 'C1',
      functionName: 'transfer',
      baseline: measurement(1000, 2000, 100),
    })

    const result = await reSimulateBenchmark(saved, async () => {
      throw new Error('RPC unavailable')
    })

    expect(result.measurement.success).toBe(false)
    expect(result.measurement.error).toBe('RPC unavailable')
    expect(result.measurement.resources).toEqual(ZERO_RESOURCES)
    expect(result.diff).toBeNull()
    expect(loadMeasurement(saved.id)?.error).toBe('RPC unavailable')
  })

  it('does not persist when persist is false', async () => {
    const saved = upsertBenchmark({
      name: 'transfer',
      contractId: 'C1',
      functionName: 'transfer',
      baseline: measurement(1000, 2000, 100),
    })

    await reSimulateBenchmark(
      saved,
      async () => ({ resources: { cpuInsns: 1, memBytes: 1, fee: 1 }, wasmHash: 'wasm-v2' }),
      { persist: false },
    )

    expect(loadMeasurement(saved.id)).toBeNull()
  })

  it('runs a suite sequentially and reports whether any benchmark regressed', async () => {
    const benchmarks = [
      upsertBenchmark({
        name: 'a',
        contractId: 'C1',
        functionName: 'a',
        baseline: measurement(1000, 1000, 100),
      }),
      upsertBenchmark({
        name: 'b',
        contractId: 'C1',
        functionName: 'b',
        baseline: measurement(1000, 1000, 100),
      }),
    ]

    const order: string[] = []
    const results = await reSimulateBenchmarks(
      benchmarks,
      async (entry) => {
        order.push(entry.name)
        return {
          resources: { cpuInsns: entry.name === 'a' ? 2000 : 1000, memBytes: 1000, fee: 100 },
          wasmHash: 'wasm-v2',
        }
      },
      { thresholdPct: 10 },
    )

    expect(order).toEqual(['a', 'b'])
    expect(results).toHaveLength(2)
    expect(hasRegressions(results)).toBe(true)
  })
})

describe('wasm hash helpers', () => {
  it('extracts a Wasm hash from a contract-instance ledger entry', () => {
    const bytes = new Uint8Array([0xab, 0xcd, 0x01])
    const entry = {
      val: {
        contractData: () => ({
          val: () => ({
            value: () => ({
              executable: () => ({ wasm: () => ({ hash: () => bytes }) }),
            }),
          }),
        }),
      },
    }

    expect(extractWasmHashFromLedgerEntry(entry)).toBe('abcd01')
  })

  it('accepts an executable that exposes wasmHash directly', () => {
    const entry = {
      contractData: () => ({
        val: () => ({ value: () => ({ executable: () => ({ wasmHash: () => '0xDEADBEEF' }) }) }),
      }),
    }

    expect(extractWasmHashFromLedgerEntry(entry)).toBe('deadbeef')
  })

  it('returns an empty string for unknown shapes', () => {
    expect(extractWasmHashFromLedgerEntry(null)).toBe('')
    expect(extractWasmHashFromLedgerEntry({ unrelated: true })).toBe('')
    expect(extractWasmHashFromLedgerEntry({ val: { contractData: () => null } })).toBe('')
  })

  it('normalises hash strings', () => {
    expect(normalizeWasmHash('0xABCD')).toBe('abcd')
    expect(normalizeWasmHash('  abcd  ')).toBe('abcd')
    expect(normalizeWasmHash(undefined)).toBe('')
  })
})
