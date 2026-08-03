export type ServiceHealth = 'healthy' | 'degraded' | 'down' | 'recovering' | 'unknown'

export interface ServiceStatus {
  id: string
  health: ServiceHealth
  lastSuccess: string | null
  lastFailure: string | null
  failureCount: number
  recoveryAttempts: number
  recoveryAction?: string
  details?: string
}

export type ServiceStatusMap = Map<string, ServiceStatus>
export type StatusSubscriber = (statuses: ServiceStatusMap) => void

const initialStatus: ServiceStatus = {
  id: 'unknown',
  health: 'unknown',
  lastSuccess: null,
  lastFailure: null,
  failureCount: 0,
  recoveryAttempts: 0,
}

class SelfHealingManager {
  private statuses: ServiceStatusMap = new Map()
  private subscribers: Set<StatusSubscriber> = new Set()
  private started = false

  start(): void {
    if (this.started) return
    this.started = true
    // Initial probe state is created by registry setup;
    // if no services are registered, we keep the manager ready.
    this.notifySubscribers()
  }

  subscribe(cb: StatusSubscriber): () => void {
    this.subscribers.add(cb)
    cb(new Map(this.statuses))
    return () => {
      this.subscribers.delete(cb)
    }
  }

  getStatuses(): ServiceStatusMap {
    return new Map(this.statuses)
  }

  async healNow(serviceId: string): Promise<void> {
    const status = this.statuses.get(serviceId) ?? { ...initialStatus, id: serviceId }
    const nextStatus: ServiceStatus = {
      ...status,
      health: 'recovering',
      recoveryAction: 'Attempting automated recovery',
      recoveryAttempts: status.recoveryAttempts + 1,
    }
    this.setStatus(serviceId, nextStatus)

    try {
      await this.delay(400)
      this.setStatus(serviceId, {
        ...nextStatus,
        health: 'healthy',
        lastSuccess: new Date().toISOString(),
        lastFailure: status.lastFailure,
        recoveryAction: undefined,
      })
    } catch {
      this.setStatus(serviceId, {
        ...nextStatus,
        health: 'degraded',
        lastFailure: new Date().toISOString(),
        recoveryAction: 'Recovery failed; manual intervention may be required',
      })
    }
  }

  resetService(serviceId: string): void {
    this.setStatus(serviceId, {
      ...this.getService(serviceId),
      health: 'unknown',
      recoveryAction: 'Service reset to unknown state',
    })
  }

  markHealthy(serviceId: string): void {
    const current = this.getService(serviceId)
    this.setStatus(serviceId, {
      ...current,
      health: 'healthy',
      lastSuccess: new Date().toISOString(),
      recoveryAction: undefined,
    })
  }

  registerService(id: string, status?: Partial<ServiceStatus>): void {
    const next: ServiceStatus = {
      ...initialStatus,
      ...status,
      id,
    }
    this.setStatus(id, next)
  }

  private getService(serviceId: string): ServiceStatus {
    return this.statuses.get(serviceId) ?? { ...initialStatus, id: serviceId }
  }

  private setStatus(serviceId: string, status: ServiceStatus): void {
    this.statuses.set(serviceId, status)
    this.notifySubscribers()
  }

  private notifySubscribers(): void {
    const snapshot = new Map(this.statuses)
    this.subscribers.forEach((subscriber) => subscriber(snapshot))
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const selfHealingManager = new SelfHealingManager()
