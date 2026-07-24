/**
 * Alert notification delivery system
 * Handles in-app and browser notifications
 */

import type { AlertNotification, NotificationChannel } from '../types/alerts'
import { saveNotification } from './alertRulesDb'
import { generateId } from './notifications'

// Browser notification permission state
let browserNotificationsEnabled = false

/**
 * Request browser notification permission from the user
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Browser notifications not supported')
    return false
  }

  if (Notification.permission === 'granted') {
    browserNotificationsEnabled = true
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    browserNotificationsEnabled = permission === 'granted'
    return browserNotificationsEnabled
  } catch (error) {
    console.error('Failed to request notification permission:', error)
    return false
  }
}

/**
 * Check if browser notifications are available and permitted
 */
export function areBrowserNotificationsAvailable(): boolean {
  return (
    'Notification' in window &&
    Notification.permission === 'granted' &&
    browserNotificationsEnabled
  )
}

/**
 * Get current browser notification permission status
 */
export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

/**
 * Deliver a notification through the specified channels
 */
export async function deliverNotification(
  notification: AlertNotification,
  channels: NotificationChannel[],
  inAppCallback?: (notification: AlertNotification) => void
): Promise<void> {
  // Persist notification to IndexedDB
  await saveNotification(notification)

  // Deliver to in-app notification center
  if (channels.includes('in_app') && inAppCallback) {
    inAppCallback(notification)
  }

  // Deliver browser notification
  if (channels.includes('browser') && areBrowserNotificationsAvailable()) {
    try {
      const browserNotif = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: false,
        silent: false,
      })

      // Auto-close after 10 seconds
      setTimeout(() => browserNotif.close(), 10000)

      // Handle notification click (focus window)
      browserNotif.onclick = () => {
        window.focus()
        browserNotif.close()
      }
    } catch (error) {
      console.error('Failed to show browser notification:', error)
    }
  }
}

/**
 * Create an alert notification object
 */
export function createAlertNotification(
  ruleId: string,
  title: string,
  message: string,
  accountAddress: string,
  ruleType: string
): AlertNotification {
  return {
    id: generateId(),
    ruleId,
    triggeredAt: Date.now(),
    message,
    title,
    read: false,
    accountAddress,
    ruleType: ruleType as any,
  }
}
