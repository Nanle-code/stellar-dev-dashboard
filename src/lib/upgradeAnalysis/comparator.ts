import type { ContractFunction, ContractSpec, ContractChange, ChangeCategory, ChangeKind } from './types'

function describeChange(kind: ChangeKind, name: string, detail: string): string {
  const descriptions: Record<ChangeKind, string> = {
    'function-removed': `Function '${name}' has been removed`,
    'function-added': `New function '${name}' added`,
    'parameter-removed': `Parameter removed from '${name}'`,
    'parameter-added': `New parameter added to '${name}'`,
    'parameter-type-changed': `Parameter type changed in '${name}'`,
    'parameter-required-changed': `Parameter requirement changed in '${name}'`,
    'return-type-changed': `Return type changed for '${name}'`,
    'function-renamed': `Function '${name}' has been renamed`,
    'error-added': `New error type added: ${detail}`,
    'error-removed': `Error type removed: ${detail}`,
    'error-code-changed': `Error code changed for '${detail}'`,
    'custom-type-removed': `Custom type '${name}' removed`,
    'custom-type-added': `New custom type '${name}' added`,
    'custom-type-changed': `Custom type '${name}' changed`,
  }
  return descriptions[kind] || `Change detected in '${name}'`
}

function classifyChange(kind: ChangeKind): ChangeCategory {
  const breakingKinds: Set<ChangeKind> = new Set([
    'function-removed',
    'parameter-removed',
    'parameter-type-changed',
    'return-type-changed',
    'function-renamed',
    'error-removed',
    'error-code-changed',
    'custom-type-removed',
    'custom-type-changed',
  ])
  return breakingKinds.has(kind) ? 'breaking' : 'non-breaking'
}

function computeImpact(kind: ChangeKind): number {
  const impactMap: Record<ChangeKind, number> = {
    'function-removed': 0.95,
    'function-added': 0.1,
    'parameter-removed': 0.85,
    'parameter-added': 0.5,
    'parameter-type-changed': 0.8,
    'parameter-required-changed': 0.7,
    'return-type-changed': 0.75,
    'function-renamed': 0.9,
    'error-added': 0.15,
    'error-removed': 0.6,
    'error-code-changed': 0.7,
    'custom-type-removed': 0.6,
    'custom-type-added': 0.1,
    'custom-type-changed': 0.5,
  }
  return impactMap[kind] ?? 0.5
}

function compareFunctions(
  oldFns: Map<string, ContractFunction>,
  newFns: Map<string, ContractFunction>,
  renameMap: Map<string, string>
): ContractChange[] {
  const changes: ContractChange[] = []

  for (const [name, oldFn] of oldFns) {
    const newName = renameMap.get(name) || name
    const newFn = newFns.get(newName)

    if (!newFn && !renameMap.has(name)) {
      changes.push({
        kind: 'function-removed',
        category: 'breaking',
        description: describeChange('function-removed', name, ''),
        detail: `Function '${name}(${oldFn.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}) -> ${oldFn.returnType}' no longer exists`,
        path: ['functions', name],
        oldValue: oldFn,
        newValue: undefined,
        confidence: 1.0,
        impactScore: computeImpact('function-removed'),
      })
    }

    if (newFn) {
      const paramChanges = compareParameters(oldFn, newFn)
      changes.push(...paramChanges)

      if (oldFn.returnType !== newFn.returnType) {
        changes.push({
          kind: 'return-type-changed',
          category: 'breaking',
          description: describeChange('return-type-changed', name, ''),
          detail: `Return type changed from '${oldFn.returnType}' to '${newFn.returnType}'`,
          path: ['functions', name, 'returnType'],
          oldValue: oldFn.returnType,
          newValue: newFn.returnType,
          confidence: 1.0,
          impactScore: computeImpact('return-type-changed'),
        })
      }
    }
  }

  for (const [name, newFn] of newFns) {
    if (!oldFns.has(name) && ![...renameMap.values()].includes(name)) {
      changes.push({
        kind: 'function-added',
        category: 'non-breaking',
        description: describeChange('function-added', name, ''),
        detail: `New function '${name}(${newFn.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}) -> ${newFn.returnType}' added`,
        path: ['functions', name],
        oldValue: undefined,
        newValue: newFn,
        confidence: 1.0,
        impactScore: computeImpact('function-added'),
      })
    }
  }

  return changes
}

