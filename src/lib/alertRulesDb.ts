/**
 * IndexedDB persistence layer for Alert Rules and Notifications
 * Extends the existing storage pattern from src/lib/storage.js
 */

import type { AlertRule, AlertNotification } from '../types/alerts'

// Use native IndexedDB instead of idb library to avoid adding new dependencies
type IDBPDatabase = IDBDatabase

const DB_NAME = 'stellar-dev-dashboard'
const DB_VERSION = 3 // Increment from existing version 2
const RULES_STORE = 'alert-rules'
const NOTIFICATIONS_STORE = 'alert-notifications'

let dbPromise: Promise<IDBPDatabase> | null = null

function initDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create alert-rules store if it doesn't exist
        if (!db.objectStoreNames.contains(RULES_STORE)) {
          const rulesStore = db.createObjectStore(RULES_STORE, { keyPath: 'id' })
          rulesStore.createIndex('userId', 'userId', { unique: false })
          rulesStore.createIndex('accountAddress', 'accountAddress', { unique: false })
          rulesStore.createIndex('enabled', 'enabled', { unique: false })
        }

        // Create alert-notifications store
        if (!db.objectStoreNames.contains(NOTIFICATIONS_STORE)) {
          const notifStore = db.createObjectStore(NOTIFICATIONS_STORE, { keyPath: 'id' })
          notifStore.createIndex('ruleId', 'ruleId', { unique: false })
          notifStore.createIndex('read', 'read', { unique: false })
          notifStore.createIndex('triggeredAt', 'triggeredAt', { unique: false })
          notifStore.createIndex('accountAddress', 'accountAddress', { unique: false })
        }
      }
    })
  }
  return dbPromise
}

// ─── Alert Rules ──────────────────────────────────────────────────────────────

export async function saveRule(rule: AlertRule): Promise<void> {
  const db = await initDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RULES_STORE, 'readwrite')
    const store = tx.objectStore(RULES_STORE)
    const request = store.put(rule)
    
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteRule(ruleId: string): Promise<void> {
  const db = await initDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RULES_STORE, 'readwrite')
    const store = tx.objectStore(RULES_STORE)
    const request = store.delete(ruleId)
    
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getRules(userId: string): Promise<AlertRule[]> {
  const db = await initDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RULES_STORE, 'readonly')
    const store = tx.objectStore(RULES_STORE)
    const index = store.index('userId')
    const request = index.getAll(userId)
    
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getEnabledRules(userId: string): Promise<AlertRule[]> {
  const rules = await getRules(userId)
  return rules.filter(rule => rule.enabled)
}

export async function updateRuleEvaluationTime(
  ruleId: string,
  lastEvaluatedAt: number,
  lastTriggeredAt?: number
): Promise<void> {
  const db = await initDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RULES_STORE, 'readwrite')
    const store = tx.objectStore(RULES_STORE)
    const getRequest = store.get(ruleId)
    
    getRequest.onsuccess = () => {
      const rule = getRequest.result
      if (rule) {
        rule.lastEvaluatedAt = lastEvaluatedAt
        if (lastTriggeredAt !== undefined) {
          rule.lastTriggeredAt = lastTriggeredAt
        }
        store.put(rule)
      }
    }
    
    getRequest.onerror = () => reject(getRequest.error)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ─── Alert Notifications ──────────────────────────────────────────────────────

export async function saveNotification(notification: AlertNotification): Promise<void> {
  const db = await initDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFICATIONS_STORE, 'readwrite')
    const store = tx.objectStore(NOTIFICATIONS_STORE)
    const request = store.put(notification)
    
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getNotifications(
  userId: string,
  unreadOnly = false
): Promise<AlertNotification[]> {
  const db = await initDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFICATIONS_STORE, 'readonly')
    const store = tx.objectStore(NOTIFICATIONS_STORE)
    const index = store.index('accountAddress')
    const request = index.getAll(userId)
    
    request.onsuccess = () => {
      const notifications = request.result
      const sorted = notifications.sort((a, b) => b.triggeredAt - a.triggeredAt)
      
      if (unreadOnly) {
        resolve(sorted.filter(n => !n.read))
      } else {
        resolve(sorted)
      }
    }
    
    request.onerror = () => reject(request.error)
  })
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const db = await initDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFICATIONS_STORE, 'readwrite')
    const store = tx.objectStore(NOTIFICATIONS_STORE)
    const getRequest = store.get(notificationId)
    
    getRequest.onsuccess = () => {
      const notification = getRequest.result
      if (notification) {
        notification.read = true
        store.put(notification)
      }
    }
    
    getRequest.onerror = () => reject(getRequest.error)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const notifications = await getNotifications(userId, true)
  const db = await initDb()
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFICATIONS_STORE, 'readwrite')
    const store = tx.objectStore(NOTIFICATIONS_STORE)
    
    for (const notification of notifications) {
      notification.read = true
      store.put(notification)
    }
    
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const db = await initDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFICATIONS_STORE, 'readwrite')
    const store = tx.objectStore(NOTIFICATIONS_STORE)
    const request = store.delete(notificationId)
    
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearOldNotifications(userId: string, olderThanMs: number): Promise<void> {
  const cutoff = Date.now() - olderThanMs
  const notifications = await getNotifications(userId)
  const db = await initDb()
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFICATIONS_STORE, 'readwrite')
    const store = tx.objectStore(NOTIFICATIONS_STORE)
    
    for (const notification of notifications) {
      if (notification.triggeredAt < cutoff) {
        store.delete(notification.id)
      }
    }
    
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Initialize the database on module load
if (typeof window !== 'undefined') {
  initDb().catch(err => console.error('Failed to initialize alert rules database:', err))
}
