/**
 * API Version Migration Tools
 * 
 * Automated migration and upgrade utilities
 */

import type { VersionNumber } from './versionManager'
import type { MigrationPath } from './deprecationWarnings'

export interface MigrationStep {
  id: string
  description: string
  action: 'rename-field' | 'remove-field' | 'add-field' | 'transform-data' | 'update-endpoint'
  target: string // field or endpoint name
  details?: Record<string, unknown>
  rollback?: () => void
}

export interface MigrationScript {
  id: string
  fromVersion: VersionNumber
  toVersion: VersionNumber
  steps: MigrationStep[]
  estimatedTime: number // in milliseconds
  reversible: boolean
  automatable: boolean
}

export interface MigrationReport {
  scriptId: string
  startTime: string
  endTime: string
  fromVersion: VersionNumber
  toVersion: VersionNumber
  stepsCompleted: number
  totalSteps: number
  success: boolean
  errors: Array<{ step: string; message: string }>
  warnings: Array<{ step: string; message: string }>
}

/**
 * MigrationManager: Handles automated migrations
 */
export class MigrationManager {
  private scripts: Map<string, MigrationScript> = new Map()
  private migrationHistory: MigrationReport[] = []
  private activeScripts: Set<string> = new Set()

  /**
   * Register a migration script
   */
  registerScript(script: MigrationScript): void {
    this.scripts.set(script.id, script)
  }

  /**
   * Get migration script
   */
  getScript(id: string): MigrationScript | undefined {
    return this.scripts.get(id)
  }

  /**
   * Find migration script between versions
   */
  findMigrationScript(
    fromVersion: VersionNumber,
    toVersion: VersionNumber
  ): MigrationScript | undefined {
    return Array.from(this.scripts.values()).find(
      script => script.fromVersion === fromVersion && script.toVersion === toVersion
    )
  }

  /**
   * Execute migration script
   */
  async executeMigration(
    scriptId: string,
    data: unknown,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; data: unknown; report: MigrationReport }> {
    const script = this.scripts.get(scriptId)
    if (!script) {
      throw new Error(`Migration script not found: ${scriptId}`)
    }

    if (this.activeScripts.has(scriptId)) {
      throw new Error(`Migration already in progress: ${scriptId}`)
    }

    this.activeScripts.add(scriptId)
    const startTime = new Date().toISOString()
    const errors: Array<{ step: string; message: string }> = []
    const warnings: Array<{ step: string; message: string }> = []
    let migratedData = data
    let stepsCompleted = 0

    try {
      for (const step of script.steps) {
        try {
          migratedData = await this.executeStep(step, migratedData)
          stepsCompleted++
          onProgress?.((stepsCompleted / script.steps.length) * 100)
        } catch (error) {
          errors.push({
            step: step.id,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const report: MigrationReport = {
        scriptId,
        startTime,
        endTime: new Date().toISOString(),
        fromVersion: script.fromVersion,
        toVersion: script.toVersion,
        stepsCompleted,
        totalSteps: script.steps.length,
        success: errors.length === 0,
        errors,
        warnings,
      }

      this.migrationHistory.push(report)
      return {
        success: errors.length === 0,
        data: migratedData,
        report,
      }
    } finally {
      this.activeScripts.delete(scriptId)
    }
  }

  /**
   * Execute a single migration step
   */
  private async executeStep(step: MigrationStep, data: unknown): Promise<unknown> {
    if (!data || typeof data !== 'object') {
      return data
    }

    const obj = Array.isArray(data) ? [...data] : { ...(data as Record<string, unknown>) }

    switch (step.action) {
      case 'rename-field':
        return this.renameField(obj, step.target, step.details?.newName as string)

      case 'remove-field':
        return this.removeField(obj, step.target)

      case 'add-field':
        return this.addField(obj, step.target, step.details?.value)

      case 'transform-data':
        if (step.details?.transformer && typeof step.details.transformer === 'function') {
          return step.details.transformer(obj)
        }
        return obj

      case 'update-endpoint':
        // Update endpoint references in data
        return this.updateEndpoint(obj, step.target, step.details?.newEndpoint as string)

      default:
        return obj
    }
  }

  /**
   * Rename a field in data
   */
  private renameField(
    data: unknown,
    oldName: string,
    newName: string
  ): unknown {
    if (Array.isArray(data)) {
      return data.map(item => {
        if (typeof item === 'object' && item !== null && oldName in item) {
          const obj = item as Record<string, unknown>
          obj[newName] = obj[oldName]
          delete obj[oldName]
        }
        return item
      })
    }

    if (typeof data === 'object' && data !== null && oldName in data) {
      const obj = data as Record<string, unknown>
      obj[newName] = obj[oldName]
      delete obj[oldName]
    }

    return data
  }

  /**
   * Remove a field from data
   */
  private removeField(data: unknown, fieldName: string): unknown {
    if (Array.isArray(data)) {
      return data.map(item => {
        if (typeof item === 'object' && item !== null && fieldName in item) {
          const obj = item as Record<string, unknown>
          delete obj[fieldName]
        }
        return item
      })
    }

    if (typeof data === 'object' && data !== null && fieldName in data) {
      const obj = data as Record<string, unknown>
      delete obj[fieldName]
    }

    return data
  }

  /**
   * Add a field to data
   */
  private addField(data: unknown, fieldName: string, value: unknown): unknown {
    if (Array.isArray(data)) {
      return data.map(item => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>
          if (!(fieldName in obj)) {
            obj[fieldName] = value
          }
        }
        return item
      })
    }

    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>
      if (!(fieldName in obj)) {
        obj[fieldName] = value
      }
    }

    return data
  }

  /**
   * Update endpoint references
   */
  private updateEndpoint(
    data: unknown,
    oldEndpoint: string,
    newEndpoint: string
  ): unknown {
    const updateValue = (value: unknown): unknown => {
      if (typeof value === 'string' && value.includes(oldEndpoint)) {
        return value.replace(oldEndpoint, newEndpoint)
      }
      if (typeof value === 'object' && value !== null) {
        return this.updateEndpoint(value, oldEndpoint, newEndpoint)
      }
      return value
    }

    if (Array.isArray(data)) {
      return data.map(updateValue)
    }

    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>
      Object.keys(obj).forEach(key => {
        obj[key] = updateValue(obj[key])
      })
    }

    return data
  }

