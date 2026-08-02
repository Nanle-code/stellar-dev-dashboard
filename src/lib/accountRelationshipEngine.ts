import { dbscan } from './transactionPatternAnalysis'

export type RelationshipType = 'business' | 'personal' | 'exchange' | 'defi' | 'unknown'

export interface RelationshipTypeClassification {
  type: RelationshipType
  confidence: number
  reasons: string[]
}

export interface RelationshipFeatures {
  txCount: number
  totalAmount: number
  uniqueAssetCount: number
  isBidirectional: boolean
  avgAmount: number
  amountStdDev: number
  daySpread: number
  hourStdDev: number
  memoRatio: number
  hasContractOps: boolean
  hasPathPayments: boolean
  hasManageOffer: boolean
  hasCreateAccount: boolean
}

export interface EnhancedRelationship {
  key: string
  addressA: string
  addressB: string
  txCount: number
  totalAmount: number
  types: string[]
  assetCodes: string[]
  firstSeen: string
  lastSeen: string
  isBidirectional: boolean
  frequency: number
  volume: number
  recency: number
  directionality: number
  diversity: number
  score: number
  classification: RelationshipTypeClassification
  features: RelationshipFeatures
  annotation?: RelationshipAnnotation
}

export interface RelationshipAnnotation {
  type: RelationshipType
  note: string
  timestamp: number
}

export interface EnhancedRankedNode {
  address: string
  totalTx: number
  totalScore: number
  relationshipCount: number
  totalVolume: number
  isCentral: boolean
  avgScore: number
  importance: number
  betweennessCentrality: number
  communityId: number
}

export interface EnhancedCluster {
  size: number
  edgeCount: number
  members: string[]
  communityId: number
  dominantType: RelationshipType
  density: number
}

export interface EnhancedSummary {
  totalRelationships: number
  highVolumeCount: number
  frequentCounterparties: number
  clusterCount: number
  largestClusterSize: number
  centralRank: number | null
  totalAddresses: number
  typeBreakdown: Record<RelationshipType, number>
  aiConfidence: number
}

export interface EnhancedRelationshipReport {
  relationships: EnhancedRelationship[]
  clusters: EnhancedCluster[]
  rankedNodes: EnhancedRankedNode[]
  summary: EnhancedSummary
}

const WEIGHTS = {
  frequency: 0.25,
  volume: 0.20,
  recency: 0.20,
  directionality: 0.15,
  diversity: 0.10,
  aiConfidence: 0.10,
}

const RECENCY_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000

const ANNOTATIONS_STORAGE_KEY = 'stellar_relationship_annotations'

function loadAnnotations(): Map<string, RelationshipAnnotation> {
  try {
    const raw = localStorage.getItem(ANNOTATIONS_STORAGE_KEY)
    if (raw) return new Map(Object.entries(JSON.parse(raw)))
  } catch {}
  return new Map()
}

function saveAnnotations(annotations: Map<string, RelationshipAnnotation>): void {
  try {
    localStorage.setItem(ANNOTATIONS_STORAGE_KEY, JSON.stringify(Object.fromEntries(annotations)))
  } catch {}
}

export function saveAnnotation(relKey: string, annotation: RelationshipAnnotation): void {
  const annotations = loadAnnotations()
  annotations.set(relKey, annotation)
  saveAnnotations(annotations)
}

export function removeAnnotation(relKey: string): void {
  const annotations = loadAnnotations()
  annotations.delete(relKey)
  saveAnnotations(annotations)
}

export function getAnnotation(relKey: string): RelationshipAnnotation | undefined {
  return loadAnnotations().get(relKey)
}