function compareParameters(oldFn: ContractFunction, newFn: ContractFunction): ContractChange[] {
  const changes: ContractChange[] = []
  const oldParams = new Map(oldFn.parameters.map(p => [p.name, p]))
  const newParams = new Map(newFn.parameters.map(p => [p.name, p]))

  for (const [name, oldParam] of oldParams) {
    const newParam = newParams.get(name)
    if (!newParam) {
      changes.push({
        kind: 'parameter-removed',
        category: 'breaking',
        description: describeChange('parameter-removed', oldFn.name, ''),
        detail: `Parameter '${name}: ${oldParam.type}' removed from '${oldFn.name}'`,
        path: ['functions', oldFn.name, 'parameters', name],
        oldValue: oldParam,
        newValue: undefined,
        confidence: 1.0,
        impactScore: computeImpact('parameter-removed'),
      })
    } else {
      if (oldParam.type !== newParam.type) {
        changes.push({
          kind: 'parameter-type-changed',
          category: 'breaking',
          description: describeChange('parameter-type-changed', oldFn.name, ''),
          detail: `Parameter '${name}' type changed from '${oldParam.type}' to '${newParam.type}'`,
          path: ['functions', oldFn.name, 'parameters', name, 'type'],
          oldValue: oldParam.type,
          newValue: newParam.type,
          confidence: 1.0,
          impactScore: computeImpact('parameter-type-changed'),
        })
      }
      if (oldParam.required !== newParam.required) {
        changes.push({
          kind: 'parameter-required-changed',
          category: oldParam.required && !newParam.required ? 'non-breaking' : 'breaking',
          description: describeChange('parameter-required-changed', oldFn.name, ''),
          detail: `Parameter '${name}' required changed from '${oldParam.required}' to '${newParam.required}'`,
          path: ['functions', oldFn.name, 'parameters', name, 'required'],
          oldValue: oldParam.required,
          newValue: newParam.required,
          confidence: 1.0,
          impactScore: computeImpact('parameter-required-changed'),
        })
      }
    }
  }

  for (const [name, newParam] of newParams) {
    if (!oldParams.has(name)) {
      changes.push({
        kind: 'parameter-added',
        category: newParam.required ? 'breaking' : 'non-breaking',
        description: describeChange('parameter-added', oldFn.name, ''),
        detail: `New parameter '${name}: ${newParam.type}' ${newParam.required ? '(required)' : '(optional)'} added to '${oldFn.name}'`,
        path: ['functions', oldFn.name, 'parameters', name],
        oldValue: undefined,
        newValue: newParam,
        confidence: 1.0,
        impactScore: newParam.required ? 0.5 : 0.2,
      })
    }
  }

  return changes
}

function detectRenames(
  oldFns: Map<string, ContractFunction>,
  newFns: Map<string, ContractFunction>
): Map<string, string> {
  const renameMap = new Map<string, string>()
  const oldEntries = [...oldFns.entries()]
  const newEntries = [...newFns.entries()]

  for (const [oldName, oldFn] of oldEntries) {
    if (newFns.has(oldName)) continue
    for (const [newName, newFn] of newEntries) {
      if (oldFns.has(newName)) continue
      if (renameMap.has(oldName) || [...renameMap.values()].includes(newName)) continue

      const similarity = computeFunctionSimilarity(oldFn, newFn)
      if (similarity > 0.85) {
        renameMap.set(oldName, newName)
      }
    }
  }

  return renameMap
}

