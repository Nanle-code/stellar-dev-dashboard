/**
 * usePresence
 *
 * React hook for accessing presence/collaboration features.
 * Provides real-time awareness of other users/tabs viewing the same content.
 */

import { useEffect, useState, useCallback } from 'react'
import { presenceManager } from '../lib/collaboration/presenceManager'
import type { PresenceUser } from '../lib/collaboration/presenceManager'

export type PresenceSelectionType = 'account' | 'transaction' | 'contract'

export interface UsePresenceReturn {
  users: PresenceUser[]
  isInitialized: boolean
  updateAccount: (accountId: string | null) => void
  updateActiveTab: (tab: string) => void
  updateCursor: (x: number, y: number, element?: string) => void
  updateSelection: (type: PresenceSelectionType, id: string) => void
  getUsersForAccount: (accountId: string) => PresenceUser[]
  getUserCount: () => number
}

export function usePresence(): UsePresenceReturn {
  const [users, setUsers] = useState<PresenceUser[]>([])
  const [isInitialized, setIsInitialized] = useState<boolean>(false)

  useEffect(() => {
    // Initialize presence manager on mount
    presenceManager.init()
    setIsInitialized(true)

    // Subscribe to presence updates
    const unsubscribe = presenceManager.subscribe((updatedUsers: PresenceUser[]) => {
      setUsers(updatedUsers)
    })

    return () => {
      unsubscribe()
      presenceManager.disconnect()
    }
  }, [])

  const updateAccount = useCallback((accountId: string | null): void => {
    presenceManager.setAccount(accountId)
  }, [])

  const updateActiveTab = useCallback((tab: string): void => {
    presenceManager.setActiveTab(tab)
  }, [])

  const updateCursor = useCallback((x: number, y: number, element?: string): void => {
    presenceManager.setCursor(x, y, element)
  }, [])

  const updateSelection = useCallback((type: PresenceSelectionType, id: string): void => {
    presenceManager.setSelection(type, id)
  }, [])

  const getUsersForAccount = useCallback((accountId: string): PresenceUser[] => {
    return presenceManager.getUsersForAccount(accountId)
  }, [])

  const getUserCount = useCallback((): number => {
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