function extractFeatures(
  rel: { txCount: number; totalAmount: number; assetCodes: string[]; directions: Set<string>; operations: any[]; firstSeen: string; lastSeen: string },
): RelationshipFeatures {
  const amounts = rel.operations
    .map((op) => parseFloat(op.amount) || 0)
    .filter((a) => a > 0)

  const avgAmount = amounts.length > 0 ? amounts.reduce((s, a) => s + a, 0) / amounts.length : 0
  const amountVariance = amounts.length > 0
    ? amounts.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / amounts.length
    : 0
  const amountStdDev = Math.sqrt(amountVariance)

  const timestamps = rel.operations
    .map((op) => new Date(op.created_at).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b)

  const daySpread = timestamps.length > 1
    ? (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24)
    : 0

  const hours = timestamps.map((t) => new Date(t).getUTCHours())
  const avgHour = hours.length > 0 ? hours.reduce((s, h) => s + h, 0) / hours.length : 0
  const hourVariance = hours.length > 0
    ? hours.reduce((s, h) => s + Math.pow(h - avgHour, 2), 0) / hours.length
    : 0
  const hourStdDev = Math.sqrt(hourVariance)

  const memoCount = rel.operations.filter((op) => op.memo && op.memo.trim()).length
  const memoRatio = rel.operations.length > 0 ? memoCount / rel.operations.length : 0

  const opTypes = new Set(rel.operations.map((op) => op.type))
  const hasContractOps = opTypes.has('invoke_host_function') || opTypes.has('extend_footprint_ttl')
  const hasPathPayments = opTypes.has('path_payment_strict_send') || opTypes.has('path_payment_strict_receive')
  const hasManageOffer = opTypes.has('manage_sell_offer') || opTypes.has('manage_buy_offer')
  const hasCreateAccount = opTypes.has('create_account')

  return {
    txCount: rel.txCount,
    totalAmount: rel.totalAmount,
    uniqueAssetCount: rel.assetCodes.size,
    isBidirectional: rel.directions.size >= 2,
    avgAmount,
    amountStdDev,
    daySpread,
    hourStdDev,
    memoRatio,
    hasContractOps,
    hasPathPayments,
    hasManageOffer,
    hasCreateAccount,
  }
}

function classifyRelationship(features: RelationshipFeatures): RelationshipTypeClassification {
  const scores: { type: RelationshipType; score: number; reasons: string[] }[] = []

  const businessScore: { score: number; reasons: string[] } = { score: 0, reasons: [] }
  if (features.isBidirectional && features.avgAmount >= 50) {
    businessScore.score += 0.35
    businessScore.reasons.push('bidirectional with significant value')
  }
  if (features.memoRatio > 0.5 && features.txCount >= 3) {
    businessScore.score += 0.3
    businessScore.reasons.push('high memo usage suggests structured communication')
  }
  if (features.amountStdDev > features.avgAmount * 2) {
    businessScore.score += 0.15
    businessScore.reasons.push('high amount variance typical of business flows')
  }
  if (features.daySpread > 60) {
    businessScore.score += 0.2
    businessScore.reasons.push('long-term relationship')
  }
  scores.push({ type: 'business', score: Math.min(businessScore.score, 1), reasons: businessScore.reasons })

  const personalScore: { score: number; reasons: string[] } = { score: 0, reasons: [] }
  if (features.isBidirectional && features.avgAmount < 200) {
    personalScore.score += 0.35
    personalScore.reasons.push('moderate bidirectional transfers')
  }
  if (features.hasCreateAccount) {
    personalScore.score += 0.15
    personalScore.reasons.push('account creation suggests personal onboarding')
  }
  if (!features.hasContractOps && !features.hasManageOffer && features.uniqueAssetCount <= 2) {
    personalScore.score += 0.25
    personalScore.reasons.push('simple transfers without complex operations')
  }
  if (features.hourStdDev > 6) {
    personalScore.score += 0.15
    personalScore.reasons.push('irregular timing typical of personal transactions')
  }
  scores.push({ type: 'personal', score: Math.min(personalScore.score, 1), reasons: personalScore.reasons })

  const exchangeScore: { score: number; reasons: string[] } = { score: 0, reasons: [] }
  if (features.txCount >= 10 && features.totalAmount >= 10000) {
    exchangeScore.score += 0.4
    exchangeScore.reasons.push('high transaction volume with large amounts')
  }
  if (features.uniqueAssetCount >= 3) {
    exchangeScore.score += 0.25
    exchangeScore.reasons.push('diverse asset usage')
  }
  if (features.amountStdDev > features.avgAmount * 3) {
    exchangeScore.score += 0.2
    exchangeScore.reasons.push('extreme amount variance')
  }
  if (features.hasPathPayments) {
    exchangeScore.score += 0.15
    exchangeScore.reasons.push('path payments typical of exchange flows')
  }
  scores.push({ type: 'exchange', score: Math.min(exchangeScore.score, 1), reasons: exchangeScore.reasons })

  const defiScore: { score: number; reasons: string[] } = { score: 0, reasons: [] }
  if (features.hasContractOps) {
    defiScore.score += 0.4
    defiScore.reasons.push('contract invocation operations')
  }
  if (features.hasManageOffer) {
    defiScore.score += 0.3
    defiScore.reasons.push('offer management operations')
  }
  if (features.hasPathPayments) {
    defiScore.score += 0.2
    defiScore.reasons.push('path payment operations')
  }
  if (features.hasContractOps && features.txCount >= 5) {
    defiScore.score += 0.1
    defiScore.reasons.push('frequent contract interaction')
  }
  scores.push({ type: 'defi', score: Math.min(defiScore.score, 1), reasons: defiScore.reasons })

  scores.push({
    type: 'unknown',
    score: scores.every((s) => s.score < 0.3) ? 0.6 : 0.1,
    reasons: ['no strong pattern detected'],
  })

  scores.sort((a, b) => b.score - a.score)
  const top = scores[0]
  const second = scores[1]
  const margin = top.score - second.score
  const confidence = margin > 0.3 ? 0.9 : margin > 0.15 ? 0.7 : 0.5

  return {
    type: top.type,
    confidence: Math.round(confidence * 100) / 100,
    reasons: top.reasons,
  }
}

