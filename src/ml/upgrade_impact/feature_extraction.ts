/**
 * Feature extraction for contract upgrade impact prediction.
 * Transforms raw contract diff data into numerical feature vectors
 * that can be consumed by the TFJS model.
 */

export function extractFeatures(changes = [], spec = null) {
  if (!changes || changes.length === 0) {
    return getDefaultFeatures()
  }

  const breaking = changes.filter(c => c.category === 'breaking')
  const nonBreaking = changes.filter(c => c.category === 'non-breaking')
  const functionChanges = changes.filter(c => c.path && c.path[0] === 'functions')
  const typeChanges = changes.filter(c => c.path && c.path[0] === 'customTypes')
  const errorChanges = changes.filter(c => c.path && c.path[0] === 'errorTypes')

  const changeKinds = changes.map(c => c.kind)
  const kindCounts = {}
  for (const kind of changeKinds) {
    kindCounts[kind] = (kindCounts[kind] || 0) + 1
  }

  const features = {
    totalChanges: changes.length,
    breakingCount: breaking.length,
    nonBreakingCount: nonBreaking.length,
    breakingRatio: changes.length > 0 ? breaking.length / changes.length : 0,
    functionRemovedCount: kindCounts['function-removed'] || 0,
    functionAddedCount: kindCounts['function-added'] || 0,
    parameterRemovedCount: kindCounts['parameter-removed'] || 0,
    parameterAddedCount: kindCounts['parameter-added'] || 0,
    parameterTypeChangedCount: kindCounts['parameter-type-changed'] || 0,
    returnTypeChangedCount: kindCounts['return-type-changed'] || 0,
    functionRenamedCount: kindCounts['function-renamed'] || 0,
    errorChangesCount: errorChanges.length,
    typeChangesCount: typeChanges.length,
    uniqueFunctionsAffected: new Set(functionChanges.map(c => c.path && c.path[1])).size,
    averageImpactScore: changes.reduce((sum, c) => sum + (c.impactScore || 0), 0) / Math.max(changes.length, 1),
    maxImpactScore: Math.max(...changes.map(c => c.impactScore || 0), 0),
    hasRemovedFunctions: (kindCounts['function-removed'] || 0) > 0 ? 1 : 0,
    hasRenamedFunctions: (kindCounts['function-renamed'] || 0) > 0 ? 1 : 0,
    hasReturnTypeChanges: (kindCounts['return-type-changed'] || 0) > 0 ? 1 : 0,
    hasParameterTypeChanges: (kindCounts['parameter-type-changed'] || 0) > 0 ? 1 : 0,
    apiSurfaceChange: functionChanges.length / Math.max((spec?.functions?.length || 1), 1),
  }

  Object.assign(features, getDefaultFeatures())

  for (const key of Object.keys(kindCounts)) {
    if (key in features) {
      features[key] = kindCounts[key]
    }
  }

  return features
}

export function getDefaultFeatures() {
  return {
    totalChanges: 0,
    breakingCount: 0,
    nonBreakingCount: 0,
    breakingRatio: 0,
    functionRemovedCount: 0,
    functionAddedCount: 0,
    parameterRemovedCount: 0,
    parameterAddedCount: 0,
    parameterTypeChangedCount: 0,
    returnTypeChangedCount: 0,
    functionRenamedCount: 0,
    errorChangesCount: 0,
    typeChangesCount: 0,
    uniqueFunctionsAffected: 0,
    averageImpactScore: 0,
    maxImpactScore: 0,
    hasRemovedFunctions: 0,
    hasRenamedFunctions: 0,
    hasReturnTypeChanges: 0,
    hasParameterTypeChanges: 0,
    apiSurfaceChange: 0,
  }
}

export function featureVector(features) {
  return [
    features.totalChanges,
    features.breakingCount,
    features.nonBreakingCount,
    features.breakingRatio,
    features.functionRemovedCount,
    features.functionAddedCount,
    features.parameterRemovedCount,
    features.parameterAddedCount,
    features.parameterTypeChangedCount,
    features.returnTypeChangedCount,
    features.functionRenamedCount,
    features.errorChangesCount,
    features.typeChangesCount,
    features.uniqueFunctionsAffected,
    features.averageImpactScore,
    features.maxImpactScore,
    features.hasRemovedFunctions,
    features.hasRenamedFunctions,
    features.hasReturnTypeChanges,
    features.hasParameterTypeChanges,
    features.apiSurfaceChange,
  ]
}

export const FEATURE_NAMES = [
  'totalChanges',
  'breakingCount',
  'nonBreakingCount',
  'breakingRatio',
  'functionRemovedCount',
  'functionAddedCount',
  'parameterRemovedCount',
  'parameterAddedCount',
  'parameterTypeChangedCount',
  'returnTypeChangedCount',
  'functionRenamedCount',
  'errorChangesCount',
  'typeChangesCount',
  'uniqueFunctionsAffected',
  'averageImpactScore',
  'maxImpactScore',
  'hasRemovedFunctions',
  'hasRenamedFunctions',
  'hasReturnTypeChanges',
  'hasParameterTypeChanges',
  'apiSurfaceChange',
]
