/**
 * Entity relationship analysis engine for the transaction graph.
 *
 * Computes relationship scores, detects clusters, and ranks addresses
 * based on transaction history.
 */

// ─── Weights for composite score ──────────────────────────────────────────────

const WEIGHTS = {
  frequency: 0.30,
  volume: 0.25,
  recency: 0.20,
  directionality: 0.15,
  diversity: 0.10,
}

const RECENCY_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @param {Array} operations - Array of Stellar OperationRecord objects
 * @param {string} centralAddress - The connected wallet address
 * @returns {RelationshipReport}
 */
export function analyzeRelationships(operations, centralAddress) {
  const relationships = buildRelationships(operations, centralAddress)
  const scored = scoreRelationships(relationships)
  const clusters = detectClusters(scored)
  const rankedNodes = rankNodes(scored, centralAddress)

  return {
    relationships: scored,
    clusters,
    rankedNodes,
    summary: buildSummary(scored, clusters, rankedNodes, centralAddress),
  }
}

/**
 * @param {Array} operations
 * @param {string} addr
 * @returns {RelationshipReport} same shape, filtered for one address
 */
export function getRelationshipsForAddress(operations, addr) {
  const all = buildRelationships(operations, addr)
  const filtered = {}
  for (const [key, rel] of all) {
    if (rel.addressA === addr || rel.addressB === addr) {
      filtered[key] = rel
    }
  }
  const scored = scoreRelationships(new Map(Object.entries(filtered)))
  const clusters = detectClusters(scored)
  const rankedNodes = rankNodes(scored, addr)
  return { relationships: scored, clusters, rankedNodes, summary: buildSummary(scored, clusters, rankedNodes, addr) }
}

// ─── Relationship building ────────────────────────────────────────────────────

function buildRelationships(operations, centralAddress) {
  const relMap = new Map()
  const centralOps = []

  for (const op of operations) {
    const { from, to, source_account } = op
    const pairs = extractPairs(op)

    for (const { a, b, direction } of pairs) {
      if (!a || !b || a === b) continue
      const key = a < b ? `${a}|${b}` : `${b}|${a}`
      if (!relMap.has(key)) {
        relMap.set(key, {
          addressA: a,
          addressB: b,
          txCount: 0,
          types: new Set(),
          totalAmount: 0,
          assetCodes: new Set(),
          firstSeen: op.created_at,
          lastSeen: op.created_at,
          directions: new Set(),
          operations: [],
        })
      }
      const rel = relMap.get(key)
      rel.txCount++
      if (op.type) rel.types.add(op.type)
      if (op.amount) rel.totalAmount += parseFloat(op.amount) || 0
      if (op.asset_code) rel.assetCodes.add(op.asset_code)
      if (op.created_at) {
        if (op.created_at < rel.firstSeen) rel.firstSeen = op.created_at
        if (op.created_at > rel.lastSeen) rel.lastSeen = op.created_at
      }
      if (direction) rel.directions.add(direction)
      rel.operations.push(op)
    }

    if (centralAddress && (from === centralAddress || to === centralAddress || source_account === centralAddress)) {
      centralOps.push(op)
    }
  }

  return relMap
}