function buildRelationships(operations: any[], _centralAddress: string): Map<string, any> {
  const relMap = new Map()

  for (const op of operations) {
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
  }

  return relMap
}

function extractPairs(op: any): { a: string; b: string; direction: string | null }[] {
  const pairs: { a: string; b: string; direction: string | null }[] = []
  const { from, to, source_account, account, funder, into } = op

  if (from && to) pairs.push({ a: from, b: to, direction: from === to ? null : 'outgoing' })
  if (source_account && from && source_account !== from) pairs.push({ a: source_account, b: from, direction: 'outgoing' })
  if (source_account && to && source_account !== to) pairs.push({ a: source_account, b: to, direction: 'outgoing' })
  if (account && from && account !== from) pairs.push({ a: account, b: from, direction: null })
  if (account && to && account !== to) pairs.push({ a: account, b: to, direction: null })
  if (funder && into) pairs.push({ a: funder, b: into, direction: 'outgoing' })

  return pairs
}

function computeBetweennessCentrality(nodes: EnhancedRankedNode[], relationships: EnhancedRelationship[]): Map<string, number> {
  const centrality = new Map<string, number>()
  const addrSet = new Set(nodes.map((n) => n.address))

  for (const addr of addrSet) {
    centrality.set(addr, 0)
  }

  const addrList = Array.from(addrSet)
  for (let i = 0; i < addrList.length; i++) {
    const s = addrList[i]
    const queue: string[] = [s]
    const visited = new Set<string>([s])
    const paths = new Map<string, string[]>()
    paths.set(s, [s])

    while (queue.length > 0) {
      const current = queue.shift()!
      for (const rel of relationships) {
        const neighbor = rel.addressA === current ? rel.addressB : rel.addressB === current ? rel.addressA : null
        if (!neighbor || visited.has(neighbor)) continue
        visited.add(neighbor)
        const currentPath = paths.get(current) || [current]
        paths.set(neighbor, [...currentPath, neighbor])
        queue.push(neighbor)
      }
    }

    for (const [target, path] of paths) {
      if (target !== s && path.length > 2) {
        for (let k = 1; k < path.length - 1; k++) {
          centrality.set(path[k], (centrality.get(path[k]) || 0) + 1)
        }
      }
    }
  }

  const maxCentrality = Math.max(...Array.from(centrality.values()), 1)
  for (const [addr, val] of centrality) {
    centrality.set(addr, val / maxCentrality)
  }

  return centrality
}

