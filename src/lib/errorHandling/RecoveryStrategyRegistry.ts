import { selfHealingManager, ServiceStatus, ServiceHealth } from './SelfHealingManager'

export type HealthProbe = {
  id: string
  label: string
  status: ServiceHealth
  lastChecked: string | null
  lastError?: string
}

const probes: HealthProbe[] = []

export function registerBuiltInStrategies(): void {
  // Example recovery strategies could be registered here.
  // For now, we keep the behavior minimal and let selfHealingManager manage service states.
}

export async function registerNetworkProbes(): Promise<void> {
  // Register the well-known services for network health.
  const networkServices = ['horizon', 'soroban']
  networkServices.forEach((id) => {
    selfHealingManager.registerService(id, {
      health: 'unknown',
      lastSuccess: null,
      lastFailure: null,
      failureCount: 0,
      recoveryAttempts: 0,
    })
  })
  return Promise.resolve()
}

export { HealthProbe }
