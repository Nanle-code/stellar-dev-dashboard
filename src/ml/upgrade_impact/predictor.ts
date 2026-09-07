import { extractFeatures, featureVector, getDefaultFeatures } from './feature_extraction.js'

let model = null
let modelLoaded = false
let trainingData = []
const HISTORY_KEY = 'upgrade_impact_history'

function getHistory() {
  try {
    const raw = localStorage ? localStorage.getItem(HISTORY_KEY) : null
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveHistory(history) {
  try {
    if (localStorage) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-200)))
    }
  } catch {}
}

export function predictImpact(changes, spec = null) {
  const features = extractFeatures(changes, spec)
  const vector = featureVector(features)

  let mlScore = null
  if (model && modelLoaded) {
    try {
      const input = tf.tensor2d([vector])
      const prediction = model.predict(input)
      mlScore = prediction.dataSync()[0]
      input.dispose()
      prediction.dispose()
    } catch {
      mlScore = null
    }
  }

  const heuristicScore = computeHeuristicScore(features)
  const historyScore = computeHistoryScore(features)
  const history = getHistory()

  const mlWeight = mlScore !== null ? 0.5 : 0
  const heuristicWeight = 0.4
  const historyWeight = history.length > 5 ? 0.1 : 0

  const totalWeight = mlWeight + heuristicWeight + historyWeight
  const normalizedWeight = totalWeight > 0 ? totalWeight : 1

  const combinedScore = (
    (mlScore || 0) * mlWeight +
    heuristicScore * heuristicWeight +
    historyScore * historyWeight
  ) / normalizedWeight

  return {
    breakingProbability: Number(combinedScore.toFixed(4)),
    severity: classifySeverity(combinedScore),
    migrationEffort: classifyEffort(combinedScore, features),
    estimatedAffectedFunctions: features.uniqueFunctionsAffected,
    riskFactors: identifyRiskFactors(features),
    confidence: Number((mlScore !== null ? 0.85 : 0.7).toFixed(2)),
    mlPrediction: mlScore,
    heuristicScore,
    historyScore,
    features,
  }
}

function computeHeuristicScore(features) {
  let score = 0
  const weights = {
    breakingRatio: 0.25,
    functionRemovedCount: 0.15,
    functionRenamedCount: 0.12,
    parameterRemovedCount: 0.1,
    parameterTypeChangedCount: 0.1,
    returnTypeChangedCount: 0.08,
    averageImpactScore: 0.1,
    hasRemovedFunctions: 0.05,
    hasRenamedFunctions: 0.05,
  }

  for (const [key, weight] of Object.entries(weights)) {
    const value = features[key] || 0
    score += Math.min(value * weight, weight)
  }

  if (features.breakingCount === 0) score *= 0.3

  return Math.min(1, Math.max(0, score))
}

function computeHistoryScore(features) {
  const history = getHistory()
  if (history.length < 3) return 0.3

  const similar = history.filter(entry => {
    const diff = Math.abs(entry.breakingCount - features.breakingCount)
    return diff <= 2
  })

  if (similar.length === 0) return 0.3

  const avgImpact = similar.reduce((sum, e) => sum + (e.actualImpactScore || 0.5), 0) / similar.length
  return avgImpact
}

function classifySeverity(score) {
  if (score >= 0.8) return 'critical'
  if (score >= 0.5) return 'high'
  if (score >= 0.25) return 'medium'
  if (score >= 0.05) return 'low'
  return 'none'
}

function classifyEffort(score, features) {
  const hasCriticalChanges = features.functionRemovedCount > 0 || features.functionRenamedCount > 0
  if (score >= 0.7 || hasCriticalChanges) return 'major'
  if (score >= 0.4) return 'significant'
  if (score >= 0.15) return 'moderate'
  return 'trivial'
}

function identifyRiskFactors(features) {
  const factors = []

  if (features.functionRemovedCount > 0) {
    factors.push({
      name: 'Function Removals',
      severity: features.functionRemovedCount > 2 ? 'high' : 'medium',
      description: `${features.functionRemovedCount} function(s) removed from the API surface`,
    })
  }

  if (features.functionRenamedCount > 0) {
    factors.push({
      name: 'Function Renames',
      severity: features.functionRenamedCount > 1 ? 'high' : 'medium',
      description: `${features.functionRenamedCount} function(s) renamed`,
    })
  }

  if (features.parameterTypeChangedCount > 0) {
    factors.push({
      name: 'Parameter Type Changes',
      severity: 'medium',
      description: `${features.parameterTypeChangedCount} parameter type(s) changed`,
    })
  }

  if (features.returnTypeChangedCount > 0) {
    factors.push({
      name: 'Return Type Changes',
      severity: 'medium',
      description: `${features.returnTypeChangedCount} return type(s) changed`,
    })
  }

  if (features.breakingRatio > 0.5) {
    factors.push({
      name: 'High Breaking Ratio',
      severity: 'high',
      description: `${Math.round(features.breakingRatio * 100)}% of changes are breaking`,
    })
  }

  return factors
}

export function recordFeedback(changes, spec, actualSeverity, actualImpactScore) {
  const features = extractFeatures(changes, spec)
  const history = getHistory()

  history.push({
    timestamp: Date.now(),
    features: featureVector(features),
    breakingCount: features.breakingCount,
    totalChanges: features.totalChanges,
    actualSeverity,
    actualImpactScore,
  })

  saveHistory(history)
  trainingData = history

  return { recorded: true, totalRecords: history.length }
}

export async function trainModel(tf) {
  const history = getHistory()
  if (history.length < 10) {
    return { trained: false, reason: 'Insufficient data', samples: history.length, minRequired: 10 }
  }

  const inputs = []
  const labels = []

  for (const entry of history) {
    if (entry.features && entry.actualImpactScore !== undefined) {
      inputs.push(entry.features)
      labels.push([entry.actualImpactScore])
    }
  }

  if (inputs.length < 10) {
    return { trained: false, reason: 'Insufficient valid samples', samples: inputs.length, minRequired: 10 }
  }

  const inputTensor = tf.tensor2d(inputs)
  const labelTensor = tf.tensor2d(labels)

  model = tf.sequential()
  model.add(tf.layers.dense({
    inputShape: [inputs[0].length],
    units: 16,
    activation: 'relu',
  }))
  model.add(tf.layers.dropout({ rate: 0.3 }))
  model.add(tf.layers.dense({ units: 8, activation: 'relu' }))
  model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }))

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  })

  await model.fit(inputTensor, labelTensor, {
    epochs: 50,
    batchSize: 8,
    shuffle: true,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0) {
          console.log(`[upgrade_impact] Epoch ${epoch + 1}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}`)
        }
      },
    },
  })

  inputTensor.dispose()
  labelTensor.dispose()
  modelLoaded = true

  return { trained: true, samples: inputs.length, epochs: 50 }
}

export function getModelStatus() {
  const history = getHistory()
  return {
    modelLoaded,
    trainingSamples: history.length,
    status: modelLoaded ? 'ready' : history.length >= 10 ? 'needs-training' : 'collecting-data',
  }
}

export function resetModel() {
  model = null
  modelLoaded = false
  trainingData = []
  try {
    if (localStorage) localStorage.removeItem(HISTORY_KEY)
  } catch {}
  return { reset: true }
}
