/**
 * API Version Analytics
 * 
 * Tracks version usage, deprecation adoption, and migration metrics
 */

import type { VersionNumber } from './versionManager'

export interface VersionUsageMetric {
  version: VersionNumber
  timestamp: string
  requestCount: number
  successCount: number
  errorCount: number
  avgResponseTime: number
  uniqueUsers: number
}

export interface DeprecationMetric {
  featureId: string
  featureName: string
  firstSeenAt: string
  lastSeenAt: string
  usageCount: number
  affectedUsers: Set<string>
  migrationRate: number // 0-1
}

export interface AdoptionMetric {
  fromVersion: VersionNumber
  toVersion: VersionNumber
  adoptionRate: number // percentage
  adoptionSpeed: number // days to reach 50% adoption
  remainingUsers: number
  estimatedCompletionDate: string
}

interface VersionMetricData {
  version: VersionNumber
  requestCount: number
  successCount: number
  errorCount: number
  totalResponseTime: number
  uniqueUsers: Set<string>
  lastUpdated: string
}

interface FeatureUsageData {
  featureId: string
  featureName: string
  usageCount: number
  users: Set<string>
  firstSeen: string
  lastSeen: string
}

/**
 * AnalyticsManager: Tracks API usage and adoption metrics
 */
export class AnalyticsManager {
  private versionMetrics: Map<VersionNumber, VersionMetricData> = new Map()
  private deprecationMetrics: Map<string, FeatureUsageData> = new Map()
  private adoptionMetrics: Map<string, AdoptionMetric> = new Map()
  private userSessions: Map<string, Set<VersionNumber>> = new Map()
  private migrationEvents: Array<{
    userId: string
    fromVersion: VersionNumber
    toVersion: VersionNumber
    timestamp: string
    success: boolean
  }> = []

