const STORAGE_KEY = 'stellar:dashboard:recommendation-data'
const HISTORY_KEY = 'stellar:dashboard:contract-interactions'

function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0
  for (const key in vecA) {
    if (key in vecB) dot += vecA[key] * vecB[key]
    normA += vecA[key] * vecA[key]
  }
  for (const key in vecB) normB += vecB[key] * vecB[key]
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function extractFeatures(functions = []) {
  return functions.map(fn => ({
    name: fn.name,
    tokens: (fn.name + ' ' + (fn.doc || '') + ' ' + (fn.summary || ''))
      .toLowerCase()
      .split(/[^a-zA-Z0-9]+/)
      .filter(t => t.length > 1 && !['the', 'this', 'that', 'with', 'from'].includes(t)),
    paramCount: (fn.parameters || []).length,
    paramTypes: (fn.parameters || []).map(p => p.type),
    returnType: fn.returnType || 'void',
  }))
}

function buildTfIdf(functionFeatures) {
  const docFreq = {}
  const vectors = functionFeatures.map((ff, idx) => {
    const tf = {}
    const tokens = ff.tokens
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1 / tokens.length
    }
    const seen = new Set(tokens)
    for (const token of seen) {
      docFreq[token] = (docFreq[token] || 0) + 1
    }
    return { idx, tf, feature: ff }
  })

  const n = functionFeatures.length
  return vectors.map(({ idx, tf, feature }) => {
    const vec = {}
    for (const token in tf) {
      const idf = Math.log((n + 1) / (docFreq[token] + 1)) + 1
      vec[token] = tf[token] * idf
    }
    return { idx, vec, feature }
  })
}

const COMMON_USE_CASES = {
  token: {
    deployment: ['initialize', 'mint'],
    operations: ['transfer', 'approve', 'balanceOf', 'totalSupply'],
    management: ['setAdmin', 'setFee', 'freeze', 'unfreeze'],
  },
  escrow: {
    deployment: ['initialize'],
    operations: ['fund', 'release', 'approve_milestone', 'refund'],
    management: ['setArbiter', 'extendTimeout', 'cancel'],
  },
  oracle: {
    deployment: ['initialize'],
    operations: ['submit_price', 'latest_price', 'getPrice'],
    management: ['addSigner', 'removeSigner', 'setStalenessThreshold'],
  },
  nft: {
    deployment: ['initialize'],
    operations: ['mint', 'transfer', 'approve', 'balanceOf', 'ownerOf'],
    management: ['setBaseURI', 'setRoyalty', 'burn'],
  },
  dex: {
    deployment: ['initialize'],
    operations: ['createPool', 'swap', 'addLiquidity', 'removeLiquidity'],
    management: ['setFee', 'pause', 'unpause'],
  },
  voting: {
    deployment: ['initialize'],
    operations: ['vote', 'getResult', 'propose'],
    management: ['setQuorum', 'addOption', 'closeVoting'],
  },
}

function inferContractType(functions = []) {
  const names = new Set(functions.map(f => f.name))

  if (names.has('transfer') && names.has('balanceOf') && names.has('mint')) return 'token'
  if (names.has('release') && names.has('fund') && names.has('approve_milestone')) return 'escrow'
  if (names.has('latest_price') && names.has('submit_price')) return 'oracle'
  if (names.has('ownerOf') && names.has('tokenURI')) return 'nft'
  if (names.has('createPool') && names.has('swap') && names.has('addLiquidity')) return 'dex'
  if (names.has('vote') && names.has('propose') && names.has('getResult')) return 'voting'

  return 'general'
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { interactions: [], feedback: [], userProfile: {} }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-500)))
  } catch {}
}

let recData = loadData()

export function recordInteraction({
  contractId,
  functionName,
  args = [],
  sourceAccount,
  network,
  status = 'simulated',
  duration = 0,
}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    contractId,
    functionName,
    args,
    sourceAccount,
    network,
    status,
    duration,
    timestamp: Date.now(),
  }

  const history = loadHistory()
  history.unshift(entry)
  saveHistory(history)

  recData.interactions.unshift({
    functionName,
    contractId,
    network,
    timestamp: Date.now(),
  })
  recData.interactions = recData.interactions.slice(-200)

  const profile = recData.userProfile
  profile[functionName] = (profile[functionName] || 0) + 1
  if (!profile._contracts) profile._contracts = {}
  profile._contracts[contractId] = (profile._contracts[contractId] || 0) + 1

  saveData(recData)
  return entry
}

export function recordFeedback(recommendationId, helpful, actualFunction) {
  recData.feedback.push({
    recommendationId,
    helpful,
    actualFunction,
    timestamp: Date.now(),
  })
  recData.feedback = recData.feedback.slice(-200)
  saveData(recData)
}

export function getInteractionHistory(limit = 50) {
  return loadHistory().slice(0, limit)
}

