/**
 * Clustering utilities for anomaly visualisation.
 *
 * Provides k-means++ initialisation and k-means clustering tailored
 * for partitioning anomaly-scores and embedding coordinates.
 */

/**
 * Euclidean distance between two vectors.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function euclidean(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

/**
 * k-means++ initialisation — picks initial centroids that spread
 * across the data.
 *
 * @param {number[][]} data  rows = samples
 * @param {number}     k     number of clusters
 * @returns {number[][]} initial centroids
 */
function kmeansPlusPlusInit(data, k) {
  const n = data.length
  if (n <= k) return data.map((d) => [...d])
  if (k <= 1) return [[...data[Math.floor(Math.random() * n)]]]

  const centroids = []
  centroids.push([...data[Math.floor(Math.random() * n)]])

  const minDist = new Array(n).fill(Infinity)

  for (let c = 1; c < k; c++) {
    let totalDist = 0
    for (let i = 0; i < n; i++) {
      const dist = euclidean(data[i], centroids[c - 1])
      if (dist < minDist[i]) minDist[i] = dist
      totalDist += minDist[i]
    }

    if (totalDist === 0) {
      centroids.push([...data[Math.floor(Math.random() * n)]])
      continue
    }

    const threshold = Math.random() * totalDist
    let cumulative = 0
    for (let i = 0; i < n; i++) {
      cumulative += minDist[i]
      if (cumulative >= threshold) {
        centroids.push([...data[i]])
        break
      }
    }
  }

  return centroids
}

/**
 * Assign each data point to the nearest centroid.
 *
 * @param {number[][]} data
 * @param {number[][]} centroids
 * @returns {{ assignments: number[], distances: number[] }}
 */
function assignClusters(data, centroids) {
  const k = centroids.length
  const assignments = new Array(data.length)
  const distances = new Array(data.length)

  for (let i = 0; i < data.length; i++) {
    let bestDist = Infinity
    let bestIdx = 0
    for (let j = 0; j < k; j++) {
      const dist = euclidean(data[i], centroids[j])
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = j
      }
    }
    assignments[i] = bestIdx
    distances[i] = bestDist
  }

  return { assignments, distances }
}

/**
 * Recompute centroids as the mean of their assigned points.
 *
 * @param {number[][]} data
 * @param {number[]}   assignments  cluster index per point
 * @param {number}     k
 * @returns {number[][]} new centroids
 */
function recomputeCentroids(data, assignments, k) {
  const d = data[0].length
  const centroids = Array.from({ length: k }, () => new Array(d).fill(0))
  const counts = new Array(k).fill(0)

  for (let i = 0; i < data.length; i++) {
    const c = assignments[i]
    counts[c]++
    for (let j = 0; j < d; j++) {
      centroids[c][j] += data[i][j]
    }
  }

  for (let c = 0; c < k; c++) {
    if (counts[c] > 0) {
      for (let j = 0; j < d; j++) {
        centroids[c][j] /= counts[c]
      }
    } else {
      centroids[c] = [...data[Math.floor(Math.random() * data.length)]]
    }
  }

  return centroids
}

/**
 * Compute total within-cluster sum of squared errors (inertia).
 *
 * @param {number[][]} data
 * @param {number[]}   assignments
 * @param {number[][]} centroids
 * @returns {number}
 */
function inertia(data, assignments, centroids) {
  let total = 0
  for (let i = 0; i < data.length; i++) {
    total += euclidean(data[i], centroids[assignments[i]]) ** 2
  }
  return total
}

/**
 * Perform k-means clustering with k-means++ initialisation.
 *
 * @param {number[][]} data  rows = samples
 * @param {number}     k     number of clusters
 * @param {object}     [opts]
 * @param {number}     [opts.maxIter=50]
 * @param {number}     [opts.tolerance=1e-4]
 * @returns {{
 *   clusters: number[][],
 *   assignments: number[],
 *   centroids: number[][],
 *   inertia: number,
 *   iterations: number,
 * }}
 */
export function kmeans(data, k, opts = {}) {
  const { maxIter = 50, tolerance = 1e-4 } = opts

  if (!data || data.length === 0 || k <= 0) {
    return { clusters: [], assignments: [], centroids: [], inertia: 0, iterations: 0 }
  }

  const n = data.length
  const actualK = Math.min(k, n)
  let centroids = kmeansPlusPlusInit(data, actualK)
  let prevAssignments = new Array(n).fill(-1)
  let iteration = 0

  for (; iteration < maxIter; iteration++) {
    const { assignments } = assignClusters(data, centroids)

    const changed = assignments.some((a, i) => a !== prevAssignments[i])
    if (!changed) break
    prevAssignments = assignments

    centroids = recomputeCentroids(data, assignments, actualK)
  }

  const { assignments, distances } = assignClusters(data, centroids)
  const totalInertia = inertia(data, assignments, centroids)

  const clusters = Array.from({ length: actualK }, () => [])
  for (let i = 0; i < n; i++) {
    clusters[assignments[i]].push(i)
  }

  return {
    clusters,
    assignments,
    centroids,
    inertia: totalInertia,
    iterations: iteration + 1,
  }
}

/**
 * Wrapper that determines a good `k` using the elbow method on inertia
 * (max 10 clusters) and then runs k-means with the chosen k.
 *
 * @param {number[][]} data
 * @param {object}     [opts]
 * @param {number}     [opts.maxK=10]
 * @returns {Promise<{
 *   clusters: number[][],
 *   assignments: number[],
 *   centroids: number[][],
 *   inertia: number,
 *   k: number,
 * }>}
 */
export function autoKmeans(data, opts = {}) {
  const { maxK = 10 } = opts
  const n = data.length
  const limit = Math.min(maxK, n)

  if (n <= 1) {
    return {
      clusters: n === 1 ? [[0]] : [],
      assignments: new Array(n).fill(0),
      centroids: n === 1 ? [data[0]] : [],
      inertia: 0,
      k: Math.max(n, 1),
    }
  }

  const inertias = []
  for (let k = 1; k <= limit; k++) {
    const result = kmeans(data, k, { maxIter: 20, tolerance: 1e-3 })
    inertias.push({ k, inertia: result.inertia })
  }

  let bestK = 1
  let maxDrop = 0
  for (let i = 1; i < inertias.length - 1; i++) {
    const prev = inertias[i - 1].inertia
    const curr = inertias[i].inertia
    const next = inertias[i + 1].inertia
    if (prev === 0) continue
    const drop = (prev - curr) / prev
    const nextDrop = (curr - next) / Math.max(curr, 1)
    if (drop - nextDrop > maxDrop) {
      maxDrop = drop - nextDrop
      bestK = inertias[i].k
    }
  }

  const final = kmeans(data, bestK, opts)
  return { ...final, k: bestK }
}

export default { kmeans, autoKmeans }
