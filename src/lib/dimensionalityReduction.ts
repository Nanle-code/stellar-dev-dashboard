/**
 * Dimensionality reduction utilities for anomaly visualization.
 *
 * Provides PCA (Principal Component Analysis) to project
 * high-dimensional feature vectors into 2D space for scatter-plot
 * rendering.
 */

/**
 * Standardise (z-score) a matrix in-place so each column has
 * mean ~0 and std ~1.
 *
 * @param {number[][]} X  rows = samples, cols = features
 * @returns {{ centred: number[][], mean: number[], std: number[] }}
 */
function standardise(X) {
  if (!X || X.length === 0 || X[0].length === 0) {
    return { centred: X || [], mean: [], std: [] }
  }

  const n = X.length
  const d = X[0].length
  const mean = new Array(d).fill(0)
  const std = new Array(d).fill(0)

  for (let j = 0; j < d; j++) {
    let sum = 0
    for (let i = 0; i < n; i++) sum += X[i][j]
    mean[j] = sum / n
  }

  for (let j = 0; j < d; j++) {
    let sq = 0
    for (let i = 0; i < n; i++) {
      const dev = X[i][j] - mean[j]
      sq += dev * dev
    }
    std[j] = Math.sqrt(sq / Math.max(n - 1, 1)) || 1
  }

  const centred = X.map((row) => row.map((v, j) => (v - mean[j]) / std[j]))

  return { centred, mean, std }
}

/**
 * Compute the covariance matrix of a column-centred matrix.
 *
 * @param {number[][]} X  n x d already centred
 * @returns {number[][]} d x d covariance matrix
 */
function covarianceMatrix(X) {
  const n = X.length
  const d = X[0].length
  const cov = Array.from({ length: d }, () => new Array(d).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      for (let k = j; k < d; k++) {
        cov[j][k] += X[i][j] * X[i][k]
      }
    }
  }

  for (let j = 0; j < d; j++) {
    for (let k = j; k < d; k++) {
      cov[j][k] /= Math.max(n - 1, 1)
      cov[k][j] = cov[j][k]
    }
  }

  return cov
}

/**
 * Power iteration to find the dominant eigenvector of a symmetric matrix.
 *
 * @param {number[][]} A  d x d symmetric matrix
 * @param {number} [maxIter=100]
 * @returns {{ eigenvalue: number, eigenvector: number[] }}
 */
function powerIteration(A, maxIter = 100) {
  const d = A.length
  let v = Array.from({ length: d }, () => Math.random() * 2 - 1)
  let eigenvalue = 0

  for (let iter = 0; iter < maxIter; iter++) {
    const Av = new Array(d).fill(0)
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        Av[i] += A[i][j] * v[j]
      }
    }

    const norm = Math.sqrt(Av.reduce((s, x) => s + x * x, 0))
    if (norm === 0) break
    for (let i = 0; i < d; i++) v[i] = Av[i] / norm

    eigenvalue = Av.reduce((s, x, i) => s + x * v[i], 0)
  }

  return { eigenvalue, eigenvector: v }
}

/**
 * Deflate a symmetric matrix to remove the contribution of a known eigenpair.
 *
 * @param {number[][]} A
 * @param {number} eigenvalue
 * @param {number[]} eigenvector
 * @returns {number[][]} deflated matrix
 */
function deflate(A, eigenvalue, eigenvector) {
  const d = A.length
  const result = Array.from({ length: d }, (_, i) => {
    const row = new Array(d)
    for (let j = 0; j < d; j++) {
      row[j] = A[i][j] - eigenvalue * eigenvector[i] * eigenvector[j]
    }
    return row
  })
  return result
}

/**
 * Perform PCA on the given data matrix, reducing to `k` dimensions.
 *
 * Uses the power iteration method to extract the top-k eigenvectors
 * from the covariance matrix.  Data is standardised (z-scored) first.
 *
 * @param {number[][]} X  rows = samples, cols = features
 * @param {number}      [k=2]  number of principal components
 * @returns {{
 *   projected: number[][],
 *   explainedVariance: number[],
 *   components: number[][],
 *   mean: number[],
 *   std: number[],
 * }}
 */
export function pca(X, k = 2) {
  const { centred, mean, std } = standardise(X)
  const n = centred.length
  if (n === 0 || centred[0].length === 0) {
    return { projected: [], explainedVariance: [], components: [], mean, std }
  }

  const cov = covarianceMatrix(centred)
  const d = cov.length
  const actualK = Math.min(k, d)

  const components = []
  const explainedVariance = []
  let residual = cov

  for (let pc = 0; pc < actualK; pc++) {
    const { eigenvalue, eigenvector } = powerIteration(residual)
    components.push(eigenvector)
    explainedVariance.push(eigenvalue)
    residual = deflate(residual, eigenvalue, eigenvector)
  }

  const totalVar = explainedVariance.reduce((s, v) => s + v, 0)
  const explainedRatio = totalVar > 0
    ? explainedVariance.map((v) => v / totalVar)
    : explainedVariance.map(() => 0)

  const projected = centred.map((row) =>
    components.map((comp) => row.reduce((sum, val, j) => sum + val * comp[j], 0))
  )

  return { projected, explainedVariance: explainedRatio, components, mean, std }
}

export default { pca }