function detectCommunities(relationships: EnhancedRelationship[]): Map<string, number> {
  const addrSet = new Set<string>()
  for (const rel of relationships) {
    addrSet.add(rel.addressA)
    addrSet.add(rel.addressB)
  }
  const addrs = Array.from(addrSet)

  if (addrs.length < 3) {
    const communityMap = new Map<string, number>()
    for (const addr of addrs) communityMap.set(addr, 0)
    return communityMap
  }

  const features: number[][] = []
  for (const addr of addrs) {
    const rels = relationships.filter((r) => r.addressA === addr || r.addressB === addr)
    const avgScore = rels.length > 0 ? rels.reduce((s, r) => s + r.score, 0) / rels.length : 0
    const totalTx = rels.reduce((s, r) => s + r.txCount, 0)
    const types = new Set(rels.flatMap((r) => r.classification.type === 'exchange' ? ['exchange'] :
      r.classification.type === 'business' ? ['business'] :
      r.classification.type === 'defi' ? ['defi'] :
      r.classification.type === 'personal' ? ['personal'] : []))
    const typeDiversity = types.size / 4
    features.push([avgScore, Math.min(totalTx / 100, 1), Math.min(rels.length / 20, 1), typeDiversity])
  }

  const { labels } = dbscan(features, 0.5, 2)
  const communityMap = new Map<string, number>()
  for (let i = 0; i < addrs.length; i++) {
    communityMap.set(addrs[i], labels[i] >= 0 ? labels[i] : -1)
  }

  return communityMap
}

export function analyzeRelationships(
  operations: any[],
  centralAddress: string,
): EnhancedRelationshipReport {
  const annotations = loadAnnotations()
  const rawRelationships = buildRelationships(operations, centralAddress)

  let maxFreq = 1
  let maxVolume = 1
  for (const rel of rawRelationships.values()) {
    if (rel.txCount > maxFreq) maxFreq = rel.txCount
    if (rel.totalAmount > maxVolume) maxVolume = rel.totalAmount
  }

  const now = Date.now()
  const relationships: EnhancedRelationship[] = []

  for (const [key, rel] of rawRelationships) {
    const features = extractFeatures(rel)
    const annotation = annotations.get(key)
    const classification = annotation
      ? { type: annotation.type, confidence: 1, reasons: ['manually annotated'] }
      : classifyRelationship(features)

    const frequency = rel.txCount / maxFreq
    const volume = Math.min(rel.totalAmount / maxVolume, 1)
    const ageMs = now - new Date(rel.lastSeen).getTime()
    const recency = Math.exp(-Math.log(2) * ageMs / RECENCY_HALF_LIFE_MS)
    const directionality = rel.directions.size >= 2 ? 1 : (rel.directions.size === 1 ? 0.5 : 0)
    const diversity = Math.min(rel.types.size / 5, 1)
    const aiConfidence = classification.confidence

    const score =
      WEIGHTS.frequency * frequency +
      WEIGHTS.volume * volume +
      WEIGHTS.recency * recency +
      WEIGHTS.directionality * directionality +
      WEIGHTS.diversity * diversity +
      WEIGHTS.aiConfidence * aiConfidence

    relationships.push({
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
      classification,
      features,
      annotation,
    })
  }

  relationships.sort((a, b) => b.score - a.score)

  const rankedNodes = rankNodes(relationships, centralAddress)
  const betweennessCentrality = computeBetweennessCentrality(rankedNodes, relationships)
  const communityMap = detectCommunities(relationships)

  for (const node of rankedNodes) {
    node.betweennessCentrality = betweennessCentrality.get(node.address) || 0
    node.communityId = communityMap.get(node.address) ?? -1
  }

  const clusters = detectEnhancedClusters(relationships, communityMap, rankedNodes)

  const summary = buildEnhancedSummary(relationships, clusters, rankedNodes, centralAddress)

  return { relationships, clusters, rankedNodes, summary }
}

