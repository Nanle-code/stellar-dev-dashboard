/**
 * localStorage persistence for Soroban resource benchmarks (#980).
 *
 * Benchmarks and their latest measurements are stored under separate keys so a
 * measurement refresh never rewrites the invocation definition. All reads are
 * defensive: corrupt or unavailable storage degrades to an empty result instead
 * of throwing, matching the pattern used by `src/lib/performanceRegression.ts`.
 */

import { benchmarkKey, createBenchmark, type BenchmarkDraft } from './ids'
import { deserializeBenchmarks, serializeBenchmarkFile } from './serialization'
import {
  DEFAULT_REGRESSION_THRESHOLD_PCT,
  normalizeThresholdPct,
} from './diff'
import type { Benchmark, BenchmarkMeasurement } from './types'

export const BENCHMARKS_STORAGE_KEY = 'stellar-dashboard:contract-benchmarks:v1'
export const MEASUREMENTS_STORAGE_KEY = 'stellar-dashboard:contract-benchmark-results:v1'
export const THRESHOLD_STORAGE_KEY = 'stellar-dashboard:contract-benchmark-threshold:v1'

export interface BenchmarkImportSummary {
  benchmarks: Benchmark[]
  imported: number
  replaced: number
}

function getStorage(): Storage | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage
    return storage ?? null
  } catch {
    return null
  }
}

function readJson<T>(key: string, fallback: T): T {
  const storage = getStorage()
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable — benchmarks are best-effort in that case.
  }
}

/** Load all saved benchmarks (newest first). */
export function loadBenchmarks(): Benchmark[] {
  const stored = readJson<Benchmark[]>(BENCHMARKS_STORAGE_KEY, [])
  if (!Array.isArray(stored)) return []
  return stored
    .filter((entry): entry is Benchmark => Boolean(entry && typeof entry === 'object' && entry.id))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Persist the full benchmark list. */
export function saveBenchmarks(benchmarks: Benchmark[]): void {
  writeJson(BENCHMARKS_STORAGE_KEY, benchmarks)
}

function findExisting(list: Benchmark[], draft: BenchmarkDraft): Benchmark | undefined {
  if (draft.id) {
    const byId = list.find((benchmark) => benchmark.id === draft.id)
    if (byId) return byId
  }
  if (draft.contractId && draft.name) {
    const key = benchmarkKey(draft.contractId, draft.name)
    return list.find((benchmark) => benchmarkKey(benchmark.contractId, benchmark.name) === key)
  }
  return undefined
}

/**
 * Insert or update a benchmark. Updates match by id first, then by the
 * (contractId, name) pair so re-saving a benchmark does not create duplicates.
 */
export function upsertBenchmark(draft: BenchmarkDraft): Benchmark {
  const list = loadBenchmarks()
  const now = Date.now()
  const existing = findExisting(list, draft)
  const baseline = draft.baseline !== undefined ? draft.baseline : existing?.baseline ?? null

  if (existing) {
    const updated = createBenchmark(
      { ...draft, id: existing.id, baseline, createdAt: existing.createdAt },
      now,
    )
    updated.createdAt = existing.createdAt
    updated.updatedAt = now
    saveBenchmarks(list.map((benchmark) => (benchmark.id === existing.id ? updated : benchmark)))
    return updated
  }

  const created = createBenchmark({ ...draft, baseline }, now)
  saveBenchmarks([...list, created])
  return created
}

/** Delete a benchmark and its stored measurement. */
export function deleteBenchmark(id: string): void {
  saveBenchmarks(loadBenchmarks().filter((benchmark) => benchmark.id !== id))
  const measurements = loadMeasurements()
  if (measurements[id]) {
    delete measurements[id]
    writeJson(MEASUREMENTS_STORAGE_KEY, measurements)
  }
}

/** Remove every benchmark and measurement. */
export function clearBenchmarks(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(BENCHMARKS_STORAGE_KEY)
    storage.removeItem(MEASUREMENTS_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Load the latest measurement per benchmark id. */
export function loadMeasurements(): Record<string, BenchmarkMeasurement> {
  const stored = readJson<Record<string, BenchmarkMeasurement>>(MEASUREMENTS_STORAGE_KEY, {})
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
  return stored
}

/** Store the latest measurement for a benchmark (keyed by benchmark id). */
export function saveMeasurement(benchmarkId: string, measurement: BenchmarkMeasurement): void {
  if (!benchmarkId) return
  const measurements = loadMeasurements()
  measurements[benchmarkId] = measurement
  writeJson(MEASUREMENTS_STORAGE_KEY, measurements)
}

/** Convenience: read the latest measurement for one benchmark id. */
export function loadMeasurement(benchmarkId: string): BenchmarkMeasurement | null {
  return loadMeasurements()[benchmarkId] ?? null
}

/**
 * Import benchmarks from a JSON document, validating it first.
 *
 * @param raw Benchmark JSON (exported envelope or bare array).
 * @param options `merge: false` replaces the stored list instead of merging.
 * @throws {import('./serialization').BenchmarkImportError} on invalid input.
 */
export function importBenchmarks(
  raw: string,
  options: { merge?: boolean } = {},
): BenchmarkImportSummary {
  const incoming = deserializeBenchmarks(raw)
  const merge = options.merge !== false

  if (!merge) {
    saveBenchmarks(incoming)
    return { benchmarks: incoming, imported: incoming.length, replaced: 0 }
  }

  const existing = loadBenchmarks()
  const byId = new Map(existing.map((benchmark) => [benchmark.id, benchmark]))
  const byKey = new Map(existing.map((benchmark) => [benchmarkKey(benchmark.contractId, benchmark.name), benchmark]))

  let imported = 0
  let replaced = 0

  for (const incomingBenchmark of incoming) {
    const key = benchmarkKey(incomingBenchmark.contractId, incomingBenchmark.name)
    const match = byId.get(incomingBenchmark.id) ?? byKey.get(key)

    if (match) {
      const merged: Benchmark = {
        ...incomingBenchmark,
        id: match.id,
        createdAt: match.createdAt,
        updatedAt: Date.now(),
        baseline: incomingBenchmark.baseline ?? match.baseline,
      }
      byId.set(merged.id, merged)
      byKey.set(key, merged)
      replaced += 1
    } else {
      byId.set(incomingBenchmark.id, incomingBenchmark)
      byKey.set(key, incomingBenchmark)
      imported += 1
    }
  }

  const next = Array.from(byId.values())
  saveBenchmarks(next)
  return { benchmarks: next, imported, replaced }
}

/** Serialise the stored benchmarks as a versioned JSON document. */
export function exportBenchmarksJson(pretty: boolean = true): string {
  return serializeBenchmarkFile(loadBenchmarks(), pretty)
}

/** Read the persisted regression threshold (percent), or the default. */
export function loadThresholdPct(): number {
  const stored = readJson<number | null>(THRESHOLD_STORAGE_KEY, null)
  if (stored === null || stored === undefined) return DEFAULT_REGRESSION_THRESHOLD_PCT
  return normalizeThresholdPct(Number(stored))
}

/** Persist the regression threshold (percent). */
export function saveThresholdPct(thresholdPct: number): number {
  const normalized = normalizeThresholdPct(thresholdPct)
  writeJson(THRESHOLD_STORAGE_KEY, normalized)
  return normalized
}
