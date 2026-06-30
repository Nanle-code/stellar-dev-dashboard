import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const PUSH_TOKEN_KEY = 'push_token'
const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled'

export type NotificationPriority = 'high' | 'normal' | 'low'

export interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, unknown>
  priority?: NotificationPriority
  sound?: string
  badge?: number
  category?: string
}

export type NotificationType =
  | 'transaction_received'
  | 'transaction_sent'
  | 'account_merge'
  | 'trustline_added'
  | 'claimable_balance'
  | 'contract_event'
  | 'network_alert'
  | 'price_alert'
  | 'sync_complete'
  | 'error'

export interface NotificationChannel {
  id: string
  name: string
  description: string
  enabled: boolean
  types: NotificationType[]
}

export const DEFAULT_CHANNELS: NotificationChannel[] = [
  {
    id: 'transactions',
    name: 'Transactions',
    description: 'Payment and transaction notifications',
    enabled: true,
    types: ['transaction_received', 'transaction_sent', 'account_merge'],
  },
  {
    id: 'trustlines',
    name: 'Trustlines',
    description: 'Trustline and asset notifications',
    enabled: true,
    types: ['trustline_added'],
  },
  {
    id: 'contracts',
    name: 'Contracts',
    description: 'Smart contract event notifications',
    enabled: true,
    types: ['contract_event'],
  },
  {
    id: 'network',
    name: 'Network',
    description: 'Network status and alert notifications',
    enabled: true,
    types: ['network_alert'],
  },
  {
    id: 'prices',
    name: 'Prices',
    description: 'Asset price alert notifications',
    enabled: true,
    types: ['price_alert'],
  },
  {
    id: 'sync',
    name: 'Sync',
    description: 'Offline sync completion notifications',
    enabled: true,
    types: ['sync_complete'],
  },
  {
    id: 'errors',
    name: 'Errors',
    description: 'Error and failure notifications',
    enabled: true,
    types: ['error'],
  },
]

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { PermissionsAndroid } = require('react-native')
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      )
      return granted === PermissionsAndroid.RESULTS.GRANTED
    }
    return true
  } catch {
    return false
  }
}

export async function getFCMToken(): Promise<string | null> {
  try {
    const messaging = require('@react-native-firebase/messaging').default
    await messaging().registerDeviceForRemoteMessages()
    const token = await messaging().getToken()
    if (token) {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token)
    }
    return token
  } catch {
    return null
  }
}

export async function deleteFCMToken(): Promise<void> {
  try {
    const messaging = require('@react-native-firebase/messaging').default
    await messaging().deleteToken()
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY)
  } catch {}
}

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY)
  } catch {
    return null
  }
}

export async function isNotificationsEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY)
    return value !== 'false'
  } catch {
    return true
  }
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false')
  if (!enabled) {
    await deleteFCMToken()
  }
}

export async function getChannels(): Promise<NotificationChannel[]> {
  try {
    const raw = await AsyncStorage.getItem('notification_channels')
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_CHANNELS
}

export async function saveChannels(channels: NotificationChannel[]): Promise<void> {
  await AsyncStorage.setItem('notification_channels', JSON.stringify(channels))
}

export async function toggleChannel(channelId: string, enabled: boolean): Promise<NotificationChannel[]> {
  const channels = await getChannels()
  const updated = channels.map((ch) =>
    ch.id === channelId ? { ...ch, enabled } : ch,
  )
  await saveChannels(updated)
  return updated
}

export function buildNotificationPayload(
  type: NotificationType,
  data: Record<string, unknown>,
): PushNotificationPayload {
  const payloads: Record<NotificationType, PushNotificationPayload> = {
    transaction_received: {
      title: 'Payment Received',
      body: `You received ${data.amount || ''} ${data.asset || 'XLM'}`,
      data,
      priority: 'high',
      category: 'transaction',
    },
    transaction_sent: {
      title: 'Payment Sent',
      body: `You sent ${data.amount || ''} ${data.asset || 'XLM'}`,
      data,
      priority: 'normal',
      category: 'transaction',
    },
    account_merge: {
      title: 'Account Merged',
      body: 'Your account has been merged',
      data,
      priority: 'high',
      category: 'account',
    },
    trustline_added: {
      title: 'Trustline Added',
      body: `Trustline added for ${data.asset_code || 'unknown'}`,
      data,
      priority: 'normal',
      category: 'trustline',
    },
    claimable_balance: {
      title: 'Claimable Balance',
      body: `You have a claimable balance of ${data.amount || ''} ${data.asset || 'XLM'}`,
      data,
      priority: 'normal',
      category: 'balance',
    },
    contract_event: {
      title: 'Contract Event',
      body: `Contract ${data.contract_id ? String(data.contract_id).slice(0, 8) + '\u2026' : 'unknown'} triggered an event`,
      data,
      priority: 'normal',
      category: 'contract',
    },
    network_alert: {
      title: 'Network Alert',
      body: (data.message as string) || 'Network status changed',
      data,
      priority: 'high',
      category: 'network',
    },
    price_alert: {
      title: 'Price Alert',
      body: `${data.asset || 'XLM'} is now ${data.price || 'unknown'}`,
      data,
      priority: 'normal',
      category: 'price',
    },
    sync_complete: {
      title: 'Sync Complete',
      body: 'Offline data has been synchronized',
      data,
      priority: 'low',
      category: 'sync',
    },
    error: {
      title: 'Error',
      body: (data.message as string) || 'An error occurred',
      data,
      priority: 'high',
      category: 'error',
    },
  }

  return payloads[type] || payloads.error
}

export function setupForegroundHandler(): () => void {
  try {
    const messaging = require('@react-native-firebase/messaging').default
    const unsubscribe = messaging().onMessage(async (remoteMessage: any) => {
      const { notification, data } = remoteMessage
      if (notification) {
        const { default: notifee } = require('@notifee/react-native')
        const channelId = (data?.channel as string) || 'default'
        await notifee.displayNotification({
          title: notification.title,
          body: notification.body,
          android: {
            channelId,
            smallIcon: 'ic_notification',
          },
          ios: {
            sound: 'default',
          },
        })
      }
    })
    return unsubscribe
  } catch {
    return () => {}
  }
}

export function setupBackgroundHandler(): void {
  try {
    const messaging = require('@react-native-firebase/messaging').default
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      const { data } = remoteMessage
      if (data?.type) {
        const { useStore } = require('../store')
        const store = useStore.getState()
        store.addNotificationHistory({
          id: String(data.id || Date.now()),
          type: data.type as string,
          title: data.title || 'Notification',
          body: data.body || '',
          data,
        })
      }
    })
  } catch {}
}

export function onTokenRefresh(callback: (token: string) => void): () => void {
  try {
    const messaging = require('@react-native-firebase/messaging').default
    return messaging().onTokenRefresh(callback)
  } catch {
    return () => {}
  }
}
