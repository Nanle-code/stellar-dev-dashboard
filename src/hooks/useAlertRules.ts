/**
 * React hook for managing alert rules
 */

import { useState, useEffect, useCallback } from 'react'
import type { AlertRule, AlertNotification } from '../types/alerts'
import { getRules, saveRule, deleteRule, getNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/alertRulesDb'
import { startRuleEngine, stopRuleEngine, isEngineRunning } from '../lib/alertRuleEngine'
import { useStore } from '../lib/store'
import { useNotifications } from './useNotifications'

export interface UseAlertRulesResult {
  rules: AlertRule[]
  notifications: AlertNotification[]
  loading: boolean
  error: string | null
  engineRunning: boolean
  addRule: (rule: Omit<AlertRule, 'id' | 'createdAt' | 'lastEvaluatedAt' | 'lastTriggeredAt'>) => Promise<void>
  updateRule: (rule: AlertRule) => Promise<void>
  removeRule: (ruleId: string) => Promise<void>
  toggleRule: (ruleId: string) => Promise<void>
  markRead: (notificationId: string) => Promise<void>
  markAllRead: () => Promise<void>
  refreshRules: () => Promise<void>
  refreshNotifications: () => Promise<void>
}

export function useAlertRules(): UseAlertRulesResult {
  const { connectedAddress, network } = useStore()
  const { success, error: showError } = useNotifications()
  
  const [rules, setRules] = useState<AlertRule[]>([])
  const [notifications, setNotifications] = useState<AlertNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [engineRunning, setEngineRunning] = useState(false)

  // Load rules and notifications
  const loadData = useCallback(async () => {
    if (!connectedAddress) {
      setRules([])
      setNotifications([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const [loadedRules, loadedNotifications] = await Promise.all([
        getRules(connectedAddress),
        getNotifications(connectedAddress),
      ])
      
      setRules(loadedRules)
      setNotifications(loadedNotifications)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load alert rules'
      setError(message)
      console.error('Failed to load alert rules:', err)
    } finally {
      setLoading(false)
    }
  }, [connectedAddress])

  // Start/stop rule engine based on connected address
  useEffect(() => {
    if (connectedAddress && network) {
      // Callback for in-app notifications
      const handleInAppNotification = (notification: AlertNotification) => {
        success(notification.title, notification.message)
        setNotifications(prev => [notification, ...prev])
      }

      startRuleEngine(connectedAddress, network, handleInAppNotification)
      setEngineRunning(true)

      return () => {
        stopRuleEngine()
        setEngineRunning(false)
      }
    } else {
      stopRuleEngine()
      setEngineRunning(false)
    }
  }, [connectedAddress, network, success])

  // Load data on mount and when address changes
  useEffect(() => {
    loadData()
  }, [loadData])

  // Refresh rules periodically to reflect evaluation updates
  useEffect(() => {
    if (!connectedAddress) return

    const interval = setInterval(() => {
      loadData()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [connectedAddress, loadData])

  const addRule = useCallback(async (
    ruleData: Omit<AlertRule, 'id' | 'createdAt' | 'lastEvaluatedAt' | 'lastTriggeredAt'>
  ) => {
    const rule: AlertRule = {
      ...ruleData,
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
      lastEvaluatedAt: null,
      lastTriggeredAt: null,
    }

    await saveRule(rule)
    await loadData()
    success('Rule created', 'Alert rule has been created successfully')
  }, [loadData, success])

  const updateRule = useCallback(async (rule: AlertRule) => {
    await saveRule(rule)
    await loadData()
    success('Rule updated', 'Alert rule has been updated successfully')
  }, [loadData, success])

  const removeRule = useCallback(async (ruleId: string) => {
    await deleteRule(ruleId)
    await loadData()
    success('Rule deleted', 'Alert rule has been deleted successfully')
  }, [loadData, success])

  const toggleRule = useCallback(async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId)
    if (rule) {
      await saveRule({ ...rule, enabled: !rule.enabled })
      await loadData()
    }
  }, [rules, loadData])

  const markRead = useCallback(async (notificationId: string) => {
    await markNotificationRead(notificationId)
    await loadData()
  }, [loadData])

  const markAllRead = useCallback(async () => {
    if (connectedAddress) {
      await markAllNotificationsRead(connectedAddress)
      await loadData()
    }
  }, [connectedAddress, loadData])

  return {
    rules,
    notifications,
    loading,
    error,
    engineRunning,
    addRule,
    updateRule,
    removeRule,
    toggleRule,
    markRead,
    markAllRead,
    refreshRules: loadData,
    refreshNotifications: loadData,
  }
}

export default useAlertRules
