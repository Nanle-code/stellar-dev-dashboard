/**
 * React hook over the Advanced Account Watch System.
 *
 * Subscribes a component to the shared watch system, drives the real-time
 * polling loop for its lifetime, and exposes the watchlist / rule mutators
 * plus the latest aggregated insights, risk alerts and anomalies.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  accountWatchSystem,
  type AccountWatchUpdate,
} from '../lib/accountWatchSystem'
import type { NetworkName } from '../lib/stellar'
import type {
  AggregatedInsights,
  Anomaly,
  RiskAlert,
  WatchRule,
  WatchedAccount,
} from '../types/accountWatch'

export interface UseAccountWatchResult {
  accounts: WatchedAccount[]
  rules: WatchRule[]
  insights: AggregatedInsights | null
  alerts: RiskAlert[]
  anomalies: Anomaly[]
  addAccount: (address: string, label?: string) => boolean
  removeAccount: (address: string) => void
  addRule: (rule: Omit<WatchRule, 'id'>) => WatchRule
  removeRule: (id: string) => void
  toggleRule: (id: string, enabled: boolean) => void
  setNetwork: (network: NetworkName) => void
  refresh: () => Promise<void>
}

export interface UseAccountWatchOptions {
  /** When true (default), starts the polling loop for the component's lifetime. */
  autoStart?: boolean
  network?: NetworkName
}

export function useAccountWatch(
  options: UseAccountWatchOptions = {},
): UseAccountWatchResult {
  const { autoStart = true, network } = options

  const [accounts, setAccounts] = useState<WatchedAccount[]>(() =>
    accountWatchSystem.getAccounts(),
  )
  const [rules, setRules] = useState<WatchRule[]>(() => accountWatchSystem.getRules())
  const [insights, setInsights] = useState<AggregatedInsights | null>(null)
  const [alerts, setAlerts] = useState<RiskAlert[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])

  // Mirror system state into React after a mutation.
  const syncMeta = useCallback(() => {
    setAccounts(accountWatchSystem.getAccounts())
    setRules(accountWatchSystem.getRules())
  }, [])

  useEffect(() => {
    if (network) accountWatchSystem.setNetwork(network)
  }, [network])

  useEffect(() => {
    const unsubscribe = accountWatchSystem.subscribe((update: AccountWatchUpdate) => {
      setInsights(update.insights)
      // Keep a bounded, newest-first history of alerts/anomalies.
      if (update.alerts.length) {
        setAlerts((prev) => [...update.alerts, ...prev].slice(0, 100))
      }
      if (update.anomalies.length) {
        setAnomalies((prev) => [...update.anomalies, ...prev].slice(0, 100))
      }
    })

    if (autoStart) accountWatchSystem.start()

    return () => {
      unsubscribe()
      if (autoStart) accountWatchSystem.stop()
    }
  }, [autoStart])

  const addAccount = useCallback(
    (address: string, label?: string) => {
      const ok = accountWatchSystem.addAccount(address, label)
      if (ok) syncMeta()
      return ok
    },
    [syncMeta],
  )

  const removeAccount = useCallback(
    (address: string) => {
      accountWatchSystem.removeAccount(address)
      syncMeta()
    },
    [syncMeta],
  )

  const addRule = useCallback(
    (rule: Omit<WatchRule, 'id'>) => {
      const created = accountWatchSystem.addRule(rule)
      syncMeta()
      return created
    },
    [syncMeta],
  )

  const removeRule = useCallback(
    (id: string) => {
      accountWatchSystem.removeRule(id)
      syncMeta()
    },
    [syncMeta],
  )

  const toggleRule = useCallback(
    (id: string, enabled: boolean) => {
      accountWatchSystem.toggleRule(id, enabled)
      syncMeta()
    },
    [syncMeta],
  )

  const setNetwork = useCallback((next: NetworkName) => {
    accountWatchSystem.setNetwork(next)
  }, [])

  const refresh = useCallback(async () => {
    await accountWatchSystem.refresh()
  }, [])

  return {
    accounts,
    rules,
    insights,
    alerts,
    anomalies,
    addAccount,
    removeAccount,
    addRule,
    removeRule,
    toggleRule,
    setNetwork,
    refresh,
  }
}

export default useAccountWatch
