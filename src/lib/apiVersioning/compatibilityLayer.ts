/**
 * Compatibility Layer
 * 
 * Handles backward compatibility transformations between API versions
 */

import type { VersionNumber } from './versionManager'

export interface TransformRule {
  version: VersionNumber
  direction: 'request' | 'response' | 'both'
  transform: (data: unknown) => unknown
  description: string
}

export interface CompatibilityAdapter {
  fromVersion: VersionNumber
  toVersion: VersionNumber
  requestTransforms: Array<(data: unknown) => unknown>
  responseTransforms: Array<(data: unknown) => unknown>
  fieldMappings: Record<string, string>
  removedFields?: string[]
  addedFields?: Record<string, unknown>
}

/**
 * CompatibilityManager: Handles backward compatibility
 */
export class CompatibilityManager {
  private transformRules: Map<string, TransformRule[]> = new Map()
  private adapters: Map<string, CompatibilityAdapter> = new Map()
  private fieldMappings: Map<string, Record<string, string>> = new Map()

  /**
   * Register a transformation rule
   */
  registerTransformRule(endpoint: string, rule: TransformRule): void {
    const key = `${endpoint}:${rule.version}`
    if (!this.transformRules.has(key)) {
      this.transformRules.set(key, [])
    }
    this.transformRules.get(key)!.push(rule)
  }

  /**
   * Register a compatibility adapter
   */
  registerAdapter(key: string, adapter: CompatibilityAdapter): void {
    this.adapters.set(key, adapter)
  }

  /**
   * Get adapter between two versions
   */
  getAdapter(fromVersion: VersionNumber, toVersion: VersionNumber): CompatibilityAdapter | undefined {
    const key = `${fromVersion}→${toVersion}`
    return this.adapters.get(key)
  }

  /**
   * Transform request data for version compatibility
   */
  transformRequest(
    endpoint: string,
    data: unknown,
    targetVersion: VersionNumber
  ): unknown {
    const rules = this.transformRules.get(`${endpoint}:${targetVersion}`) || []
    
    let transformed = data
    for (const rule of rules) {
      if (rule.direction === 'request' || rule.direction === 'both') {
        transformed = rule.transform(transformed)
      }
    }

    return this.applyFieldMappings(transformed, targetVersion)
  }

  /**
   * Transform response data for version compatibility
   */
  transformResponse(
    endpoint: string,
    data: unknown,
    sourceVersion: VersionNumber,
    targetVersion: VersionNumber
  ): unknown {
    const rules = this.transformRules.get(`${endpoint}:${sourceVersion}`) || []
    
    let transformed = data
    for (const rule of rules) {
      if (rule.direction === 'response' || rule.direction === 'both') {
        transformed = rule.transform(transformed)
      }
    }

    return this.applyFieldMappings(transformed, targetVersion)
  }

  /**
   * Apply field mappings for version
   */
  private applyFieldMappings(data: unknown, version: VersionNumber): unknown {
    const mappings = this.fieldMappings.get(version)
    if (!mappings || typeof data !== 'object' || data === null) {
      return data
    }

    const result = Array.isArray(data) ? [...data] : { ...(data as Record<string, unknown>) }
    
    for (const [oldName, newName] of Object.entries(mappings)) {
      if (Array.isArray(result)) {
        result.forEach((item: unknown) => {
          if (typeof item === 'object' && item !== null && oldName in item) {
            const obj = item as Record<string, unknown>
            obj[newName] = obj[oldName]
            delete obj[oldName]
          }
        })
      } else if (oldName in result) {
        result[newName] = result[oldName]
        delete result[oldName]
      }
    }

    return result
  }

  /**
   * Register field mappings for version
   */
  registerFieldMappings(version: VersionNumber, mappings: Record<string, string>): void {
    this.fieldMappings.set(version, mappings)
  }

  /**
   * Ensure backward compatibility for object
   */
  ensureBackwardCompatibility<T extends Record<string, unknown>>(
    data: T,
    version: VersionNumber,
    requiredFields: string[]
  ): T {
    const result = { ...data }
    
    for (const field of requiredFields) {
      if (!(field in result)) {
        // Add default values for missing required fields
        if (field.includes('timestamp') || field.includes('date')) {
          result[field] = new Date().toISOString()
        } else if (field.includes('version')) {
          result[field] = version
        } else if (field.includes('id')) {
          result[field] = `unknown-${Date.now()}`
        } else {
          result[field] = null
        }
      }
    }

    return result as T
  }

  /**
   * Create compatibility shim
   */
  createShim<T extends Record<string, unknown>>(
    data: T,
    fromVersion: VersionNumber,
    toVersion: VersionNumber
  ): T {
    const adapter = this.getAdapter(fromVersion, toVersion)
    if (!adapter) return data

    let transformed = data
    
    // Apply request transforms (for outgoing data)
    for (const transform of adapter.requestTransforms) {
      transformed = transform(transformed) as T
    }

    // Apply field mappings
    for (const [old, newField] of Object.entries(adapter.fieldMappings)) {
      if (old in transformed) {
        (transformed as Record<string, unknown>)[newField] = (transformed as Record<string, unknown>)[old]
      }
    }

    // Remove deprecated fields
    if (adapter.removedFields) {
      for (const field of adapter.removedFields) {
        delete (transformed as Record<string, unknown>)[field]
      }
    }

    // Add new fields with defaults
    if (adapter.addedFields) {
      Object.assign(transformed, adapter.addedFields)
    }

    return transformed
  }

  /**
   * Get all adapters
   */
  getAllAdapters(): CompatibilityAdapter[] {
    return Array.from(this.adapters.values())
  }
}

/**
 * Global compatibility manager instance
 */
export const globalCompatibilityManager = new CompatibilityManager()