function computeFunctionSimilarity(a: ContractFunction, b: ContractFunction): number {
  let score = 0
  let total = 0

  if (a.parameters.length === b.parameters.length) { score += 3; total += 3 }
  else { total += 3 }

  const paramTypesA = a.parameters.map(p => p.type).sort().join(',')
  const paramTypesB = b.parameters.map(p => p.type).sort().join(',')
  if (paramTypesA === paramTypesB) { score += 4; total += 4 }
  else { total += 4 }

  if (a.returnType === b.returnType) { score += 2; total += 2 }
  else { total += 2 }

  const aTokens = (a.name + ' ' + (a.doc || '')).toLowerCase().split(/[^a-zA-Z0-9]+/).filter(Boolean)
  const bTokens = (b.name + ' ' + (b.doc || '')).toLowerCase().split(/[^a-zA-Z0-9]+/).filter(Boolean)
  const intersection = aTokens.filter(t => bTokens.includes(t)).length
  const union = new Set([...aTokens, ...bTokens]).size
  if (union > 0) { score += (intersection / union) * 3; total += 3 }
  else { total += 3 }

  return total > 0 ? score / total : 0
}

function compareErrors(
  oldErrors: ContractSpec['errorTypes'],
  newErrors: ContractSpec['errorTypes']
): ContractChange[] {
  const changes: ContractChange[] = []
  const oldMap = new Map(oldErrors.map(e => [e.name, e]))
  const newMap = new Map(newErrors.map(e => [e.name, e]))

  for (const [name, oldErr] of oldMap) {
    const newErr = newMap.get(name)
    if (!newErr) {
      changes.push({
        kind: 'error-removed',
        category: 'breaking',
        description: describeChange('error-removed', name, name),
        detail: `Error type '${name}' (code ${oldErr.code}) has been removed`,
        path: ['errorTypes', name],
        oldValue: oldErr,
        newValue: undefined,
        confidence: 0.9,
        impactScore: computeImpact('error-removed'),
      })
    } else if (oldErr.code !== newErr.code) {
      changes.push({
        kind: 'error-code-changed',
        category: 'breaking',
        description: describeChange('error-code-changed', name, name),
        detail: `Error '${name}' code changed from ${oldErr.code} to ${newErr.code}`,
        path: ['errorTypes', name, 'code'],
        oldValue: oldErr.code,
        newValue: newErr.code,
        confidence: 0.95,
        impactScore: computeImpact('error-code-changed'),
      })
    }
  }

  for (const [name, newErr] of newMap) {
    if (!oldMap.has(name)) {
      changes.push({
        kind: 'error-added',
        category: 'non-breaking',
        description: describeChange('error-added', name, name),
        detail: `New error type '${name}' (code ${newErr.code}) added`,
        path: ['errorTypes', name],
        oldValue: undefined,
        newValue: newErr,
        confidence: 1.0,
        impactScore: computeImpact('error-added'),
      })
    }
  }

  return changes
}

function compareCustomTypes(
  oldTypes: ContractSpec['customTypes'],
  newTypes: ContractSpec['customTypes']
): ContractChange[] {
  const changes: ContractChange[] = []
  const oldMap = new Map(oldTypes.map(t => [t.name, t]))
  const newMap = new Map(newTypes.map(t => [t.name, t]))

  for (const [name, oldType] of oldMap) {
    const newType = newMap.get(name)
    if (!newType) {
      changes.push({
        kind: 'custom-type-removed',
        category: 'breaking',
        description: describeChange('custom-type-removed', name, ''),
        detail: `Custom type '${name}' (${oldType.summary}) has been removed`,
        path: ['customTypes', name],
        oldValue: oldType,
        newValue: undefined,
        confidence: 0.95,
        impactScore: computeImpact('custom-type-removed'),
      })
    } else if (oldType.summary !== newType.summary) {
      changes.push({
        kind: 'custom-type-changed',
        category: 'breaking',
        description: describeChange('custom-type-changed', name, ''),
        detail: `Custom type '${name}' changed from '${oldType.summary}' to '${newType.summary}'`,
        path: ['customTypes', name, 'summary'],
        oldValue: oldType.summary,
        newValue: newType.summary,
        confidence: 0.85,
        impactScore: computeImpact('custom-type-changed'),
      })
    }
  }

  for (const [name, newType] of newMap) {
    if (!oldMap.has(name)) {
      changes.push({
        kind: 'custom-type-added',
        category: 'non-breaking',
        description: describeChange('custom-type-added', name, ''),
        detail: `New custom type '${name}' (${newType.summary}) added`,
        path: ['customTypes', name],
        oldValue: undefined,
        newValue: newType,
        confidence: 1.0,
        impactScore: computeImpact('custom-type-added'),
      })
    }
  }

  return changes
}