export function clearInteractionHistory() {
  recData = { interactions: [], feedback: [], userProfile: {} }
  saveData(recData)
  saveHistory([])
}

export function getRecommendations({
  contractFunctions = [],
  contractId = '',
  currentFunction = '',
  network = 'testnet',
  context = 'operations',
  count = 5,
} = {}) {
  const functions = Array.isArray(contractFunctions) ? contractFunctions : [];
  if (functions.length === 0) return []

  const profile = recData.userProfile
  const history = loadHistory()
  const functionNames = functions.map(f => f.name)
  const featureVectors = buildTfIdf(extractFeatures(functions))
  const contractType = inferContractType(functions)

  const useCaseRecs = COMMON_USE_CASES[contractType]?.[context] || []
  const scoreMap = {}

  for (let i = 0; i < functions.length; i++) {
    const fn = functions[i]
    const name = fn.name
    let score = 0
    const reasons = []

    if (currentFunction && name === currentFunction) {
      score -= 10
      reasons.push('Currently active function')
    }

    const usageCount = profile[name] || 0
    if (usageCount > 0) {
      score += Math.min(usageCount * 2, 15)
      reasons.push(`Used ${usageCount} time(s)`)
    }

    const recentCount = history.filter(h => h.functionName === name).length
    if (recentCount > 0) {
      score += Math.min(recentCount * 3, 10)
      reasons.push(`Recently invoked`)
    }

    if (functions.length > 1) {
      for (let j = 0; j < functions.length; j++) {
        if (i !== j && functions[j].name === currentFunction) {
          const sim = cosineSimilarity(featureVectors[i].vec, featureVectors[j].vec)
          score += sim * 5
          if (sim > 0.3) reasons.push(`Related to "${currentFunction}"`)
        }
      }
    }

    if (useCaseRecs.includes(name)) {
      score += 8
      reasons.push(`Common ${contractType} ${context} function`)
    }

    if (fn.returnType && fn.returnType !== 'void') {
      score += 2
    }

    const feedbackHits = recData.feedback.filter(f => f.actualFunction === name && f.helpful)
    if (feedbackHits.length > 0) {
      score += Math.min(feedbackHits.length * 3, 10)
      reasons.push(`Recommended by feedback`)
    }

    scoreMap[name] = { score, reasons, featureVec: featureVectors[i] }
  }

  const sorted = Object.entries(scoreMap)
    .filter(([name]) => name !== currentFunction)
    .sort((a, b) => b[1].score - a[1].score)

  return sorted.slice(0, count).map(([name, data]) => {
    const fn = functions.find(f => f.name === name)
    const confidence = Math.min(Math.max((data.score + 10) / 30, 0), 1)

    return {
      functionName: name,
      score: Math.round(data.score * 10) / 10,
      confidence,
      reasons: [...new Set(data.reasons)],
      explanation: generateExplanation(name, data, contractType, context),
      signature: fn?.signature || fn?.name || name,
      parameters: fn?.parameters || [],
      returnType: fn?.returnType || 'void',
      id: `rec-${name}-${Date.now()}`,
      contractType,
    }
  })
}

function generateExplanation(name, data, contractType, context) {
  const parts = []
  if (data.score > 15) parts.push('Strong match')
  else if (data.score > 8) parts.push('Good match')
  else parts.push('Potential match')

  if (contractType !== 'general') {
    parts.push(`for ${contractType} contracts`)
  }

  if (data.reasons.length > 0) {
    parts.push('— ' + data.reasons.slice(0, 2).join(', '))
  }

  return parts.join(' ')
}

export function getPopularFunctions(contractId, network = 'testnet') {
  const history = loadHistory()
  const filtered = contractId
    ? history.filter(h => h.contractId === contractId)
    : history
  const counts = {}
  for (const entry of filtered) {
    counts[entry.functionName] = (counts[entry.functionName] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ functionName: name, count }))
}

export function getFeedbackStats() {
  const total = recData.feedback.length
  const helpful = recData.feedback.filter(f => f.helpful).length
  return {
    total,
    helpful,
    helpfulRate: total > 0 ? Math.round((helpful / total) * 100) : 0,
  }
}

export function getRecommendationQuality() {
  const history = loadHistory()
  if (history.length < 5) return { accuracy: 0, sampleSize: history.length, status: 'learning' }

  let hits = 0
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]
    const curr = history[i]
    if (prev.contractId === curr.contractId) {
      const fnNames = [...new Set(history.slice(i + 1).filter(h => h.contractId === curr.contractId).map(h => h.functionName))]
      if (fnNames.includes(curr.functionName)) hits++
    }
  }

  const accuracy = history.length > 1 ? hits / (history.length - 1) : 0
  return {
    accuracy: Math.round(accuracy * 100),
    sampleSize: history.length,
    status: accuracy >= 0.8 ? 'high' : accuracy >= 0.5 ? 'medium' : 'learning',
  }
}