function extractPairs(op) {
  const pairs = []
  const { from, to, source_account, account, funder, into } = op

  if (from && to) pairs.push({ a: from, b: to, direction: from === to ? null : 'outgoing' })
  if (source_account && from && source_account !== from) pairs.push({ a: source_account, b: from, direction: 'outgoing' })
  if (source_account && to && source_account !== to) pairs.push({ a: source_account, b: to, direction: 'outgoing' })
  if (account && from && account !== from) pairs.push({ a: account, b: from })
  if (account && to && account !== to) pairs.push({ a: account, b: to })
  if (funder && into) pairs.push({ a: funder, b: into, direction: 'outgoing' })

  return pairs
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreRelationships(relMap) {
  const now = Date.now()
  let maxFreq = 1; let maxVolume = 1

  for (const rel of relMap.values()) {
    if (rel.txCount > maxFreq) maxFreq = rel.txCount
    if (rel.totalAmount > maxVolume) maxVolume = rel.totalAmount
  }

  const results = []
  for (const [key, rel] of relMap) {
    const frequency = rel.txCount / maxFreq
    const volume = Math.min(rel.totalAmount / maxVolume, 1)
    const ageMs = now - new Date(rel.lastSeen).getTime()
    const recency = Math.exp(-Math.log(2) * ageMs / RECENCY_HALF_LIFE_MS)
    const directionality = rel.directions.size >= 2 ? 1 : (rel.directions.size === 1 ? 0.5 : 0)
    const diversity = Math.min(rel.types.size / 5, 1)

    const score =
      WEIGHTS.frequency * frequency +
      WEIGHTS.volume * volume +
      WEIGHTS.recency * recency +
      WEIGHTS.directionality * directionality +
      WEIGHTS.diversity * diversity

    results.push({
      key,
      addressA: rel.addressA,
      addressB: rel.addressB,
      txCount: rel.txCount,
      totalAmount: rel.totalAmount,
      types: Array.from(rel.types),
      assetCodes: Array.from(rel.assetCodes),
      firstSeen: rel.firstSeen,
      lastSeen: rel.lastSeen,
      isBidirectional: rel.directions.size >= 2,
      frequency,
      volume,
      recency,
      directionality,
      diversity,
      score: Math.round(score * 1000) / 1000,
    })
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

// ─── Cluster detection ────────────────────────────────────────────────────────

function detectClusters(relationships) {
  const graph = new Map()

  for (const rel of relationships) {
    if (!graph.has(rel.addressA)) graph.set(rel.addressA, new Set())
    if (!graph.has(rel.addressB)) graph.set(rel.addressB, new Set())
    graph.get(rel.addressA).add(rel.addressB)
    graph.get(rel.addressB).add(rel.addressA)
  }

  const visited = new Set()
  const clusters = []

  for (const [addr] of graph) {
    if (visited.has(addr)) continue
    const cluster = { members: [], internalEdges: [], edgeCount: 0 }
    const queue = [addr]
    visited.add(addr)

    while (queue.length > 0) {
      const current = queue.shift()
      cluster.members.push(current)
      for (const neighbor of graph.get(current) || []) {
        const key = current < neighbor ? `${current}|${neighbor}` : `${neighbor}|${current}`
        const rel = relationships.find((r) => r.key === key)
        if (rel) cluster.internalEdges.push(rel.key)
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    cluster.edgeCount = cluster.internalEdges.length
    cluster.size = cluster.members.length
    clusters.push(cluster)
  }

  clusters.sort((a, b) => b.size - a.size)
  return clusters
}

// ─── Node ranking ─────────────────────────────────────────────────────────────

function rankNodes(relationships, centralAddress) {
  const nodeScores = new Map()

  for (const rel of relationships) {
    for (const addr of [rel.addressA, rel.addressB]) {
      if (!nodeScores.has(addr)) {
        nodeScores.set(addr, { address: addr, totalTx: 0, totalScore: 0, relationshipCount: 0, totalVolume: 0, isCentral: addr === centralAddress })
      }
      const ns = nodeScores.get(addr)
      ns.totalTx += rel.txCount
      ns.totalScore += rel.score
      ns.relationshipCount++
      ns.totalVolume += rel.totalAmount
    }
  }

  const ranked = Array.from(nodeScores.values()).map((n) => ({
    ...n,
    avgScore: n.relationshipCount > 0 ? Math.round((n.totalScore / n.relationshipCount) * 1000) / 1000 : 0,
    importance: Math.round((n.totalTx * 0.4 + n.relationshipCount * 0.3 + (n.totalVolume > 0 ? Math.min(n.totalVolume / 10000, 1) * 0.3 : 0)) * 1000) / 1000,
  }))

  ranked.sort((a, b) => b.importance - a.importance)
  return ranked
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function buildSummary(relationships, clusters, rankedNodes, centralAddress) {
  const highVolume = relationships.filter((r) => r.txCount >= 5)
  const frequent = relationships.filter((r) => r.score >= 0.6)
  const frequentAddrs = new Set()
  frequent.forEach((r) => { frequentAddrs.add(r.addressA); frequentAddrs.add(r.addressB) })
  frequentAddrs.delete(centralAddress)

  const centralNode = rankedNodes.find((n) => n.isCentral)
  return {
    totalRelationships: relationships.length,
    highVolumeCount: highVolume.length,
    frequentCounterparties: frequentAddrs.size,
    clusterCount: clusters.length,
    largestClusterSize: clusters.length > 0 ? clusters[0].size : 0,
    centralRank: centralNode ? rankedNodes.indexOf(centralNode) + 1 : null,
    totalAddresses: rankedNodes.length,
  }
}

export default {
  analyzeRelationships,
  getRelationshipsForAddress,
}
