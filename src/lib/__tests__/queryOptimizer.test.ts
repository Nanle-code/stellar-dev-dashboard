/**
 * Tests for the query pattern analyzer / optimization advisor
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { recordQuery, getRecommendations, getReport, reset } from '../queryOptimizer'

describe('queryOptimizer', () => {
  beforeEach(() => {
    reset()
  })

  it('reports zero totals with no recorded queries', () => {
    const report = getReport()
    expect(report.totalQueries).toBe(0)
    expect(report.distinctPatterns).toBe(0)
    expect(report.recommendations).toEqual([])
  })

  it('recommends an index for a repeated, wasteful full-table scan', () => {
    for (let i = 0; i < 5; i++) {
      recordQuery({
        store: 'widgets',
        operation: 'full-scan',
        filterField: 'ownerId',
        durationMs: 20,
        rowsScanned: 1000,
        rowsReturned: 10,
      })
    }

    const recs = getRecommendations()
    const indexRec = recs.find((r) => r.type === 'add-index')
    expect(indexRec).toBeDefined()
    expect(indexRec?.store).toBe('widgets')
    expect(indexRec?.field).toBe('ownerId')
    expect(indexRec?.occurrences).toBe(5)
    expect(indexRec?.safe).toBe(true)
    expect(indexRec?.estimatedSpeedupPercent).toBeGreaterThan(0)
    expect(indexRec?.estimatedSpeedupPercent).toBeLessThanOrEqual(90)
  })

  it('does not recommend an index for an efficient index lookup', () => {
    for (let i = 0; i < 10; i++) {
      recordQuery({
        store: 'alert-rules',
        operation: 'index-lookup',
        indexUsed: 'userId',
        durationMs: 2,
        rowsScanned: 5,
        rowsReturned: 5,
      })
    }

    const recs = getRecommendations()
    expect(recs.find((r) => r.type === 'add-index')).toBeUndefined()
  })

  it('recommends caching for a slow query repeated many times', () => {
    for (let i = 0; i < 8; i++) {
      recordQuery({
        store: 'transactions',
        operation: 'index-lookup',
        indexUsed: 'accountId',
        durationMs: 75,
        rowsScanned: 200,
        rowsReturned: 200,
      })
    }

    const recs = getRecommendations()
    expect(recs.find((r) => r.type === 'cache-result')).toBeDefined()
  })

  it('ignores patterns seen fewer times than the occurrence threshold', () => {
    recordQuery({
      store: 'widgets',
      operation: 'full-scan',
      filterField: 'ownerId',
      durationMs: 500,
      rowsScanned: 10000,
      rowsReturned: 1,
    })

    expect(getRecommendations()).toEqual([])
  })

  it('never produces an unsafe recommendation', () => {
    for (let i = 0; i < 6; i++) {
      recordQuery({
        store: 'widgets',
        operation: 'full-scan',
        filterField: 'status',
        durationMs: 40,
        rowsScanned: 500,
        rowsReturned: 5,
      })
    }

    const recs = getRecommendations()
    expect(recs.length).toBeGreaterThan(0)
    for (const rec of recs) {
      expect(rec.safe).toBe(true)
    }
  })

  it('tracks total and slow query counts in the report', () => {
    recordQuery({
      store: 'widgets',
      operation: 'index-lookup',
      indexUsed: 'id',
      durationMs: 5,
      rowsScanned: 1,
      rowsReturned: 1,
    })
    recordQuery({
      store: 'widgets',
      operation: 'full-scan',
      filterField: 'status',
      durationMs: 200,
      rowsScanned: 5000,
      rowsReturned: 3,
    })

    const report = getReport()
    expect(report.totalQueries).toBe(2)
    expect(report.slowQueries).toBe(1)
    expect(report.distinctPatterns).toBe(2)
  })

  it('resets all recorded state', () => {
    recordQuery({
      store: 'widgets',
      operation: 'full-scan',
      filterField: 'ownerId',
      durationMs: 20,
      rowsScanned: 100,
      rowsReturned: 5,
    })
    reset()
    expect(getReport().totalQueries).toBe(0)
    expect(getRecommendations()).toEqual([])
  })
})
