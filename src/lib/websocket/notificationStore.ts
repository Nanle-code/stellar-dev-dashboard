/**
 * Lightweight, dependency-free pub/sub store for real-time notifications.
 *
 * Components subscribe via the useRealTimeNotifications hook (or directly
 * via getSnapshot/subscribe). The store caps history at MAX_HISTORY entries
 * to keep memory bounded over long sessions.
 */

import type { RealTimeNotification, NotificationLevel } from './StreamTypes'

const MAX_HISTORY = 200

type Listener = (snapshot: RealTimeNotification[]) => void

class NotificationStore {
  private items: RealTimeNotification[] = []
  private listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.items)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): RealTimeNotification[] {
    return this.items
  }

  push(input: {
    level?: NotificationLevel
    title: string
    message: string
    source?: string
    payload?: unknown
  }): RealTimeNotification {
    const notification: RealTimeNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level: input.level ?? 'info',
      title: input.title,
      message: input.message,
      source: input.source,
      payload: input.payload,
      timestamp: Date.now(),
      read: false,
    }
    this.items = [notification, ...this.items].slice(0, MAX_HISTORY)
    this.emit()
    return notification
  }

  markRead(id: string): void {
    const idx = this.items.findIndex((n) => n.id === id)
    if (idx === -1 || this.items[idx].read) return
    this.items = [
      ...this.items.slice(0, idx),
      { ...this.items[idx], read: true },
      ...this.items.slice(idx + 1),
    ]
    this.emit()
  }

  markAllRead(): void {
    if (this.items.every((n) => n.read)) return
    this.items = this.items.map((n) => ({ ...n, read: true }))
    this.emit()
  }

  remove(id: string): void {
    const next = this.items.filter((n) => n.id !== id)
    if (next.length === this.items.length) return
    this.items = next
    this.emit()
  }

  clear(): void {
    if (this.items.length === 0) return
    this.items = []
    this.emit()
  }

  unreadCount(): number {
    return this.items.reduce((n, it) => (it.read ? n : n + 1), 0)
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.items)
      } catch {
        /* ignore */
      }
    }
  }
}

export const notificationStore = new NotificationStore()
