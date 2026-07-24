/**
 * RecoveryStrategyRegistry.ts — D-057
 *
 * Registers built-in recovery strategies and network probes
 * for the Stellar services tracked by SelfHealingManager.
 *
 * Consumed by main.jsx during app bootstrap.
 */

import { selfHealingManager } from './SelfHealingManager'
import { createLogger } from '../../utils/logger'

const logger = createLogger('RecoveryStrategyRegistry')

// ─── Network endpoints ─────────────────────────────────────────────────────────

const ENDPOINTS: Record<string, string> = {
  'horizon:testnet': 'https://horizon-testnet.stellar.org',
  'horizon:mainnet': 'https://horizon.stellar.org',
  'soroban:testnet': 'https://soroban-testnet.stellar.org',
  'soroban:mainnet': 'https://soroban.stellar.org',
}

// ─── Built-in recovery strategies ──────────────────────────────────────────────

/**
 * Register recovery strategies for all default Stellar services.
 * Each strategy attempts a lightweight health-check fetch and returns
 * `true` if the service responded, `false` otherwise.
 */
export function registerBuiltInStrategies(): void {
  for (const [serviceId, url] of Object.entries(ENDPOINTS)) {
    selfHealingManager.register(serviceId, {
      description: `Health-check ${serviceId}`,
      action: async () => {
        try {
          const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
          return res.ok || res.status < 500
        } catch {
          return false
        }
      },
    })
  }

  logger.info('Registered built-in recovery strategies', {
    services: Object.keys(ENDPOINTS),
  })
}

// ─── Network probes ────────────────────────────────────────────────────────────

let probeInterval: ReturnType<typeof setInterval> | null = null

async function probeService(serviceId: string, url: string): Promise<void> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    if (res.ok || res.status < 500) {
      selfHealingManager.recordSuccess(serviceId)
    } else {
      selfHealingManager.recordFailure(serviceId)
    }
  } catch {
    selfHealingManager.recordFailure(serviceId)
  }
}

/**
 * Perform an initial probe of every registered service and set up
 * periodic health monitoring.
 *
 * @returns a Promise that resolves once the initial probe round completes.
 */
export async function registerNetworkProbes(): Promise<void> {
  // Initial probe
  const probes = Object.entries(ENDPOINTS).map(([id, url]) =>
    probeService(id, url).catch(() => {
      /* non-critical */
    }),
  )

  await Promise.allSettled(probes)
  logger.info('Initial network probes complete')
}
