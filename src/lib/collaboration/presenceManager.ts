/**
 * PresenceManager
 *
 * Multi-user presence awareness using BroadcastChannel API.
 * Tracks which tabs/users are viewing the same accounts or transactions
 * and provides real-time presence updates across browser tabs.
 *
 * Features:
 * - Track active tabs viewing specific accounts
 * - Show user presence indicators
 * - Broadcast cursor/selection state
 * - Handle tab join/leave events
 */

export interface PresenceUser {
  id: string
  tabId: string
  accountId: string | null
  activeTab: string
  lastSeen: number
  cursor?: {
    x: number
    y: number
    element?: string
  }
  selection?: {
    type: 'account' | 'transaction' | 'contract'
    id: string
  }
}

interface PresenceEvent {
  type: 'join' | 'leave' | 'update' | 'cursor' | 'selection'
  user: PresenceUser
  timestamp: number
}

const CHANNEL_NAME = 'stellar-dashboard-presence'
const HEARTBEAT_INTERVAL = 5000 // 5 seconds
const PRESENCE_TIMEOUT = 15000 // 15 seconds

class PresenceManager {
  private channel: BroadcastChannel | null = null
  private currentUserId: string
  private currentTabId: string
  private currentUser: PresenceUser
  private users = new Map<string, PresenceUser>()
  private listeners = new Set<(users: PresenceUser[]) => void>()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.currentUserId = this.generateUserId()
    this.currentTabId = this.generateTabId()
    this.currentUser = {
      id: this.currentUserId,
      tabId: this.currentTabId,
      accountId: null,
      activeTab: 'overview',
      lastSeen: Date.now(),
    }
  }

  private generateUserId(): string {
    // Generate a persistent user ID from localStorage if available
    try {
      let userId = localStorage.getItem('stellar-presence-user-id')
      if (!userId) {
        userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        localStorage.setItem('stellar-presence-user-id', userId)
      }
      return userId
    } catch {
      return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
  }

  private generateTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Initialize the presence manager and start broadcasting
   */
  init(): void {
    if (!('BroadcastChannel' in window)) {
      console.warn('[PresenceManager] BroadcastChannel not supported')
      return
    }

    this.channel = new BroadcastChannel(CHANNEL_NAME)

    this.channel.onmessage = (event) => {
      this.handleMessage(event.data as PresenceEvent)
    }

    this.channel.onmessageerror = (err) => {
      console.warn('[PresenceManager] Message error:', err)
    }

    // Announce our presence
    this.broadcast('join')

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.broadcast('update')
    }, HEARTBEAT_INTERVAL)

    // Start cleanup timer for stale users
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleUsers()
    }, PRESENCE_TIMEOUT)

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.broadcast('leave')
    })
  }

  /**
   * Update the current user's state
   */
  updateState(updates: Partial<PresenceUser>): void {
    this.currentUser = { ...this.currentUser, ...updates, lastSeen: Date.now() }
    this.broadcast('update')
  }

  /**
   * Update the account being viewed
   */
  setAccount(accountId: string | null): void {
    this.updateState({ accountId })
  }

  /**
   * Update the active tab
   */
  setActiveTab(tab: string): void {
    this.updateState({ activeTab: tab })
  }

  /**
   * Update cursor position
   */
  setCursor(x: number, y: number, element?: string): void {
    this.updateState({ cursor: { x, y, element } })
  }

  /**
   * Update selection
   */
  setSelection(type: 'account' | 'transaction' | 'contract', id: string): void {
    this.updateState({ selection: { type, id } })
  }

  /**
   * Subscribe to presence updates
   */
  subscribe(listener: (users: PresenceUser[]) => void): () => void {
    this.listeners.add(listener)
    listener(this.getAllUsers())
    return () => this.listeners.delete(listener)
  }

  /**
   * Get all active users (excluding current tab)
   */
  getAllUsers(): PresenceUser[] {
    return Array.from(this.users.values()).filter(
      (u) => u.tabId !== this.currentTabId
    )
  }

  /**
   * Get users viewing the same account
   */
  getUsersForAccount(accountId: string): PresenceUser[] {
    return this.getAllUsers().filter((u) => u.accountId === accountId)
  }

  /**
   * Get user count
   */
  getUserCount(): number {
    return this.getAllUsers().length
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.broadcast('leave')

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    if (this.channel) {
      this.channel.close()
      this.channel = null
    }

    this.users.clear()
    this.listeners.clear()
  }

  // ─── Private methods ────────────────────────────────────────────────────────

  private broadcast(type: PresenceEvent['type']): void {
    if (!this.channel) return

    const event: PresenceEvent = {
      type,
      user: this.currentUser,
      timestamp: Date.now(),
    }

    try {
      this.channel.postMessage(event)
    } catch (err) {
      console.warn('[PresenceManager] Failed to broadcast:', err)
    }
  }

  private handleMessage(event: PresenceEvent): void {
    const { type, user } = event

    // Ignore messages from our own tab
    if (user.tabId === this.currentTabId) return

    switch (type) {
      case 'join':
      case 'update':
        this.users.set(user.tabId, user)
        break
      case 'leave':
        this.users.delete(user.tabId)
        break
      case 'cursor':
      case 'selection':
        // Update existing user with new cursor/selection
        const existing = this.users.get(user.tabId)
        if (existing) {
          this.users.set(user.tabId, { ...existing, ...user, lastSeen: Date.now() })
        }
        break
    }

    this.emit()
  }

  private emit(): void {
    const users = this.getAllUsers()
    for (const listener of this.listeners) {
      try {
        listener(users)
      } catch (err) {
        console.warn('[PresenceManager] Listener error:', err)
      }
    }
  }

  private cleanupStaleUsers(): void {
    const now = Date.now()
    let changed = false

    for (const [tabId, user] of this.users.entries()) {
      if (now - user.lastSeen > PRESENCE_TIMEOUT) {
        this.users.delete(tabId)
        changed = true
      }
    }

    if (changed) {
      this.emit()
    }
  }
}

// Singleton instance
export const presenceManager = new PresenceManager()
