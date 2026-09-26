/**
 * Benchmark identity helpers (#980).
 *
 * Kept free of storage/UI imports so both the persistence layer and the JSON
 * importer can create stable ids without a dependency cycle.
 */

import type { Benchmark, BenchmarkArg, BenchmarkMeasurement } from './types'

/** Fields accepted when creating or importing a benchmark. */
export interface BenchmarkDraft {
  id?: string
  name: string
  contractId: string
  functionName: string
  args?: BenchmarkArg[]
  sourceAccount?: string
  network?: string
  baseline?: BenchmarkMeasurement | null
  createdAt?: number
  updatedAt?: number
}

/**
 * Generate a benchmark id. Uses `crypto.randomUUID` when available and falls
 * back to a timestamp/random id for older runtimes and SSR/test environments.
 */
export function createBenchmarkId(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    try {
      return cryptoObj.randomUUID()
    } catch {
      // fall through to the manual id below
    }
  }
  return `bm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/** Normalise a draft into a fully-populated benchmark record. */
export function createBenchmark(draft: BenchmarkDraft, now: number = Date.now()): Benchmark {
  return {
    id: draft.id && draft.id.trim() ? draft.id.trim() : createBenchmarkId(),
    name: draft.name.trim(),
    contractId: draft.contractId.trim(),
    functionName: draft.functionName.trim(),
    args: (draft.args ?? []).map((arg) => ({
      type: String(arg?.type ?? 'string'),
      value: String(arg?.value ?? ''),
    })),
    sourceAccount: draft.sourceAccount?.trim() ?? '',
    network: draft.network?.trim() || 'testnet',
    baseline: draft.baseline ?? null,
    createdAt: draft.createdAt ?? now,
    updatedAt: draft.updatedAt ?? now,
  }
}

/** Case-insensitive key used to de-duplicate benchmarks for one contract. */
export function benchmarkKey(contractId: string, name: string): string {
  return `${contractId.trim().toLowerCase()}::${name.trim().toLowerCase()}`
}
