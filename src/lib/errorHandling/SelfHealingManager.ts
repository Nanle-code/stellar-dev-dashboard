import { createLogger } from '../../utils/logger'

const logger = createLogger('SelfHealingManager')

export type ServiceHealth = 'healthy' | 'degraded' | 'down' | 'recovering' | 'unknown'

export interface ServiceStatus {
  id: string
  name: string
  health: ServiceHealth
  lastChecked: number | null
  details?: string
}

export interface RecoveryStrategy {
  id: string
  name: string
  description: string
  apply: (serviceId: string) => Promise<void>
}

interface SubscriptionCallback {
  (statuses: Map<string, ServiceStatus>): void
}

class SelfHealingManager {
  private readonly services = new Map<string, ServiceStatus>()
  private readonly subscribers = new Set<SubscriptionCallback>()
  private readonly strategies = new Map<string, RecoveryStrategy>()
  private started = false

  constructor() {
    this.registerDefaultServices()
  }

  private registerDefaultServices(): void {
    const defaults: Array<Omit<ServiceStatus, 'health'> & { health: ServiceHealth }> = [
      { id: 'horizon:testnet', name: 'Horizon Testnet', health: 'unknown', lastChecked: null, details: 'Pending first probe' },
      { id: 'horizon:mainnet', name: 'Horizon Mainnet', health: 'unknown', lastChecked: null, details: 'Pending first probe' },
      { id: 'soroban:testnet', name: 'Soroban Testnet', health: 'unknown', lastChecked: null, details: 'Pending first probe' },
      { id: 'soroban:mainnet', name: 'Soroban Mainnet', health: 'unknown', lastChecked: null, details: 'Pending first probe' },
    ]

    defaults.forEach((service) => {
      this.services.set(service.id, service)
    })
  }

  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.id, strategy)
  }

  getStatuses(): Map<string, ServiceStatus> {
    return new Map(this.services)
  }

  subscribe(callback: SubscriptionCallback): () => void {
    this.subscribers.add(callback)
    callback(this.getStatuses())
    return () => {
      this.subscribers.delete(callback)
    }
  }

  private notify(): void {
    const snapshot = this.getStatuses()
    this.subscribers.forEach((callback) => {
      try {
        callback(snapshot)
      } catch (error) {
        logger.error('Self-healing subscriber failed', {}, error as Error)
      }
    })
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.setServiceHealth('horizon:testnet', 'healthy', 'Self-healing monitor started')
    this.setServiceHealth('horizon:mainnet', 'healthy', 'Self-healing monitor started')
    this.setServiceHealth('soroban:testnet', 'healthy', 'Self-healing monitor started')
    this.setServiceHealth('soroban:mainnet', 'healthy', 'Self-healing monitor started')
    logger.info('Self-healing manager started')
  }

  async healNow(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId)
    if (!service) {
      return
    }

    this.setServiceHealth(serviceId, 'recovering', 'Attempting automated recovery')

    const strategy = this.strategies.get(serviceId) ?? this.strategies.get('default')

    try {
      if (strategy) {
        await strategy.apply(serviceId)
      }
      this.setServiceHealth(serviceId, 'healthy', 'Recovery completed successfully')
    } catch (error) {
      this.setServiceHealth(serviceId, 'degraded', error instanceof Error ? error.message : 'Recovery failed')
      logger.warn(`Recovery failed for ${serviceId}`, {}, error as Error)
    }
  }

  resetService(serviceId: string): void {
    const service = this.services.get(serviceId)
    if (!service) {
      return
    }

    this.setServiceHealth(serviceId, 'unknown', 'Service reset')
  }

  markHealthy(serviceId: string): void {
    this.setServiceHealth(serviceId, 'healthy', 'Manually marked healthy')
  }

  private setServiceHealth(serviceId: string, health: ServiceHealth, details: string): void {
    const service = this.services.get(serviceId)
    if (!service) {
      return
    }

    this.services.set(serviceId, {
      ...service,
      health,
      lastChecked: Date.now(),
      details,
    })

    this.notify()
  }
}

export const selfHealingManager = new SelfHealingManager()
