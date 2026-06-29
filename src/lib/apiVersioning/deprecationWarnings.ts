/**
 * Deprecation Warning System
 * 
 * Tracks deprecations, warnings, and migration paths
 */

import type { VersionNumber } from './versionManager'

export interface DeprecatedFeature {
  id: string
  name: string
  description: string
  deprecatedIn: VersionNumber
  sunsetsIn: VersionNumber
  replacement?: string
  migrationGuide?: string
  severity: 'warning' | 'critical'
  affectedEndpoints: string[]
  breakingChanges?: string[]
}

export interface DeprecationWarning {
  feature: string
  message: string
  severity: 'warning' | 'critical'
  migrationPath?: string
  sunsetsAt?: string
  replacementUrl?: string
}

export interface MigrationPath {
  from: VersionNumber
  to: VersionNumber
  changes: Array<{
    type: 'added' | 'removed' | 'changed' | 'renamed'
    endpoint: string
    oldName?: string
    newName?: string
    details: string
  }>
  estimatedEffort: 'minimal' | 'moderate' | 'significant'
  automatedTools?: string[]
}

/**
 * DeprecationManager: Manages deprecation warnings and migration paths
 */
export class DeprecationManager {
  private deprecatedFeatures: Map<string, DeprecatedFeature> = new Map()
  private warnings: DeprecationWarning[] = []
  private migrationPaths: Map<string, MigrationPath> = new Map()
  private suppressedWarnings: Set<string> = new Set()
  private warnedFeatures: Set<string> = new Set()

  /**
   * Register a deprecated feature
   */
  registerDeprecatedFeature(feature: DeprecatedFeature): void {
    this.deprecatedFeatures.set(feature.id, feature)
  }

  /**
   * Get deprecated feature info
   */
  getDeprecatedFeature(id: string): DeprecatedFeature | undefined {
    return this.deprecatedFeatures.get(id)
  }

  /**
   * Check if feature is deprecated
   */
  isDeprecated(featureId: string, currentVersion: VersionNumber): boolean {
    const feature = this.deprecatedFeatures.get(featureId)
    if (!feature) return false
    
    // Feature is deprecated if current version >= deprecatedIn version
    return this.compareVersions(currentVersion, feature.deprecatedIn) >= 0
  }

  /**
   * Check if feature will sunset in current version
   */
  willSunsetSoon(featureId: string, currentVersion: VersionNumber, warningWindow?: VersionNumber): boolean {
    const feature = this.deprecatedFeatures.get(featureId)
    if (!feature) return false
    
    const comparisonVersion = warningWindow || this.getNextVersion(feature.sunsetsIn, 'minor')
    return this.compareVersions(currentVersion, comparisonVersion) >= 0
  }

  /**
   * Generate deprecation warning
   */
  generateWarning(featureId: string, currentVersion: VersionNumber): DeprecationWarning | null {
    const feature = this.deprecatedFeatures.get(featureId)
    if (!feature || !this.isDeprecated(featureId, currentVersion)) {
      return null
    }

    // Only warn once per session to avoid spam
    if (this.warnedFeatures.has(featureId)) {
      return null
    }

    this.warnedFeatures.add(featureId)

    const warning: DeprecationWarning = {
      feature: feature.name,
      message: `${feature.name} is deprecated as of version ${feature.deprecatedIn}. ` +
               `It will be removed in version ${feature.sunsetsIn}.` +
               (feature.replacement ? ` Use ${feature.replacement} instead.` : ''),
      severity: feature.severity,
      migrationPath: feature.migrationGuide,
      sunsetsAt: feature.sunsetsIn,
      replacementUrl: feature.replacement,
    }

    this.warnings.push(warning)
    return warning
  }

  /**
   * Register a migration path
   */
  registerMigrationPath(path: MigrationPath): void {
    const key = `${path.from}->${path.to}`
    this.migrationPaths.set(key, path)
  }

  /**
   * Get migration path between versions
   */
  getMigrationPath(from: VersionNumber, to: VersionNumber): MigrationPath | undefined {
    const key = `${from}->${to}`
    return this.migrationPaths.get(key)
  }

  /**
   * Get all migration paths
   */
  getAllMigrationPaths(): MigrationPath[] {
    return Array.from(this.migrationPaths.values())
  }

  /**
   * Suppress warnings for a feature
   */
  suppressWarning(featureId: string): void {
    this.suppressedWarnings.add(featureId)
  }

  /**
   * Resume warnings for a feature
   */
  resumeWarning(featureId: string): void {
    this.suppressedWarnings.delete(featureId)
  }

  /**
   * Check if warning is suppressed
   */
  isWarningSuppressed(featureId: string): boolean {
    return this.suppressedWarnings.has(featureId)
  }

  /**
   * Get all warnings
   */
  getWarnings(): DeprecationWarning[] {
    return [...this.warnings]
  }

  /**
   * Clear warnings
   */
  clearWarnings(): void {
    this.warnings = []
  }

  /**
   * Log warning to console
   */
  logWarning(warning: DeprecationWarning): void {
    const emoji = warning.severity === 'critical' ? '🚨' : '⚠️'
    console.warn(`${emoji} ${warning.message}`)
    if (warning.migrationPath) {
      console.warn(`📖 Migration guide: ${warning.migrationPath}`)
    }
    if (warning.replacementUrl) {
      console.warn(`🔄 Replacement: ${warning.replacementUrl}`)
    }
  }

  /**
   * Get sunset date for feature
   */
  getSunsetDate(featureId: string): VersionNumber | null {
    const feature = this.deprecatedFeatures.get(featureId)
    return feature?.sunsetsIn || null
  }

  /**
   * Compare two semantic versions
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
   * Get next version
   */
  private getNextVersion(version: VersionNumber, type: 'major' | 'minor' | 'patch'): VersionNumber {
    const [major, minor, patch] = version.split('.').map(Number)

    switch (type) {
      case 'major':
        return `${major + 1}.0.0` as VersionNumber
      case 'minor':
        return `${major}.${minor + 1}.0` as VersionNumber
      case 'patch':
        return `${major}.${minor}.${patch + 1}` as VersionNumber
    }
  }

  /**
   * Reset manager state
   */
  reset(): void {
    this.warnings = []
    this.warnedFeatures.clear()
    this.suppressedWarnings.clear()
  }
}

/**
 * Global deprecation manager instance
 */
export const globalDeprecationManager = new DeprecationManager()