function rankNodes(relationships: EnhancedRelationship[], centralAddress: string): EnhancedRankedNode[] {
  const nodeScores = new Map<string, EnhancedRankedNode>()

  for (const rel of relationships) {
    for (const addr of [rel.addressA, rel.addressB]) {
      if (!nodeScores.has(addr)) {
        nodeScores.set(addr, {
          address: addr,
          totalTx: 0,
          totalScore: 0,
          relationshipCount: 0,
          totalVolume: 0,
          isCentral: addr === centralAddress,
          avgScore: 0,
          importance: 0,
          betweennessCentrality: 0,
          communityId: -1,
        })
      }
      const ns = nodeScores.get(addr)!
      ns.totalTx += rel.txCount
      ns.totalScore += rel.score
      ns.relationshipCount++
      ns.totalVolume += rel.totalAmount
    }
  }

  const ranked = Array.from(nodeScores.values()).map((n) => ({
    ...n,
    avgScore: n.relationshipCount > 0 ? Math.round((n.totalScore / n.relationshipCount) * 1000) / 1000 : 0,
    importance: Math.round(
      (n.totalTx * 0.3 + n.relationshipCount * 0.25 + (n.totalVolume > 0 ? Math.min(n.totalVolume / 10000, 1) * 0.25 : 0) + 0.2) * 1000,
    ) / 1000,
  }))

  ranked.sort((a, b) => b.importance - a.importance)
  return ranked
}

