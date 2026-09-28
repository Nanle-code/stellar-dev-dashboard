/**
 * useErrorRecovery.ts — D-057
 *
 * React hook that bridges the SelfHealingManager to components.
 *
 * Usage:
 *   const { statuses, overallHealth, healNow } = useErrorRecovery()
 *
 *   // Target a single service:
 *   const { status, healNow } = useErrorRecovery('horizon:testnet')
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { selfHealingManager, type ServiceStatus, type ServiceHealth } from '../lib/errorHandling/SelfHealingManager'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OverallHealth = 'healthy' | 'degraded' | 'down' | 'recovering' | 'unknown'

export interface ErrorRecoveryResult {
  /** All tracked service statuses */
  statuses: ServiceStatus[]
  /** Rolled-up health across all services */
  overallHealth: OverallHealth
  /** True if any service is actively running a recovery strategy */
  isRecovering: boolean
  /** Trigger manual recovery for a specific service (or all if id omitted) */
  healNow: (serviceId?: string) => Promise<void>
  /** Reset a service to unknown state and re-probe it */
  resetService: (serviceId: string) => void
  /** Manually mark a service as healthy */
  markHealthy: (serviceId: string) => void
  /** The specific service status when serviceId is provided */
  status: ServiceStatus | undefined
}

// ─── Health roll-up ───────────────────────────────────────────────────────────

function rollUpHealth(statuses: ServiceStatus[]): OverallHealth {
  if (statuses.length === 0) return 'unknown'
  if (statuses.some((s) => s.health === 'down')) return 'down'
  if (statuses.some((s) => s.health === 'recovering')) return 'recovering'
  if (statuses.some((s) => s.health === 'degraded')) return 'degraded'
  if (statuses.every((s) => s.health === 'healthy')) return 'healthy'
  return 'unknown'
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useErrorRecovery(serviceId?: string): ErrorRecoveryResult {
  const [statusMap, setStatusMap] = useState<Map<string, ServiceStatus>>(
    () => selfHealingManager.getStatuses()
  )

  // Subscribe to manager updates
  useEffect(() => {
    const unsub = selfHealingManager.subscribe((map) => {
      setStatusMap(new Map(map))
    })
    return unsub
  }, [])

  const statuses = Array.from(statusMap.values())
  const overallHealth = rollUpHealth(statuses)
  const isRecovering = statuses.some((s) => s.health === 'recovering')

  const healNow = useCallback(async (id?: string) => {
    const target = id ?? serviceId
    if (target) {
      await selfHealingManager.healNow(target)
    } else {
      // Heal all degraded/down services in parallel
      const targets = statuses
        .filter((s) => s.health !== 'healthy' && s.health !== 'unknown')
        .map((s) => s.id)
      await Promise.allSettled(targets.map((t) => selfHealingManager.healNow(t)))
    }
  }, [serviceId, statuses])

  const resetService = useCallback((id: string) => {
    selfHealingManager.resetService(id)
  }, [])

  const markHealthy = useCallback((id: string) => {
    selfHealingManager.markHealthy(id)
  }, [])

  const status = serviceId ? statusMap.get(serviceId) : undefined

  return { statuses, overallHealth, isRecovering, healNow, resetService, markHealthy, status }
}

// ─── Narrow hook for a single service ────────────────────────────────────────

export interface SingleServiceRecoveryResult {
  status: ServiceStatus | undefined
  health: ServiceHealth
  isRecovering: boolean
  healNow: () => Promise<void>
  resetService: () => void
  markHealthy: () => void
}

export function useServiceHealth(serviceId: string): SingleServiceRecoveryResult {
  const { status, healNow, resetService, markHealthy } = useErrorRecovery(serviceId)

  return {
    status,
    health: status?.health ?? 'unknown',
    isRecovering: status?.health === 'recovering',
    healNow: useCallback(() => healNow(serviceId), [healNow, serviceId]),
    resetService: useCallback(() => resetService(serviceId), [resetService, serviceId]),
    markHealthy: useCallback(() => markHealthy(serviceId), [markHealthy, serviceId]),
  }
}

export default useErrorRecovery
