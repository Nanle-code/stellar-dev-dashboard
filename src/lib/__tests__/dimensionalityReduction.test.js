import { describe, it, expect } from 'vitest'
import { pca } from '../dimensionalityReduction'

describe('pca', () => {
  it('returns empty projected array for empty input', () => {
    const result = pca([], 2)
    expect(result.projected).toEqual([])
    expect(result.mean).toEqual([])
    expect(result.std).toEqual([])
  })

  it('reduces 2D data to 1 component', () => {
    const X = [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ]
    const result = pca(X, 1)
    expect(result.projected).toHaveLength(5)
    expect(result.projected[0]).toHaveLength(1)
    expect(result.components).toHaveLength(1)
    expect(result.mean).toHaveLength(2)
    expect(result.std).toHaveLength(2)
  })

  it('reduces high-dim data to 2 components', () => {
    const X = Array.from({ length: 20 }, () => [
      Math.random() * 100,
      Math.random() * 100,
      Math.random() * 100,
      Math.random() * 100,
    ])
    const result = pca(X, 2)
    expect(result.projected).toHaveLength(20)
    expect(result.projected[0]).toHaveLength(2)
    expect(result.components).toHaveLength(2)
  })

  it('produces explained variance ratios that sum to ~1', () => {
    const X = Array.from({ length: 30 }, () => [
      Math.random() * 50,
      Math.random() * 50,
      Math.random() * 50,
    ])
    const result = pca(X, 3)
    const totalVar = result.explainedVariance.reduce((s, v) => s + v, 0)
    expect(totalVar).toBeCloseTo(1, 1)
  })

  it('handles single-dimensional data', () => {
    const X = [[1], [2], [3], [4], [5]]
    const result = pca(X, 1)
    expect(result.projected).toHaveLength(5)
    expect(result.projected[0]).toHaveLength(1)
  })

  it('handles data with zero variance', () => {
    const X = [
      [5, 5],
      [5, 5],
      [5, 5],
    ]
    const result = pca(X, 2)
    expect(result.projected).toHaveLength(3)
    expect(result.projected[0]).toHaveLength(2)
    expect(result.components).toHaveLength(2)
  })

  it('returns proper mean and std for standardization', () => {
    const X = [
      [10, 100],
      [20, 200],
      [30, 300],
    ]
    const result = pca(X, 2)
    expect(result.mean[0]).toBeCloseTo(20, 5)
    expect(result.mean[1]).toBeCloseTo(200, 5)
    expect(result.std[0]).toBeGreaterThan(0)
    expect(result.std[1]).toBeGreaterThan(0)
  })

  it('requesting k larger than dimensions returns k components', () => {
    const X = [
      [1, 2],
      [3, 4],
    ]
    const result = pca(X, 5)
    expect(result.components).toHaveLength(2)
    expect(result.projected[0]).toHaveLength(2)
  })
})