export function compareContractSpecs(
  oldSpec: ContractSpec,
  newSpec: ContractSpec,
  contractId: string = '',
  oldVersion: string = 'old',
  newVersion: string = 'new'
): {
  changes: ContractChange[]
  breakingCount: number
  nonBreakingCount: number
} {
  const oldFns = new Map(oldSpec.functions.map(f => [f.name, f]))
  const newFns = new Map(newSpec.functions.map(f => [f.name, f]))

  const renameMap = detectRenames(oldFns, newFns)
  const functionChanges = compareFunctions(oldFns, newFns, renameMap)
  const errorChanges = compareErrors(oldSpec.errorTypes, newSpec.errorTypes)
  const typeChanges = compareCustomTypes(oldSpec.customTypes, newSpec.customTypes)

  const allChanges = [...functionChanges, ...errorChanges, ...typeChanges]

  const renameChanges: ContractChange[] = []
  for (const [oldName, newName] of renameMap) {
    renameChanges.push({
      kind: 'function-renamed',
      category: 'breaking',
      description: describeChange('function-renamed', oldName, ''),
      detail: `Function '${oldName}' renamed to '${newName}'`,
      path: ['functions', oldName],
      oldValue: oldName,
      newValue: newName,
      confidence: 0.9,
      impactScore: computeImpact('function-renamed'),
    })
  }

  allChanges.push(...renameChanges)

  const breakingCount = allChanges.filter(c => c.category === 'breaking').length
  const nonBreakingCount = allChanges.filter(c => c.category === 'non-breaking').length

  return { changes: allChanges, breakingCount, nonBreakingCount }
}

export function compareBytecode(oldWasm: Uint8Array | string, newWasm: Uint8Array | string): {
  sizeDelta: number
  checksumChanged: boolean
} {
  const oldBytes = typeof oldWasm === 'string' ? new TextEncoder().encode(oldWasm) : oldWasm
  const newBytes = typeof newWasm === 'string' ? new TextEncoder().encode(newWasm) : newWasm

  const sizeDelta = newBytes.length - oldBytes.length

  let oldHash = 0
  for (let i = 0; i < oldBytes.length; i++) {
    oldHash = ((oldHash << 5) - oldHash) + oldBytes[i]
    oldHash |= 0
  }

  let newHash = 0
  for (let i = 0; i < newBytes.length; i++) {
    newHash = ((newHash << 5) - newHash) + newBytes[i]
    newHash |= 0
  }

  return {
    sizeDelta,
    checksumChanged: oldHash !== newHash,
  }
}

export function detectBreakingChanges(spec: ContractSpec, changes: ContractChange[]): ContractChange[] {
  return changes.filter(c => c.category === 'breaking')
}

export function analyzeChangePatterns(changes: ContractChange[]): {
  removedFunctions: string[]
  newFunctions: string[]
  changedSignatures: string[]
  typeChanges: string[]
} {
  const result = {
    removedFunctions: [] as string[],
    newFunctions: [] as string[],
    changedSignatures: [] as string[],
    typeChanges: [] as string[],
  }

  for (const change of changes) {
    if (change.kind === 'function-removed') result.removedFunctions.push(change.path[1])
    if (change.kind === 'function-added') result.newFunctions.push(change.path[1])
    if (['parameter-removed', 'parameter-added', 'parameter-type-changed', 'return-type-changed', 'function-renamed'].includes(change.kind)) {
      result.changedSignatures.push(change.path[1])
    }
    if (['custom-type-removed', 'custom-type-added', 'custom-type-changed'].includes(change.kind)) {
      result.typeChanges.push(change.path[1])
    }
  }

  return result
}
