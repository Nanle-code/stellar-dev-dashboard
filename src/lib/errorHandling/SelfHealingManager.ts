/**
 * SelfHealingManager.ts — D-057
 *
 * Tracks service health and triggers recovery strategies when services degrade.
 * Designed to be consumed by useErrorRecovery hook and ErrorBoundary.
 */

import { createLogger } from '../../utils/logger'

const logger = createLogger('SelfHealingManager')

// ─── Types ────────────────────────────────────────────────────────────────────

export type ServiceHealth = 'healthy' | 'degraded' | 'recovering' | 'down' | 'unknown'

export interface ServiceStatus {
  id: string
  health: ServiceHealth
  lastSuccess: string | null
  lastFailure: string | null
  failureCount: number
  recoveryAttempts: number
  recoveryAction: string | null
}

export type OverallHealth = 'healthy' | 'degraded' | 'down' | 'recovering' | 'unknown'

type Listener = (statuses: Map<string, ServiceStatus>) => void

interface RecoveryStrategy {
  id: string
  action: () => Promise<boolean>
  description: string
}

// ─── SelfHealingManager ────────────────────────────────────────────────────────

class SelfHealingManagerClass {
  private services = new Map<string, ServiceStatus>()
  private strategies = new Map<string, RecoveryStrategy>()
  private listeners: Listener[] = []
  private monitorInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Register a service for health tracking.
   */
  register(
    id: string,
    strategy?: { action: () => Promise<boolean>; description: string },
  ): void {
    if (!this.services.has(id)) {
      this.services.set(id, {
        id,
        health: 'unknown',
        lastSuccess: null,
        lastFailure: null,
        failureCount: 0,
        recoveryAttempts: 0,
        recoveryAction: null,
      })
    }
    if (strategy) {
      this.strategies.set(id, { id, ...strategy })
    }
    this.notifyListeners()
  }

  /**
   * Record a successful operation for a service.
   */
  recordSuccess(id: string): void {
    const status = this.services.get(id)
    if (!status) return
    status.health = 'healthy'
    status.lastSuccess = new Date().toISOString()
    status.failureCount = 0
    status.recoveryAction = null
    this.notifyListeners()
  }

  /**
   * Record a failed operation for a service.
   */
  recordFailure(id: string): void {
    const status = this.services.get(id)
    if (!status) return
    status.lastFailure = new Date().toISOString()
    status.failureCount++
    if (status.failureCount >= 5) {
      status.health = 'down'
    } else if (status.failureCount >= 2) {
      status.health = 'degraded'
    }
    this.notifyListeners()
  }

  /**
   * Mark a service as healthy manually.
   */
  markHealthy(id: string): void {
    const status = this.services.get(id)
    if (!status) return
    status.health = 'healthy'
    status.lastSuccess = new Date().toISOString()
    status.failureCount = 0
    status.recoveryAction = null
    this.notifyListeners()
  }

  /**
   * Attempt manual recovery for a specific service (or all if id omitted).
   */
  async healNow(id?: string): Promise<void> {
    if (id) {
      await this.healService(id)
      return
    }
    const targets = [...this.services.values()]
      .filter((s) => s.health !== 'healthy' && s.health !== 'unknown')
      .map((s) => s.id)
    await Promise.allSettled(targets.map((t) => this.healService(t)))
  }

  private async healService(id: string): Promise<void> {
    const status = this.services.get(id)
    if (!status) return

    const strategy = this.strategies.get(id)
    status.health = 'recovering'
    status.recoveryAttempts++
    status.recoveryAction = strategy?.description ?? 'Attempting recovery…'
    this.notifyListeners()

    try {
      if (strategy) {
        const recovered = await strategy.action()
        if (recovered) {
          status.health = 'healthy'
          status.lastSuccess = new Date().toISOString()
          status.failureCount = 0
          status.recoveryAction = null
          logger.info(`Service "${id}" recovered successfully`)
        } else {
          status.health = 'degraded'
          status.recoveryAction = 'Recovery attempted — still degraded'
          logger.warn(`Service "${id}" recovery did not succeed`)
        }
      } else {
        // No strategy — just reset to unknown so it gets re-probed
        status.health = 'unknown'
        status.recoveryAction = null
        logger.info(`Service "${id}" reset to unknown (no strategy)`)
      }
    } catch (err) {
      status.health = 'down'
      status.recoveryAction = `Recovery failed: ${err instanceof Error ? err.message : String(err)}`
      logger.error(`Service "${id}" recovery failed`, {}, err instanceof Error ? err : undefined)
    }

    this.notifyListeners()
  }

  /**
   * Start periodic health monitoring.  Called after strategies & probes
   * have been registered during bootstrap.
   */
  start(intervalMs = 60_000): void {
    if (this.monitorInterval) return
    this.monitorInterval = setInterval(() => {
      this.healNow().catch(() => {
        /* non-critical */
      })
    }, intervalMs)
    logger.info('Self-healing monitor started', { intervalMs })
  }

  /**
   * Stop periodic health monitoring.
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
      logger.info('Self-healing monitor stopped')
    }
  }

  /**
   * Reset a service to unknown state.
   */
  resetService(id: string): void {
    const status = this.services.get(id)
    if (!status) return
    status.health = 'unknown'
    status.failureCount = 0
    status.recoveryAttempts = 0
    status.recoveryAction = null
    this.notifyListeners()
  }

  /**
   * Get all service statuses.
   */
  getStatuses(): Map<string, ServiceStatus> {
    return new Map(this.services)
  }

  /**
   * Subscribe to status updates.
   * @returns unsubscribe function
   */
  subscribe(cb: Listener): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  private notifyListeners(): void {
    const snapshot = new Map(this.services)
    this.listeners.forEach((cb) => {
      try {
        cb(snapshot)
      } catch {
        /* ignore */
      }
    })
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

export const selfHealingManager = new SelfHealingManagerClass()

// ─── Auto-register default Stellar services ───────────────────────────────────

selfHealingManager.register('horizon:testnet')
selfHealingManager.register('horizon:mainnet')
selfHealingManager.register('soroban:testnet')
selfHealingManager.register('soroban:mainnet')

export default selfHealingManager
