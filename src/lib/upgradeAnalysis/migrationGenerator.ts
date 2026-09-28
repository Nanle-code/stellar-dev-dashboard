import type { ContractChange, MigrationRecommendation, ContractSpec } from './types'
import { analyzeChangePatterns } from './comparator'

const MIGRATION_TEMPLATES: Record<string, { title: string; steps: string[]; example: string }> = {
  'function-removed': {
    title: 'Replace removed function calls',
    steps: [
      'Identify all usages of the removed function in your codebase',
      'Check the new contract spec for replacement functions',
      'Update function calls to use the new API',
      'Test all affected code paths',
    ],
    example: '// Before\ncontract.call("oldFunction", args)\n// After\ncontract.call("newFunction", args)',
  },
  'parameter-added': {
    title: 'Update function calls with new parameters',
    steps: [
      'Review the new parameter type and purpose',
      'Update all call sites to include the new parameter',
      'Validate parameter values match the expected format',
    ],
    example: '// Before\ncontract.call("transfer", [to, amount])\n// After\ncontract.call("transfer", [to, amount, memo])',
  },
  'parameter-removed': {
    title: 'Remove deprecated parameters',
    steps: [
      'Remove the deprecated parameter from all call sites',
      'Verify no logic depends on the removed parameter',
      'Update any encoding/decoding logic',
    ],
    example: '// Before\ncontract.call("transfer", [from, to, amount])\n// After\ncontract.call("transfer", [to, amount])',
  },
  'parameter-type-changed': {
    title: 'Update parameter types',
    steps: [
      'Identify the type change in the contract spec',
      'Update argument serialization to match new type',
      'Validate values are within the new type range',
    ],
    example: '// Before: passing u32\ncontract.call("setLimit", [1000])\n// After: passing i128\ncontract.call("setLimit", ["1000"])',
  },
  'return-type-changed': {
    title: 'Handle changed return types',
    steps: [
      'Update return value parsing logic',
      'Check for type coercion requirements',
      'Update any type assertions or validations',
    ],
    example: '// Before: returns u32\nconst result = contract.call("balance", [addr])\n// After: returns i128\nconst result = contract.call("balance", [addr])',
  },
  'function-renamed': {
    title: 'Update renamed function references',
    steps: [
      'Replace all references to the old function name',
      'Update any ABI encoding references',
      'Check documentation and comments for old name',
    ],
    example: '// Before\ncontract.call("getInfo", [])\n// After\ncontract.call("getMetadata", [])',
  },
  'error-removed': {
    title: 'Remove error type handling',
    steps: [
      'Remove catch blocks for the removed error type',
      'Update error handling logic',
      'Verify no code references the removed error',
    ],
    example: '// Remove error handling for removed error type\ntry {\n  await contract.call("fn")\n} catch (e) {\n  // Remove: if (e.code === 123) ...\n}',
  },
  'error-code-changed': {
    title: 'Update error code references',
    steps: [
      'Update all error code checks to use new codes',
      'Update error type mappings',
      'Verify error handling still works correctly',
    ],
    example: '// Before\nif (error.code === 1) { /* handle */ }\n// After\nif (error.code === 2) { /* handle */ }',
  },
  'custom-type-changed': {
    title: 'Update custom type references',
    steps: [
      'Review the custom type definition changes',
      'Update any serialization/deserialization code',
      'Update type validation logic',
    ],
    example: '// Update type references to match new structure',
  },
}

function estimateEffort(change: ContractChange): string {
  const effortMap: Record<string, string> = {
    'function-removed': 'moderate',
    'function-added': 'trivial',
    'parameter-removed': 'moderate',
    'parameter-added': 'small',
    'parameter-type-changed': 'moderate',
    'parameter-required-changed': 'small',
    'return-type-changed': 'small',
    'function-renamed': 'moderate',
    'error-added': 'trivial',
    'error-removed': 'small',
    'error-code-changed': 'small',
    'custom-type-removed': 'moderate',
    'custom-type-added': 'trivial',
    'custom-type-changed': 'moderate',
  }
  return effortMap[change.kind] || 'moderate'
}

