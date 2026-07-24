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

export function getWorkflowSuggestions(contractId) {
  const history = loadHistory()
  const contractHistory = history
    .filter(h => h.contractId === contractId && h.status !== 'error')
    .reverse()

  const transitions = {}
  for (let i = 0; i < contractHistory.length - 1; i++) {
    const current = contractHistory[i].functionName
    const next = contractHistory[i + 1].functionName
    if (!transitions[current]) transitions[current] = {}
    transitions[current][next] = (transitions[current][next] || 0) + 1
  }
  return transitions
}

export function getParameterSuggestions(contractId, functionName, parameterDefinitions = []) {
  const history = loadHistory()
  const successfulCalls = history.filter(
    h => h.contractId === contractId &&
         h.functionName === functionName &&
         (h.status === 'success' || h.status === 'simulated')
  )

  const suggestions = {}

  parameterDefinitions.forEach(param => {
    const name = param.name
    const type = param.type

    const values = []
    successfulCalls.forEach(call => {
      let val = undefined
      if (Array.isArray(call.args)) {
        const found = call.args.find(a => a && (a.name === name || a.paramName === name))
        if (found) {
          val = found.value
        } else {
          const idx = parameterDefinitions.indexOf(param)
          if (idx !== -1 && call.args[idx]) {
            const argItem = call.args[idx]
            val = typeof argItem === 'object' && argItem !== null ? argItem.value : argItem
          }
        }
      } else if (call.args && typeof call.args === 'object') {
        val = call.args[name]
      }

      if (val !== undefined && val !== null && String(val).trim() !== '') {
        values.push(val)
      }
    })

    if (values.length > 0) {
      const counts = {}
      values.forEach(v => {
        const str = String(v)
        counts[str] = (counts[str] || 0) + 1
      })

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
      const topValue = sorted[0][0]
      const count = sorted[0][1]
      const confidence = count / values.length

      suggestions[name] = {
        value: topValue,
        confidence: Math.round(confidence * 100) / 100,
        explanation: `Matches your most frequent value (${count}/${values.length} successful calls).`,
        historyCount: values.length
      }
    } else {
      let fallbackVal = ''
      const lowerType = String(type).toLowerCase()
      if (lowerType.includes('bool')) fallbackVal = 'false'
      else if (['int', 'u32', 'i32', 'u64', 'i64', 'u128', 'i128', 'u256', 'i256'].some(t => lowerType.includes(t))) fallbackVal = '0'

      suggestions[name] = {
        value: fallbackVal,
        confidence: 0,
        explanation: 'Default value recommendation (no historical pattern found).',
        historyCount: 0
      }
    }
  })

  return suggestions
}

