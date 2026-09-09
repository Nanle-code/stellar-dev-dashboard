function normalizeAbiEntry(entry) {
  if (!entry || entry.type !== 'function') return null
  const inputs = (entry.inputs || []).map(input => `${input.name || 'arg'}:${input.type || 'unknown'}`).join(',')
  const outputs = (entry.outputs || []).map(output => output.type || 'unknown').join(',')
  return `${entry.name || 'unknown'}(${inputs})=>(${outputs})`
}

function safeNumericValue(raw) {
  if (typeof raw === 'boolean') return raw ? 1 : 0
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

function compareFunctions(previousAbi = [], currentAbi = []) {
  const previousFunctions = new Map()
  const currentFunctions = new Map()

  previousAbi.forEach(entry => {
    if (entry.type === 'function') {
      const name = entry.name || 'unknown'
      previousFunctions.set(name, (previousFunctions.get(name) || []).concat(entry))
    }
  })

  currentAbi.forEach(entry => {
    if (entry.type === 'function') {
      const name = entry.name || 'unknown'
      currentFunctions.set(name, (currentFunctions.get(name) || []).concat(entry))
    }
  })

  const changes = []

  previousFunctions.forEach((entries, name) => {
    const currentEntries = currentFunctions.get(name) || []
    if (!currentEntries.length) {
      changes.push({
        type: 'removedFunction',
        name,
        severity: 'high',
        description: `Function ${name} is no longer available in the upgraded contract.`,
      })
      return
    }

    const normalizedCurrent = new Set(currentEntries.map(normalizeAbiEntry))
    entries.forEach((entry) => {
      const prevSig = normalizeAbiEntry(entry)
      if (prevSig && !normalizedCurrent.has(prevSig)) {
        changes.push({
          type: 'functionSignatureChange',
          name,
          severity: 'high',
          description: `Function ${name} changed its signature between versions.`,
        })
      }
    })
  })

  currentFunctions.forEach((entries, name) => {
    if (!previousFunctions.has(name)) {
      entries.forEach(() => {
        changes.push({
          type: 'addedFunction',
          name,
          severity: 'low',
          description: `Function ${name} was added in the upgraded contract.`,
        })
      })
      return
    }

    const normalizedPrevious = new Set(previousFunctions.get(name).map(normalizeAbiEntry))
    entries.forEach((entry) => {
      const nextSig = normalizeAbiEntry(entry)
      if (nextSig && !normalizedPrevious.has(nextSig)) {
        changes.push({
          type: 'addedFunction',
          name,
          severity: 'low',
          description: `Function ${name} has a new overload or signature in the upgraded contract.`,
        })
      }
    })
  })

  return changes
}

function compareEvents(previousAbi = [], currentAbi = []) {
  const previousEvents = new Map((previousAbi || []).filter(entry => entry.type === 'event').map(entry => [entry.name, entry]))
  const currentEvents = new Map((currentAbi || []).filter(entry => entry.type === 'event').map(entry => [entry.name, entry]))

  const changes = []

  previousEvents.forEach((entry, name) => {
    if (!currentEvents.has(name)) {
      changes.push({
        type: 'eventChange',
        name,
        severity: 'medium',
        description: `Event ${name} was removed or renamed.`,
      })
      return
    }

    const prevInputs = (entry.inputs || []).map(input => `${input.name || 'arg'}:${input.type || 'unknown'}`).join(',')
    const nextInputs = (currentEvents.get(name).inputs || []).map(input => `${input.name || 'arg'}:${input.type || 'unknown'}`).join(',')
    if (prevInputs !== nextInputs) {
      changes.push({
        type: 'eventChange',
        name,
        severity: 'medium',
        description: `Event ${name} changed its payload structure.`,
      })
    }
  })

  currentEvents.forEach((entry, name) => {
    if (!previousEvents.has(name)) {
      changes.push({
        type: 'addedEvent',
        name,
        severity: 'low',
        description: `Event ${name} was added in the upgraded contract.`,
      })
    }
  })

  return changes
}

function compareBytecode(previousBytecode = '', currentBytecode = '') {
  const normalize = raw => String(raw || '').replace(/^0x/i, '').trim().toLowerCase()
  const prev = normalize(previousBytecode)
  const next = normalize(currentBytecode)

  const bytecodeChanged = prev !== next
  const maxLen = Math.max(prev.length, next.length)
  const minLen = Math.min(prev.length, next.length)

  let differingBytes = 0
  for (let index = 0; index < minLen; index += 2) {
    if (prev[index] !== next[index] || prev[index + 1] !== next[index + 1]) {
      differingBytes += 1
    }
  }
  differingBytes += Math.ceil((maxLen - minLen) / 2)

  const diffRatio = maxLen > 0 ? differingBytes / Math.max(1, Math.ceil(maxLen / 2)) : 0

  return {
    bytecodeChanged,
    diffRatio,
    details: {
      previousLength: prev.length,
      currentLength: next.length,
      differingBytes,
      previousBytes: Math.ceil(prev.length / 2),
      currentBytes: Math.ceil(next.length / 2),
    },
  }
}

function buildBreakingChangeList(previousAbi, currentAbi, upgradeHistory = [], previousBytecode, currentBytecode) {
  const bytecodeDiff = compareBytecode(previousBytecode, currentBytecode)
  const changes = [
    ...compareFunctions(previousAbi, currentAbi),
    ...compareEvents(previousAbi, currentAbi),
  ]

  if (bytecodeDiff.bytecodeChanged) {
    changes.push({
      type: 'bytecodeChange',
      name: 'bytecode',
      severity: bytecodeDiff.diffRatio > 0.15 ? 'high' : 'medium',
      description: `Bytecode changed with a diff ratio of ${Math.round(bytecodeDiff.diffRatio * 100)}%.`,
    })
  }

  const historySummary = upgradeHistory[upgradeHistory.length - 1] || {}
  if (historySummary.authChanged) {
    changes.push({
      type: 'authChange',
      name: 'auth',
      severity: 'high',
      description: 'Authorization and capability checks appear to have changed.',
    })
  }

  if (historySummary.stateLayoutChanged) {
    changes.push({
      type: 'stateLayoutChange',
      name: 'storage',
      severity: 'high',
      description: 'Contract storage layout or state schema appears to have changed.',
    })
  }

  return { changes, bytecodeDiff }
}

function scoreCompatibility(breakingChanges, previousBytecode, currentBytecode, upgradeHistory = []) {
  const historySummary = upgradeHistory[upgradeHistory.length - 1] || {}
  let score = 100

  const severityWeights = {
    high: 20,
    medium: 12,
    low: 6,
  }

  breakingChanges.forEach(change => {
    score -= severityWeights[change.severity] || 6
  })

  const prevNormalized = String(previousBytecode || '').replace(/^0x/i, '').trim().toLowerCase()
  const nextNormalized = String(currentBytecode || '').replace(/^0x/i, '').trim().toLowerCase()
  if (prevNormalized !== nextNormalized && (prevNormalized || nextNormalized)) {
    score -= 18
  }

  if (historySummary.bytecodeChanged) {
    score -= 12
  }

  if (historySummary.authChanged) {
    score -= 10
  }

  if (historySummary.stateLayoutChanged) {
    score -= 12
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

function generateMigrationRecommendations(breakingChanges, compatibilityScore) {
  const recommendations = []

  if (breakingChanges.some(change => change.type === 'removedFunction')) {
    recommendations.push({
      priority: 'high',
      action: 'Introduce a compatibility shim or adapter layer for removed entry points before rolling out the upgrade.',
      rationale: 'Clients still calling removed functions will fail until a wrapper or proxy preserves the old interface.',
    })
  }

  if (breakingChanges.some(change => change.type === 'functionSignatureChange')) {
    recommendations.push({
      priority: 'high',
      action: 'Update client integrations to the new signatures and provide a temporary wrapper so existing callers can migrate safely.',
      rationale: 'Signature drift breaks existing call sites even when the function names remain the same.',
    })
  }

  if (breakingChanges.some(change => change.type === 'eventChange')) {
    recommendations.push({
      priority: 'medium',
      action: 'Rebuild downstream event consumers and dashboards to match the new payload schema.',
      rationale: 'Event consumers often fail silently when payload names or types change.',
    })
  }

  if (breakingChanges.some(change => change.type === 'stateLayoutChange')) {
    recommendations.push({
      priority: 'high',
      action: 'Map state schema changes and migrate storage carefully with compatibility shims where possible.',
      rationale: 'State layout changes can corrupt persisted contract data if clients assume the old schema.',
    })
  }

  if (breakingChanges.some(change => change.type === 'authChange')) {
    recommendations.push({
      priority: 'high',
      action: 'Review authorization policy changes and update capability checks for user and integration workflows.',
      rationale: 'Changed auth semantics can block existing integrations or allow unauthorized access.',
    })
  }

  if (compatibilityScore < 70) {
    recommendations.push({
      priority: 'high',
      action: 'Run a staged rollout with compatibility checks, canary deployment, and a rollback plan for integrators.',
      rationale: 'Low compatibility scores indicate a high probability of user-facing breakage.',
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      action: 'Document the upgrade and monitor post-deploy telemetry for regressions.',
      rationale: 'No critical breaking changes were detected.',
    })
  }

  return recommendations
}

function calculatePredictionScore(features, model) {
  const intercept = model && model.baseline != null ? Number(model.baseline) : 0.2
  let score = intercept
  const featureWeights = model?.weights || {}

  Object.entries(featureWeights).forEach(([key, weight]) => {
    const value = safeNumericValue(features[key])
    score += Number(weight || 0) * value
  })

  return Math.max(0, Math.min(1, score))
}

function normalizeTrainingSamples(samples) {
  const means = Array(samples[0].length).fill(0)
  const variances = Array(samples[0].length).fill(0)

  samples.forEach((sample) => {
    sample.forEach((value, index) => {
      means[index] += value
    })
  })

  const count = samples.length
  for (let index = 0; index < means.length; index += 1) {
    means[index] /= count
  }

  samples.forEach((sample) => {
    sample.forEach((value, index) => {
      variances[index] += (value - means[index]) ** 2
    })
  })

  const stdev = variances.map((variance) => Math.sqrt(variance / Math.max(1, count - 1)))
  return { means, stdev }
}

function trainRegressionModel(history) {
  const featureKeys = [
    'breakingChangeCount',
    'removedFunctionCount',
    'signatureChangeCount',
    'eventChangeCount',
    'bytecodeChanged',
    'bytecodeChangeRatio',
    'stateLayoutChanged',
    'authChanged',
  ]

  const samples = []
  const targets = []

  history.forEach((item) => {
    const source = item.features || item
    const sample = featureKeys.map((key) => {
      return key === 'bytecodeChanged' || key === 'stateLayoutChanged' || key === 'authChanged'
        ? safeNumericValue(source[key])
        : safeNumericValue(source[key])
    })

    samples.push(sample)
    targets.push(safeNumericValue(item.impactScore))
  })

  if (!samples.length) {
    return null
  }

  const { means, stdev } = normalizeTrainingSamples(samples)
  const normalizedSamples = samples.map((sample) => sample.map((value, index) => {
    const deviation = stdev[index] || 1
    return deviation === 0 ? 0 : (value - means[index]) / deviation
  }))

  let weights = Array(featureKeys.length).fill(0)
  let bias = history.reduce((sum, item) => sum + safeNumericValue(item.impactScore), 0) / history.length
  const learningRate = 0.035
  const epochs = Math.min(600, 400 + history.length * 20)

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradients = Array(featureKeys.length).fill(0)
    let biasGradient = 0

    normalizedSamples.forEach((sample, sampleIndex) => {
      const predicted = sample.reduce((acc, value, index) => acc + value * weights[index], bias)
      const error = predicted - targets[sampleIndex]
      biasGradient += error
      sample.forEach((value, index) => {
        gradients[index] += error * value
      })
    })

    const scale = learningRate / normalizedSamples.length
    bias -= biasGradient * scale
    weights = weights.map((weight, index) => weight - gradients[index] * scale)
  }

  const fittedWeights = {}
  featureKeys.forEach((key, index) => {
    fittedWeights[key] = stdev[index] === 0 ? 0 : weights[index] / stdev[index]
  })

  let intercept = bias
  featureKeys.forEach((key, index) => {
    intercept -= fittedWeights[key] * means[index]
  })

  return { intercept, weights: fittedWeights }
}

export function trainCompatibilityModel(history = []) {
  const defaultWeights = {
    breakingChangeCount: 0.12,
    removedFunctionCount: 0.16,
    signatureChangeCount: 0.14,
    eventChangeCount: 0.08,
    bytecodeChanged: 0.14,
    bytecodeChangeRatio: 0.05,
    stateLayoutChanged: 0.16,
    authChanged: 0.1,
  }

  if (!history.length) {
    return { weights: defaultWeights, baseline: 0.2 }
  }

  const model = trainRegressionModel(history)
  if (model) {
    return {
      weights: model.weights,
      baseline: Math.max(0.1, Math.min(0.9, Number(model.intercept) || 0.2)),
    }
  }

  const averageImpact = history.reduce((sum, item) => sum + (item.impactScore || 0), 0) / history.length
  return { weights: defaultWeights, baseline: Math.max(0.1, Math.min(0.9, averageImpact)) }
}

export function predictImpact(model, features = {}) {
  const score = calculatePredictionScore(features, model)
  let level = 'low'
  if (score >= 0.8) level = 'critical'
  else if (score >= 0.6) level = 'high'
  else if (score >= 0.35) level = 'medium'

  const confidence = Math.min(0.99, 0.58 + score * 0.3 + (Math.abs(score - (model.baseline || 0.2)) * 0.05))
  return { score, level, confidence }
}

export function analyzeContractUpgrade(input = {}) {
  const startedAt = Date.now()
  const previousAbi = input.previousAbi || []
  const currentAbi = input.currentAbi || []
  const upgradeHistory = input.upgradeHistory || []

  const { changes: breakingChanges, bytecodeDiff } = buildBreakingChangeList(
    previousAbi,
    currentAbi,
    upgradeHistory,
    input.previousBytecode,
    input.currentBytecode,
  )

  const compatibilityScore = scoreCompatibility(
    breakingChanges,
    input.previousBytecode,
    input.currentBytecode,
    upgradeHistory,
  )

  const impactModel = trainCompatibilityModel(upgradeHistory)
  const impactPrediction = predictImpact(impactModel, {
    breakingChangeCount: breakingChanges.filter(change => change.severity !== 'low').length,
    removedFunctionCount: breakingChanges.filter(change => change.type === 'removedFunction').length,
    signatureChangeCount: breakingChanges.filter(change => change.type === 'functionSignatureChange').length,
    eventChangeCount: breakingChanges.filter(change => change.type === 'eventChange').length,
    bytecodeChanged: Number(Boolean(bytecodeDiff.bytecodeChanged)),
    bytecodeChangeRatio: Number(bytecodeDiff.diffRatio || 0),
    stateLayoutChanged: Number(Boolean(upgradeHistory[upgradeHistory.length - 1]?.stateLayoutChanged)),
    authChanged: Number(Boolean(upgradeHistory[upgradeHistory.length - 1]?.authChanged)),
  })

  return {
    breakingChanges,
    compatibilityScore,
    impactPrediction,
    migrationRecommendations: generateMigrationRecommendations(breakingChanges, compatibilityScore),
    analysisSummary: {
      bytecodeDiff,
      functionCount: {
        previous: previousAbi.filter(entry => entry.type === 'function').length,
        current: currentAbi.filter(entry => entry.type === 'function').length,
      },
      eventCount: {
        previous: previousAbi.filter(entry => entry.type === 'event').length,
        current: currentAbi.filter(entry => entry.type === 'event').length,
      },
    },
    performanceMs: Date.now() - startedAt,
  }
}