function estimateComplexity(change: ContractChange): string {
  const complexityMap: Record<string, string> = {
    'function-removed': 'medium',
    'function-added': 'low',
    'parameter-removed': 'medium',
    'parameter-added': 'low',
    'parameter-type-changed': 'medium',
    'parameter-required-changed': 'low',
    'return-type-changed': 'low',
    'function-renamed': 'medium',
    'error-added': 'low',
    'error-removed': 'low',
    'error-code-changed': 'low',
    'custom-type-removed': 'medium',
    'custom-type-added': 'low',
    'custom-type-changed': 'medium',
  }
  return complexityMap[change.kind] || 'medium'
}

function estimateAffectedRate(change: ContractChange): number {
  if (change.category === 'breaking') return 0.7 + Math.random() * 0.25
  return 0.1 + Math.random() * 0.3
}

function computePriority(change: ContractChange): 'critical' | 'high' | 'medium' | 'low' {
  if (change.kind === 'function-removed' || change.kind === 'function-renamed') return 'critical'
  if (change.category === 'breaking') return 'high'
  if (change.impactScore > 0.5) return 'medium'
  return 'low'
}

function estimateRisk(change: ContractChange): 'high' | 'medium' | 'low' {
  if (change.category === 'breaking' && change.impactScore > 0.7) return 'high'
  if (change.category === 'breaking') return 'medium'
  return 'low'
}

function getCategory(change: ContractChange): string {
  const categoryMap: Record<string, string> = {
    'function-removed': 'API Removal',
    'function-added': 'API Addition',
    'parameter-removed': 'Parameter Change',
    'parameter-added': 'Parameter Change',
    'parameter-type-changed': 'Parameter Change',
    'parameter-required-changed': 'Parameter Change',
    'return-type-changed': 'Return Type Change',
    'function-renamed': 'API Rename',
    'error-added': 'Error Handling',
    'error-removed': 'Error Handling',
    'error-code-changed': 'Error Handling',
    'custom-type-removed': 'Type Definition',
    'custom-type-added': 'Type Definition',
    'custom-type-changed': 'Type Definition',
  }
  return categoryMap[change.kind] || 'Other'
}

export function generateMigrationRecommendations(
  changes: ContractChange[],
  _oldSpec: ContractSpec | null,
  _newSpec: ContractSpec | null,
  _patterns: ReturnType<typeof analyzeChangePatterns>,
  options: { includeExamples?: boolean; maxRecommendations?: number } = {}
): MigrationRecommendation[] {
  const { includeExamples = true, maxRecommendations = 20 } = options
  const recommendations: MigrationRecommendation[] = []

  const seenCategories = new Set<string>()

  for (const change of changes) {
    const template = MIGRATION_TEMPLATES[change.kind]
    if (!template) continue

    const categoryKey = `${change.kind}-${change.path.slice(0, 2).join('-')}`
    if (seenCategories.has(categoryKey)) continue
    seenCategories.add(categoryKey)

    const rec: MigrationRecommendation = {
      id: `mig-${change.kind}-${change.path[1] || 'unknown'}-${Date.now()}`,
      priority: computePriority(change),
      category: getCategory(change),
      title: `${template.title}: ${change.path[1] || ''}`,
      description: change.detail,
      affectedUsers: change.category === 'breaking' ? 'All users calling this function' : 'Users adopting new features',
      effort: estimateEffort(change),
      complexity: estimateComplexity(change),
      codeExample: includeExamples ? template.example : undefined,
      migrationSteps: template.steps,
      riskLevel: estimateRisk(change),
      estimatedAffectedRate: estimateAffectedRate(change),
    }

    recommendations.push(rec)

    if (recommendations.length >= maxRecommendations) break
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}