  /**
   * Record a version request
   */
  recordRequest(
    version: VersionNumber,
    userId: string,
    success: boolean,
    responseTime: number
  ): void {
    const now = new Date().toISOString()
    
    // Track version metrics
    if (!this.versionMetrics.has(version)) {
      this.versionMetrics.set(version, {
        version,
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        uniqueUsers: new Set(),
        lastUpdated: now,
      })
    }

    const metric = this.versionMetrics.get(version)!
    metric.requestCount++
    metric.successCount += success ? 1 : 0
    metric.errorCount += success ? 0 : 1
    metric.totalResponseTime += responseTime
    metric.uniqueUsers.add(userId)
    metric.lastUpdated = now

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set())
    }
    this.userSessions.get(userId)!.add(version)
  }

  /**
   * Record deprecated feature usage
   */
  recordDeprecatedFeatureUsage(
    featureId: string,
    featureName: string,
    userId: string
  ): void {
    const now = new Date().toISOString()

    if (!this.deprecationMetrics.has(featureId)) {
      this.deprecationMetrics.set(featureId, {
        featureId,
        featureName,
        usageCount: 0,
        users: new Set(),
        firstSeen: now,
        lastSeen: now,
      })
    }

    const metric = this.deprecationMetrics.get(featureId)!
    metric.usageCount++
    metric.users.add(userId)
    metric.lastSeen = now
  }

  /**
   * Record migration event
   */
  recordMigrationEvent(
    userId: string,
    fromVersion: VersionNumber,
    toVersion: VersionNumber,
    success: boolean
  ): void {
    this.migrationEvents.push({
      userId,
      fromVersion,
      toVersion,
      timestamp: new Date().toISOString(),
      success,
    })
  }

  /**
   * Get version usage metrics
   */
  getVersionMetrics(version: VersionNumber): VersionUsageMetric | null {
    const metric = this.versionMetrics.get(version)
    if (!metric) return null

    return {
      version,
      timestamp: metric.lastUpdated,
      requestCount: metric.requestCount,
      successCount: metric.successCount,
      errorCount: metric.errorCount,
      avgResponseTime: metric.requestCount > 0 ? metric.totalResponseTime / metric.requestCount : 0,
      uniqueUsers: metric.uniqueUsers.size,
    }
  }

  /**
   * Get deprecation metrics
   */
  getDeprecationMetrics(featureId: string): DeprecationMetric | null {
    const metric = this.deprecationMetrics.get(featureId)
    if (!metric) return null

    return {
      featureId: metric.featureId,
      featureName: metric.featureName,
      firstSeenAt: metric.firstSeen,
      lastSeenAt: metric.lastSeen,
      usageCount: metric.usageCount,
      affectedUsers: new Set(metric.users),
      migrationRate: this.calculateMigrationRate(featureId),
    }
  }

  /**
   * Calculate migration rate for a feature
   */
  private calculateMigrationRate(featureId: string): number {
    const successfulMigrations = this.migrationEvents.filter(e => e.success).length
    const totalMigrations = this.migrationEvents.length

    if (totalMigrations === 0) return 0
    return (successfulMigrations / totalMigrations)
  }

  /**
   * Get adoption metrics between versions
   */
  getAdoptionMetrics(
    fromVersion: VersionNumber,
    toVersion: VersionNumber
  ): AdoptionMetric | null {
    const key = `${fromVersion}→${toVersion}`
    return this.adoptionMetrics.get(key) || null
  }

  /**
   * Calculate adoption rate
   */
  calculateAdoptionRate(toVersion: VersionNumber): number {
    const toMetric = this.versionMetrics.get(toVersion)
    const allMetrics = Array.from(this.versionMetrics.values())
    
    if (!toMetric || allMetrics.length === 0) return 0

    const totalUsers = new Set(
      allMetrics.flatMap(m => Array.from(m.uniqueUsers))
    ).size

    return totalUsers > 0 ? (toMetric.uniqueUsers.size / totalUsers) * 100 : 0
  }

  /**
   * Get all version metrics
   */
  getAllVersionMetrics(): VersionUsageMetric[] {
    return Array.from(this.versionMetrics.values())
      .map(metric => ({
        version: metric.version,
        timestamp: metric.lastUpdated,
        requestCount: metric.requestCount,
        successCount: metric.successCount,
        errorCount: metric.errorCount,
        avgResponseTime: metric.requestCount > 0 ? metric.totalResponseTime / metric.requestCount : 0,
        uniqueUsers: metric.uniqueUsers.size,
      }))
  }

  /**
   * Get all deprecation metrics
   */
  getAllDeprecationMetrics(): DeprecationMetric[] {
    return Array.from(this.deprecationMetrics.entries())
      .map(([featureId, metric]) => ({
        featureId: metric.featureId,
        featureName: metric.featureName,
        firstSeenAt: metric.firstSeen,
        lastSeenAt: metric.lastSeen,
        usageCount: metric.usageCount,
        affectedUsers: new Set(metric.users),
        migrationRate: this.calculateMigrationRate(featureId),
      }))
  }

  /**
   * Get migration success rate
   */
  getMigrationSuccessRate(): number {
    if (this.migrationEvents.length === 0) return 100

    const successful = this.migrationEvents.filter(e => e.success).length
    return (successful / this.migrationEvents.length) * 100
  }

  /**
   * Get users still on deprecated version
   */
  getUsersOnVersion(version: VersionNumber): string[] {
    const metric = this.versionMetrics.get(version)
    return metric ? Array.from(metric.uniqueUsers) : []
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): {
    versions: VersionUsageMetric[]
    deprecations: DeprecationMetric[]
    migrations: typeof this.migrationEvents
  } {
    return {
      versions: this.getAllVersionMetrics(),
      deprecations: this.getAllDeprecationMetrics(),
      migrations: [...this.migrationEvents],
    }
  }

  /**
   * Export metrics as CSV
   */
  exportMetricsAsCSV(): string {
    const metrics = this.getAllVersionMetrics()
    const header = 'Version,Timestamp,Requests,Success,Errors,AvgResponseTime,UniqueUsers\n'
    const rows = metrics
      .map(m => `${m.version},${m.timestamp},${m.requestCount},${m.successCount},${m.errorCount},${m.avgResponseTime.toFixed(2)},${m.uniqueUsers}`)
      .join('\n')

    return header + rows
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.versionMetrics.clear()
    this.deprecationMetrics.clear()
    this.adoptionMetrics.clear()
    this.userSessions.clear()
    this.migrationEvents = []
  }

  /**
   * Get error rate for version
   */
  getErrorRate(version: VersionNumber): number {
    const metric = this.versionMetrics.get(version)
    if (!metric || metric.requestCount === 0) return 0
    return (metric.errorCount / metric.requestCount) * 100
  }
}

/**
 * Global analytics manager instance
 */
export const globalAnalyticsManager = new AnalyticsManager()
