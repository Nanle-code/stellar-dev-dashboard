import { describe, it, expect } from 'vitest'
import { kmeans, autoKmeans } from '../anomalyClustering'

describe('kmeans', () => {
  it('returns empty result for empty data', () => {
    const result = kmeans([], 3)
    expect(result.clusters).toEqual([])
    expect(result.assignments).toEqual([])
    expect(result.inertia).toBe(0)
  })

  it('clusters simple 2D data into correct groups', () => {
    const data = [
      [0, 0], [0.1, 0.1], [-0.1, -0.1],
      [10, 10], [10.1, 10.1], [9.9, 9.9],
      [-10, -10], [-10.1, -10.1], [-9.9, -9.9],
    ]
    const result = kmeans(data, 3, { maxIter: 50 })

    expect(result.clusters).toHaveLength(3)
    expect(result.assignments).toHaveLength(9)
    expect(result.centroids).toHaveLength(3)
    expect(result.iterations).toBeGreaterThan(0)
    expect(result.inertia).toBeGreaterThan(0)

    const a0 = result.assignments[0]
    const a1 = result.assignments[1]
    const a2 = result.assignments[2]
    expect(a0).toBe(a1)
    expect(a1).toBe(a2)
  })

  it('k=1 puts everything in one cluster', () => {
    const data = [[0, 0], [1, 1], [2, 2], [10, 10]]
    const result = kmeans(data, 1)
    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0]).toHaveLength(4)
    expect(result.assignments.every((a) => a === 0)).toBe(true)
  })

  it('handles k larger than data size', () => {
    const data = [[1, 2], [3, 4]]
    const result = kmeans(data, 10)
    expect(result.clusters).toHaveLength(2)
    expect(result.assignments).toHaveLength(2)
  })

  it('converges or reaches max iterations', () => {
    const data = Array.from({ length: 20 }, () => [Math.random() * 10, Math.random() * 10])
    const result = kmeans(data, 3, { maxIter: 10, tolerance: 1e-6 })
    expect(result.iterations).toBeLessThanOrEqual(10)
    expect(result.clusters.some((c) => c.length > 0)).toBe(true)
  })

  it('handles 1D data', () => {
    const data = [[0], [0.5], [10], [10.5], [20], [20.5]]
    const result = kmeans(data, 3)
    expect(result.clusters).toHaveLength(3)
    expect(result.assignments).toHaveLength(6)
  })
})

describe('autoKmeans', () => {
  it('returns a reasonable k value', () => {
    const data = [
      [0, 0], [0.1, 0.1], [-0.1, -0.1],
      [10, 10], [10.1, 10.1],
      [20, 20], [20.1, 20.1],
    ]
    const result = autoKmeans(data, { maxK: 5 })
    expect(result.k).toBeGreaterThanOrEqual(1)
    expect(result.k).toBeLessThanOrEqual(5)
    expect(result.clusters).toHaveLength(result.k)
    expect(result.assignments).toHaveLength(data.length)
  })

  it('handles 0 or 1 data points', () => {
    const empty = autoKmeans([])
    expect(empty.k).toBe(1)
    expect(empty.clusters).toEqual([])

    const single = autoKmeans([[1, 2]])
    expect(single.k).toBe(1)
    expect(single.clusters).toEqual([[0]])
  })
})