  /**
   * Get migration history
   */
  getMigrationHistory(): MigrationReport[] {
    return [...this.migrationHistory]
  }

  /**
   * Get last successful migration
   */
  getLastSuccessfulMigration(): MigrationReport | undefined {
    return this.migrationHistory
      .reverse()
      .find(report => report.success)
  }

  /**
   * Get all available scripts
   */
  getAllScripts(): MigrationScript[] {
    return Array.from(this.scripts.values())
  }

  /**
   * Check if migration is available
   */
  isMigrationAvailable(fromVersion: VersionNumber, toVersion: VersionNumber): boolean {
    return this.findMigrationScript(fromVersion, toVersion) !== undefined
  }

  /**
   * Validate migration script
   */
  validateScript(script: MigrationScript): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!script.id) errors.push('Script ID is required')
    if (!script.fromVersion) errors.push('From version is required')
    if (!script.toVersion) errors.push('To version is required')
    if (!script.steps || script.steps.length === 0) errors.push('At least one step is required')

    for (const step of script.steps || []) {
      if (!step.id) errors.push(`Step ID is required`)
      if (!step.description) errors.push(`Step description is required for ${step.id}`)
      if (!step.action) errors.push(`Step action is required for ${step.id}`)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Create migration chain for multiple versions
   */
  createMigrationChain(
    fromVersion: VersionNumber,
    toVersion: VersionNumber
  ): MigrationScript[] {
    const chain: MigrationScript[] = []
    const scripts = Array.from(this.scripts.values())
      .sort((a, b) => this.compareVersions(a.toVersion, b.toVersion))

    for (const script of scripts) {
      if (
        this.compareVersions(script.fromVersion, fromVersion) >= 0 &&
        this.compareVersions(script.toVersion, toVersion) <= 0
      ) {
        chain.push(script)
      }
    }

    return chain
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(v1: VersionNumber, v2: VersionNumber): number {
    const [major1, minor1, patch1] = v1.split('.').map(Number)
    const [major2, minor2, patch2] = v2.split('.').map(Number)

    if (major1 !== major2) return major1 > major2 ? 1 : -1
    if (minor1 !== minor2) return minor1 > minor2 ? 1 : -1
    if (patch1 !== patch2) return patch1 > patch2 ? 1 : -1
    return 0
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.migrationHistory = []
  }
}

/**
 * Global migration manager instance
 */
export const globalMigrationManager = new MigrationManager()
