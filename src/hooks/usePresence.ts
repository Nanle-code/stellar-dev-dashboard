/**
 * usePresence
 *
 * React hook for accessing presence/collaboration features.
 * Provides real-time awareness of other users/tabs viewing the same content.
 */

import { useEffect, useState, useCallback } from 'react'
import { presenceManager } from '../lib/collaboration/presenceManager'

export function usePresence() {
  const [users, setUsers] = useState([])
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Initialize presence manager on mount
    presenceManager.init()
    setIsInitialized(true)

    // Subscribe to presence updates
    const unsubscribe = presenceManager.subscribe((updatedUsers) => {
      setUsers(updatedUsers)
    })

    return () => {
      unsubscribe()
      presenceManager.disconnect()
    }
  }, [])

  const updateAccount = useCallback((accountId) => {
    presenceManager.setAccount(accountId)
  }, [])

  const updateActiveTab = useCallback((tab) => {
    presenceManager.setActiveTab(tab)
  }, [])

  const updateCursor = useCallback((x, y, element) => {
    presenceManager.setCursor(x, y, element)
  }, [])

  const updateSelection = useCallback((type, id) => {
    presenceManager.setSelection(type, id)
  }, [])

  const getUsersForAccount = useCallback((accountId) => {
    return presenceManager.getUsersForAccount(accountId)
  }, [])

  const getUserCount = useCallback(() => {
    return presenceManager.getUserCount()
  }, [])

  return {
    users,
    isInitialized,
    updateAccount,
    updateActiveTab,
    updateCursor,
    updateSelection,
    getUsersForAccount,
    getUserCount,
  }
}