function detectEnhancedClusters(
  relationships: EnhancedRelationship[],
  communityMap: Map<string, number>,
  _rankedNodes: EnhancedRankedNode[],
): EnhancedCluster[] {
  const communityGroups = new Map<number, { members: Set<string>; edges: Set<string> }>()
  for (const rel of relationships) {
    const cidA = communityMap.get(rel.addressA) ?? -1
    const cidB = communityMap.get(rel.addressB) ?? -1
    const cid = cidA >= 0 ? cidA : cidB >= 0 ? cidB : -1

    if (!communityGroups.has(cid)) {
      communityGroups.set(cid, { members: new Set(), edges: new Set() })
    }
    const group = communityGroups.get(cid)!
    group.members.add(rel.addressA)
    group.members.add(rel.addressB)
    group.edges.add(rel.key)
  }

  const clusters: EnhancedCluster[] = []
  for (const [cid, group] of communityGroups) {
    const clusterRels = relationships.filter((r) => group.edges.has(r.key))
    const typeCounts: Record<string, number> = {}
    for (const rel of clusterRels) {
      typeCounts[rel.classification.type] = (typeCounts[rel.classification.type] || 0) + 1
    }
    const dominantType = (Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown') as RelationshipType
    const possibleEdges = group.members.size * (group.members.size - 1) / 2
    const density = possibleEdges > 0 ? group.edges.size / possibleEdges : 0

    clusters.push({
      size: group.members.size,
      edgeCount: group.edges.size,
      members: Array.from(group.members),
      communityId: cid,
      dominantType,
      density: Math.round(density * 1000) / 1000,
    })
  }

  clusters.sort((a, b) => b.size - a.size)
  return clusters
}

function buildEnhancedSummary(
  relationships: EnhancedRelationship[],
  clusters: EnhancedCluster[],
  rankedNodes: EnhancedRankedNode[],
  centralAddress: string,
): EnhancedSummary {
  const highVolume = relationships.filter((r) => r.txCount >= 5)
  const frequent = relationships.filter((r) => r.score >= 0.6)
  const frequentAddrs = new Set<string>()
  frequent.forEach((r) => { frequentAddrs.add(r.addressA); frequentAddrs.add(r.addressB) })
  frequentAddrs.delete(centralAddress)

  const centralNode = rankedNodes.find((n) => n.isCentral)

  const typeBreakdown: Record<RelationshipType, number> = {
    business: 0,
    personal: 0,
    exchange: 0,
    defi: 0,
    unknown: 0,
  }
  for (const rel of relationships) {
    typeBreakdown[rel.classification.type] = (typeBreakdown[rel.classification.type] || 0) + 1
  }

  const avgConfidence = relationships.length > 0
    ? relationships.reduce((s, r) => s + r.classification.confidence, 0) / relationships.length
    : 0

  const classified = relationships.filter((r) => r.classification.type !== 'unknown').length
  const classificationRate = relationships.length > 0 ? classified / relationships.length : 0

  return {
    totalRelationships: relationships.length,
    highVolumeCount: highVolume.length,
    frequentCounterparties: frequentAddrs.size,
    clusterCount: clusters.length,
    largestClusterSize: clusters.length > 0 ? clusters[0].size : 0,
    centralRank: centralNode ? rankedNodes.indexOf(centralNode) + 1 : null,
    totalAddresses: rankedNodes.length,
    typeBreakdown,
    aiConfidence: Math.round((avgConfidence * 0.6 + classificationRate * 0.4) * 1000) / 1000,
  }
}

export function getRelationshipsForAddress(
  operations: any[],
  addr: string,
): EnhancedRelationshipReport {
  const all = buildRelationships(operations, addr)
  const filtered = new Map<string, any>()
  for (const [key, rel] of all) {
    if (rel.addressA === addr || rel.addressB === addr) {
      filtered.set(key, rel)
    }
  }

  const annotations = loadAnnotations()
  let maxFreq = 1
  let maxVolume = 1
  for (const rel of filtered.values()) {
    if (rel.txCount > maxFreq) maxFreq = rel.txCount
    if (rel.totalAmount > maxVolume) maxVolume = rel.totalAmount
  }

  const now = Date.now()
  const relationships: EnhancedRelationship[] = []

  for (const [key, rel] of filtered) {
    const features = extractFeatures(rel)
    const annotation = annotations.get(key)
    const classification = annotation
      ? { type: annotation.type, confidence: 1, reasons: ['manually annotated'] }
      : classifyRelationship(features)

    const frequency = rel.txCount / maxFreq
    const volume = Math.min(rel.totalAmount / maxVolume, 1)
    const ageMs = now - new Date(rel.lastSeen).getTime()
    const recency = Math.exp(-Math.log(2) * ageMs / RECENCY_HALF_LIFE_MS)
    const directionality = rel.directions.size >= 2 ? 1 : (rel.directions.size === 1 ? 0.5 : 0)
    const diversity = Math.min(rel.types.size / 5, 1)
    const aiConfidence = classification.confidence

    const score =
      WEIGHTS.frequency * frequency +
      WEIGHTS.volume * volume +
      WEIGHTS.recency * recency +
      WEIGHTS.directionality * directionality +
      WEIGHTS.diversity * diversity +
      WEIGHTS.aiConfidence * aiConfidence

    relationships.push({
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
      classification,
      features,
      annotation,
    })
  }

  relationships.sort((a, b) => b.score - a.score)
  const rankedNodes = rankNodes(relationships, addr)
  const communityMap = detectCommunities(relationships)

  for (const node of rankedNodes) {
    node.betweennessCentrality = 0
    node.communityId = communityMap.get(node.address) ?? -1
  }

  const clusters = detectEnhancedClusters(relationships, communityMap, rankedNodes)
  const summary = buildEnhancedSummary(relationships, clusters, rankedNodes, addr)

  return { relationships, clusters, rankedNodes, summary }
}