export function detectParameterAnomalies({
  contractId,
  functionName,
  args = [],
  parameterDefinitions = []
}) {
  const anomalies = []
  const history = loadHistory()

  const argsMap = {}
  args.forEach(arg => {
    if (arg && arg.name) {
      argsMap[arg.name] = arg
    }
  })

  parameterDefinitions.forEach(param => {
    const name = param.name
    const type = param.type
    const arg = argsMap[name]
    const isRequired = param.required !== false

    if (!arg || arg.value === undefined || arg.value === null || String(arg.value).trim() === '') {
      if (isRequired) {
        anomalies.push({
          parameterName: name,
          severity: 'error',
          message: `Parameter "${name}" is required but missing.`,
          type: 'missing'
        })
      }
      return
    }

    const valStr = String(arg.value).trim()
    const lowerType = String(type).toLowerCase()

    if (lowerType.includes('bool')) {
      if (valStr !== 'true' && valStr !== 'false') {
        anomalies.push({
          parameterName: name,
          severity: 'error',
          message: `Value "${valStr}" is not a valid boolean. Expected "true" or "false".`,
          type: 'type_mismatch'
        })
      }
    } else if (
      ['int', 'u32', 'i32', 'u64', 'i64', 'u128', 'i128', 'u256', 'i256'].some(t => lowerType.includes(t))
    ) {
      try {
        BigInt(valStr)
      } catch {
        anomalies.push({
          parameterName: name,
          severity: 'error',
          message: `Value "${valStr}" is not a valid integer. Expected a numeric string or number.`,
          type: 'type_mismatch'
        })
      }
    } else if (lowerType.includes('address')) {
      const isValidStellarAddress = /^[G|C][A-D0-9]{55}$/.test(valStr)
      if (!isValidStellarAddress) {
        anomalies.push({
          parameterName: name,
          severity: 'error',
          message: `Value "${valStr}" is not a valid Stellar Address (must be 56 characters starting with G or C).`,
          type: 'type_mismatch'
        })
      }
    }

    const successfulCalls = history.filter(
      h => h.contractId === contractId &&
           h.functionName === functionName &&
           (h.status === 'success' || h.status === 'simulated')
    )

    const pastValues = []
    successfulCalls.forEach(call => {
      let val = undefined
      if (Array.isArray(call.args)) {
        const found = call.args.find(a => a && (a.name === name || a.paramName === name))
        if (found) val = found.value
      } else if (call.args && typeof call.args === 'object') {
        val = call.args[name]
      }
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        pastValues.push(val)
      }
    })

    if (pastValues.length > 0) {
      if (['int', 'u32', 'i32', 'u64', 'i64', 'u128', 'i128', 'u256', 'i256'].some(t => lowerType.includes(t))) {
        try {
          const numVal = Number(BigInt(valStr))
          const numPastVals = pastValues.map(v => Number(BigInt(v))).filter(v => !isNaN(v))

          if (numPastVals.length > 0) {
            const maxVal = Math.max(...numPastVals)
            const minVal = Math.min(...numPastVals)

            if (numVal < 0 && minVal >= 0) {
              anomalies.push({
                parameterName: name,
                severity: 'warning',
                message: `Unusual negative value (${numVal}). Successful past invocations only used non-negative values.`,
                type: 'out_of_bounds'
              })
            }

            if (maxVal > 0 && numVal > maxVal * 10) {
              anomalies.push({
                parameterName: name,
                severity: 'warning',
                message: `Unusually large value (${numVal}). More than 10x your previous maximum successful value (${maxVal}).`,
                type: 'out_of_bounds'
              })
            }
          }
        } catch {}
      }

      if (lowerType.includes('address')) {
        const hasBeenUsed = pastValues.some(v => String(v).toLowerCase() === valStr.toLowerCase())
        if (!hasBeenUsed) {
          anomalies.push({
            parameterName: name,
            severity: 'warning',
            message: `This address (${valStr.slice(0, 8)}...) has not been used with this contract in your past interactions.`,
            type: 'novel_address'
          })
        }
      }
    }
  })

  const transitions = getWorkflowSuggestions(contractId)
  const lastInteraction = history.find(h => h.contractId === contractId)
  const lastFunction = lastInteraction ? lastInteraction.functionName : null

  if (lastFunction && transitions[lastFunction]) {
    const transitionCounts = transitions[lastFunction]
    const totalTrans = Object.values(transitionCounts).reduce((a, b) => a + b, 0)
    const callCount = transitionCounts[functionName] || 0
    const prob = callCount / totalTrans

    if (totalTrans >= 2 && prob === 0) {
      anomalies.push({
        severity: 'warning',
        message: `Unusual calling sequence: "${functionName}" has never followed "${lastFunction}" in your previous workflows.`,
        type: 'sequence_anomaly'
      })
    }
  }

  return anomalies
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
  const featureVectors = buildTfIdf(extractFeatures(functions))
  const contractType = inferContractType(functions)

  const useCaseRecs = COMMON_USE_CASES[contractType]?.[context] || []
  const scoreMap = {}

  const transitions = getWorkflowSuggestions(contractId)
  const lastInteraction = history.find(h => h.contractId === contractId)
  const lastFunction = lastInteraction ? lastInteraction.functionName : null

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

    if (lastFunction && transitions[lastFunction] && transitions[lastFunction][name]) {
      const transCount = transitions[lastFunction][name]
      const totalTrans = Object.values(transitions[lastFunction]).reduce((a, b) => a + b, 0)
      const prob = transCount / totalTrans
      if (prob > 0.25) {
        score += prob * 12
        reasons.push(`Suggested next step (${Math.round(prob * 100)}% workflow probability)`)
      }
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
