/**
 * API Sunset Manager
 * 
 * Handles version sunset policies, decommissioning, and communication
 */

import type { VersionNumber } from './versionManager'

export interface SunsetPolicy {
  version: VersionNumber
  deprecationDate: string
  sunsetDate: string
  communicationPhases: CommunicationPhase[]
  decommissioningSteps: DecommissioningStep[]
  alternatives: Array<{
    version: VersionNumber
    reason: string
  }>
}

export interface CommunicationPhase {
  phase: number
  name: string
  startDate: string
  endDate: string
  channels: ('email' | 'banner' | 'notification' | 'documentation' | 'api')[]
  message: string
  frequency: number // times per period
}

export interface DecommissioningStep {
  stepNumber: number
  description: string
  date: string
  action: 'readonly' | 'redirect' | 'disable' | 'remove'
  targetVersion?: VersionNumber
  backupLocation?: string
}

/**
 * SunsetManager: Manages version lifecycle and decommissioning
 */
export class SunsetManager {
  private policies: Map<VersionNumber, SunsetPolicy> = new Map()
  private sunsetLog: Array<{
    version: VersionNumber
    action: string
    timestamp: string
    details: unknown
  }> = []
  private communicationLog: Array<{
    version: VersionNumber
    phase: number
    sentAt: string
    recipients: string[]
  }> = []

  /**
   * Register sunset policy for version
   */
  registerSunsetPolicy(policy: SunsetPolicy): void {
    this.policies.set(policy.version, policy)
  }

  /**
   * Get sunset policy for version
   */
  getSunsetPolicy(version: VersionNumber): SunsetPolicy | undefined {
    return this.policies.get(version)
  }

  /**
   * Check if version is sunsetted
   */
  isSunset(version: VersionNumber): boolean {
    const policy = this.policies.get(version)
    if (!policy) return false

    const today = new Date()
    const sunsetDate = new Date(policy.sunsetDate)
    return today >= sunsetDate
  }

  /**
   * Check if version is deprecated
   */
  isDeprecated(version: VersionNumber): boolean {
    const policy = this.policies.get(version)
    if (!policy) return false

    const today = new Date()
    const deprecationDate = new Date(policy.deprecationDate)
    return today >= deprecationDate
  }

  /**
   * Get days until sunset
   */
  daysUntilSunset(version: VersionNumber): number | null {
    const policy = this.policies.get(version)
    if (!policy) return null

    const today = new Date()
    const sunsetDate = new Date(policy.sunsetDate)
    const diffTime = sunsetDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays > 0 ? diffDays : 0
  }

  /**
   * Get days until deprecation
   */
  daysUntilDeprecation(version: VersionNumber): number | null {
    const policy = this.policies.get(version)
    if (!policy) return null

    const today = new Date()
    const deprecationDate = new Date(policy.deprecationDate)
    const diffTime = deprecationDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays > 0 ? diffDays : 0
  }

  /**
   * Get current communication phase
   */
  getCurrentCommunicationPhase(version: VersionNumber): CommunicationPhase | undefined {
    const policy = this.policies.get(version)
    if (!policy) return undefined

    const today = new Date()
    return policy.communicationPhases.find(phase => {
      const startDate = new Date(phase.startDate)
      const endDate = new Date(phase.endDate)
      return today >= startDate && today <= endDate
    })
  }

  /**
   * Get next communication phase
   */
  getNextCommunicationPhase(version: VersionNumber): CommunicationPhase | undefined {
    const policy = this.policies.get(version)
    if (!policy) return undefined

    const today = new Date()
    return policy.communicationPhases.find(phase => {
      const startDate = new Date(phase.startDate)
      return today <= startDate
    })
  }

  /**
   * Get next decommissioning step
   */
  getNextDecommissioningStep(version: VersionNumber): DecommissioningStep | undefined {
    const policy = this.policies.get(version)
    if (!policy) return undefined

    const today = new Date()
    return policy.decommissioningSteps.find(step => {
      const stepDate = new Date(step.date)
      return today <= stepDate
    })
  }

  /**
   * Execute decommissioning step
   */
  executeDecommissioningStep(
    version: VersionNumber,
    step: DecommissioningStep
  ): { success: boolean; message: string } {
    try {
      this.sunsetLog.push({
        version,
        action: step.action,
        timestamp: new Date().toISOString(),
        details: {
          step: step.stepNumber,
          description: step.description,
          targetVersion: step.targetVersion,
        },
      })

      return {
        success: true,
        message: `Successfully executed: ${step.description}`,
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to execute step: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Log communication sent
   */
  logCommunicationSent(
    version: VersionNumber,
    phase: number,
    recipients: string[]
  ): void {
    this.communicationLog.push({
      version,
      phase,
      sentAt: new Date().toISOString(),
      recipients,
    })
  }

  /**
   * Generate sunset notice
   */
  generateSunsetNotice(version: VersionNumber): string {
    const policy = this.policies.get(version)
    if (!policy) return ''

    const daysRemaining = this.daysUntilSunset(version)
    const alternatives = policy.alternatives.map(alt => `  - Version ${alt.version}: ${alt.reason}`).join('\n')

    return `
⚠️  API VERSION SUNSET NOTICE ⚠️

Version: ${version}
Sunset Date: ${policy.sunsetDate}
Days Remaining: ${daysRemaining}

This version of the API is scheduled for sunset. Please migrate to a newer version.

Recommended Alternatives:
${alternatives}

Migration Guide: See documentation for details.
Support: Contact support@stellar.dev for assistance.
    `.trim()
  }

  /**
   * Generate decommissioning plan
   */
  generateDecommissioningPlan(version: VersionNumber): string {
    const policy = this.policies.get(version)
    if (!policy) return ''

    const steps = policy.decommissioningSteps
      .map(step => `${step.stepNumber}. [${step.date}] ${step.action}: ${step.description}`)
      .join('\n')

    return `
DECOMMISSIONING PLAN FOR VERSION ${version}

${steps}

Deprecated: ${policy.deprecationDate}
Sunset: ${policy.sunsetDate}
    `.trim()
  }

  /**
   * Check if version should be read-only
   */
  shouldBeReadOnly(version: VersionNumber): boolean {
    const policy = this.policies.get(version)
    if (!policy) return false

    const nextStep = policy.decommissioningSteps.find(step =>
      new Date(step.date) <= new Date()
    )

    return nextStep?.action === 'readonly'
  }

  /**
   * Get alternative versions
   */
  getAlternatives(version: VersionNumber): Array<{ version: VersionNumber; reason: string }> {
    const policy = this.policies.get(version)
    return policy?.alternatives || []
  }

  /**
   * Get sunset log
   */
  getSunsetLog(): typeof this.sunsetLog {
    return [...this.sunsetLog]
  }

  /**
   * Get communication log
   */
  getCommunicationLog(): typeof this.communicationLog {
    return [...this.communicationLog]
  }

  /**
   * Get all policies
   */
  getAllPolicies(): SunsetPolicy[] {
    return Array.from(this.policies.values())
  }

  /**
   * Get versions expiring soon
   */
  getExpiringVersions(withinDays: number = 30): VersionNumber[] {
    return Array.from(this.policies.keys()).filter(version => {
      const daysRemaining = this.daysUntilSunset(version)
      return daysRemaining !== null && daysRemaining > 0 && daysRemaining <= withinDays
    })
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.sunsetLog = []
    this.communicationLog = []
  }
}

/**
 * Global sunset manager instance
 */
export const globalSunsetManager = new SunsetManager()
