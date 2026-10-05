/**
 * JSON import/export for Soroban resource benchmarks (#980).
 *
 * Export produces a versioned envelope so CI can archive benchmark files and
 * diff them across runs. Import validates the envelope and every entry before
 * returning anything — a malformed file throws {@link BenchmarkImportError}
 * with a list of concrete issues instead of silently importing partial data.
 *
 * Accepted input shapes:
 *   1. The exported envelope: { schema, version, exportedAt, benchmarks: [...] }
 *   2. A bare array of benchmark objects (handy for hand-authored CI fixtures).
 */

import { createBenchmark, createBenchmarkId, type BenchmarkDraft } from './ids'
import {
  BENCHMARK_SCHEMA_ID,
  BENCHMARK_SCHEMA_VERSION,
  RESOURCE_KEYS,
  type Benchmark,
  type BenchmarkArg,
  type BenchmarkFile,
  type BenchmarkMeasurement,
  type ResourceUsage,
} from './types'

/** Thrown when an imported benchmark file is malformed or fails validation. */
export class BenchmarkImportError extends Error {
  readonly issues: string[]

  constructor(message: string, issues: string[] = []) {
    super(message)
    this.name = 'BenchmarkImportError'
    this.issues = issues
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateResourceUsage(value: unknown, path: string, issues: string[]): ResourceUsage | null {
  if (!isRecord(value)) {
    issues.push(`${path}: "resources" must be an object`)
    return null
  }

  const resources: ResourceUsage = { cpuInsns: 0, memBytes: 0, fee: 0 }
  for (const key of RESOURCE_KEYS) {
    const raw = value[key]
    if (raw === undefined) {
      issues.push(`${path}.${key}: missing required resource counter`)
      return null
    }
    const num = Number(raw)
    if (!Number.isFinite(num) || num < 0) {
      issues.push(`${path}.${key}: expected a non-negative number`)
      return null
    }
    resources[key] = num
  }
  return resources
}

function validateMeasurement(value: unknown, path: string, issues: string[]): BenchmarkMeasurement | null {
  if (value === null || value === undefined) return null
  if (!isRecord(value)) {
    issues.push(`${path}: "baseline" must be an object or null`)
    return null
  }

  const resources = validateResourceUsage(value.resources, path, issues)
  if (!resources) return null

  const wasmHash = typeof value.wasmHash === 'string' ? value.wasmHash.trim() : ''
  if (value.wasmHash !== undefined && typeof value.wasmHash !== 'string') {
    issues.push(`${path}.wasmHash: expected a string`)
    return null
  }

  const success = value.success === undefined ? true : Boolean(value.success)
  const measurement: BenchmarkMeasurement = {
    wasmHash,
    resources,
    measuredAt: typeof value.measuredAt === 'string' && value.measuredAt ? value.measuredAt : new Date().toISOString(),
    success,
  }

  if (typeof value.ledger === 'number' && Number.isFinite(value.ledger)) measurement.ledger = value.ledger
  if (typeof value.error === 'string' && value.error) measurement.error = value.error

  return measurement
}

function validateArgs(value: unknown, path: string, issues: string[]): BenchmarkArg[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    issues.push(`${path}.args: expected an array`)
    return []
  }
  return value.map((arg, index) => {
    if (!isRecord(arg)) {
      issues.push(`${path}.args[${index}]: expected an object`)
      return { type: 'string', value: '' }
    }
    if (arg.type !== undefined && typeof arg.type !== 'string') {
      issues.push(`${path}.args[${index}].type: expected a string`)
    }
    if (arg.value !== undefined && typeof arg.value !== 'string') {
      issues.push(`${path}.args[${index}].value: expected a string`)
    }
    return {
      type: typeof arg.type === 'string' ? arg.type : 'string',
      value: typeof arg.value === 'string' ? arg.value : '',
    }
  })
}

function validateBenchmark(value: unknown, index: number, issues: string[]): Benchmark | null {
  const path = `benchmarks[${index}]`
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`)
    return null
  }

  const name = typeof value.name === 'string' ? value.name.trim() : ''
  if (!name) issues.push(`${path}.name: required non-empty string`)

  const contractId = typeof value.contractId === 'string' ? value.contractId.trim() : ''
  if (!contractId) issues.push(`${path}.contractId: required non-empty string`)

  const functionName = typeof value.functionName === 'string' ? value.functionName.trim() : ''
  if (!functionName) issues.push(`${path}.functionName: required non-empty string`)

  if (name === '' || contractId === '' || functionName === '') return null

  const args = validateArgs(value.args, path, issues)
  const baseline = validateMeasurement(value.baseline, path, issues)

  const draft: BenchmarkDraft = {
    id: typeof value.id === 'string' && value.id.trim() ? value.id.trim() : createBenchmarkId(),
    name,
    contractId,
    functionName,
    args,
    sourceAccount: typeof value.sourceAccount === 'string' ? value.sourceAccount : '',
    network: typeof value.network === 'string' ? value.network : 'testnet',
    baseline,
  }

  if (typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)) draft.createdAt = value.createdAt
  if (typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)) draft.updatedAt = value.updatedAt

  return createBenchmark(draft)
}

/** Build the export envelope for a set of benchmarks. */
export function createBenchmarkFile(
  benchmarks: Benchmark[],
  exportedAt: string = new Date().toISOString(),
): BenchmarkFile {
  return {
    schema: BENCHMARK_SCHEMA_ID,
    version: BENCHMARK_SCHEMA_VERSION,
    exportedAt,
    benchmarks: benchmarks.map((benchmark) => ({ ...benchmark })),
  }
}

/** Serialise benchmarks to the versioned JSON format used for CI export/import. */
export function serializeBenchmarkFile(benchmarks: Benchmark[], pretty: boolean = true): string {
  return JSON.stringify(createBenchmarkFile(benchmarks), null, pretty ? 2 : 0)
}

/**
 * Parse and validate a benchmark JSON document.
 *
 * @throws {BenchmarkImportError} when the JSON is malformed, the envelope is
 * unsupported, or any benchmark entry fails validation.
 */
export function parseBenchmarkFile(raw: string): BenchmarkFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new BenchmarkImportError('Benchmarks file is not valid JSON', [
      error instanceof Error ? error.message : String(error),
    ])
  }

  const issues: string[] = []
  let list: unknown[]
  let version: number = BENCHMARK_SCHEMA_VERSION
  let exportedAt: string = new Date().toISOString()

  if (Array.isArray(parsed)) {
    list = parsed
  } else if (isRecord(parsed)) {
    if (parsed.schema !== undefined && parsed.schema !== BENCHMARK_SCHEMA_ID) {
      throw new BenchmarkImportError(`Unsupported benchmark schema: ${String(parsed.schema)}`, [
        `expected schema "${BENCHMARK_SCHEMA_ID}"`,
      ])
    }
    if (parsed.version !== undefined) {
      const parsedVersion = Number(parsed.version)
      if (!Number.isInteger(parsedVersion) || parsedVersion > BENCHMARK_SCHEMA_VERSION) {
        throw new BenchmarkImportError(`Unsupported benchmark file version: ${String(parsed.version)}`, [
          `supported version is ${BENCHMARK_SCHEMA_VERSION}`,
        ])
      }
      version = parsedVersion
    }
    if (!Array.isArray(parsed.benchmarks)) {
      throw new BenchmarkImportError('Benchmarks file must contain a "benchmarks" array', [
        '"benchmarks" is missing or not an array',
      ])
    }
    list = parsed.benchmarks
    if (typeof parsed.exportedAt === 'string' && parsed.exportedAt) exportedAt = parsed.exportedAt
  } else {
    throw new BenchmarkImportError('Benchmarks file must be a JSON object or array', [])
  }

  const benchmarks: Benchmark[] = []
  const seenIds = new Set<string>()
  list.forEach((entry, index) => {
    const benchmark = validateBenchmark(entry, index, issues)
    if (!benchmark) return
    if (seenIds.has(benchmark.id)) benchmark.id = createBenchmarkId()
    seenIds.add(benchmark.id)
    benchmarks.push(benchmark)
  })

  if (issues.length > 0) {
    const label = issues.length === 1 ? 'issue' : 'issues'
    throw new BenchmarkImportError(`Benchmark file failed validation (${issues.length} ${label})`, issues)
  }
  if (benchmarks.length === 0) {
    throw new BenchmarkImportError('Benchmarks file contains no benchmarks', ['expected at least one benchmark'])
  }

  return { schema: BENCHMARK_SCHEMA_ID, version, exportedAt, benchmarks }
}

/** Parse a benchmark JSON document and return just the benchmark list. */
export function deserializeBenchmarks(raw: string): Benchmark[] {
  return parseBenchmarkFile(raw).benchmarks
}
