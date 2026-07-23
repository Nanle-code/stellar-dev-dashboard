import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { useStore } from '../store'
import { fetchAccount, fetchTransactions, fetchOperations } from './stellar'

const OFFLINE_DATA_PREFIX = 'offline_'
const SYNC_QUEUE_KEY = 'sync_queue'
const CONFLICT_LOG_KEY = 'conflict_log'
const STORED_ADDRESSES_KEY = 'stored_addresses'

export interface OfflineData {
  key: string
  data: unknown
  timestamp: number
  version: number
}

export interface SyncQueueItem {
  id: string
  type: 'account_refresh' | 'transactions_refresh' | 'operations_refresh'
  payload: Record<string, unknown>
  createdAt: number
  retryCount: number
}

export interface ConflictRecord {
  id: string
  key: string
  localTimestamp: number
  remoteTimestamp: number
  localData: unknown
  remoteData: unknown
  resolution: 'local' | 'remote' | 'manual'
  resolvedAt?: number
}

export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch()
    return state.isConnected ?? false
  } catch {
    return true
  }
}

export function subscribeToConnectivity(callback: (isConnected: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    callback(state.isConnected ?? false)
  })
}

export async function storeOfflineData(key: string, data: unknown): Promise<void> {
  try {
    const existing = await getOfflineData<{ version: number }>(key)
    const entry: OfflineData = {
      key,
      data,
      timestamp: Date.now(),
      version: (existing?.version || 0) + 1,
    }
    await AsyncStorage.setItem(OFFLINE_DATA_PREFIX + key, JSON.stringify(entry))
  } catch {}
}

export async function getOfflineData<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_DATA_PREFIX + key)
    if (!raw) return null
    const entry: OfflineData = JSON.parse(raw) as OfflineData
    return entry.data as T
  } catch {
    return null
  }
}

export async function getOfflineDataWithMeta<T>(key: string): Promise<OfflineData | null> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_DATA_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as OfflineData
  } catch {
    return null
  }
}

export async function removeOfflineData(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(OFFLINE_DATA_PREFIX + key)
  } catch {}
}

export async function getAllStoredAddresses(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORED_ADDRESSES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function addStoredAddress(address: string): Promise<void> {
  try {
    const addresses = await getAllStoredAddresses()
    if (!addresses.includes(address)) {
      addresses.push(address)
      await AsyncStorage.setItem(STORED_ADDRESSES_KEY, JSON.stringify(addresses))
    }
  } catch {}
}

export async function removeStoredAddress(address: string): Promise<void> {
  try {
    const addresses = await getAllStoredAddresses()
    const filtered = addresses.filter((a) => a !== address)
    await AsyncStorage.setItem(STORED_ADDRESSES_KEY, JSON.stringify(filtered))
    await removeOfflineData(`account:${address}`)
    await removeOfflineData(`transactions:${address}`)
    await removeOfflineData(`operations:${address}`)
  } catch {}
}

export async function cacheAccountData(publicKey: string, network: string): Promise<void> {
  try {
    const account = await fetchAccount(publicKey, network as any)
    await storeOfflineData(`account:${publicKey}`, account)
    await addStoredAddress(publicKey)
  } catch {}
}

export async function cacheTransactionsData(
  publicKey: string,
  network: string,
): Promise<void> {
  try {
    const { records } = await fetchTransactions(publicKey, network as any, 50)
    await storeOfflineData(`transactions:${publicKey}`, records)
  } catch {}
}

export async function cacheOperationsData(
  publicKey: string,
  network: string,
): Promise<void> {
  try {
    const { records } = await fetchOperations(publicKey, network as any, 50)
    await storeOfflineData(`operations:${publicKey}`, records)
  } catch {}
}

export async function cacheAllOfflineData(
  publicKey: string,
  network: string,
): Promise<void> {
  await Promise.allSettled([
    cacheAccountData(publicKey, network),
    cacheTransactionsData(publicKey, network),
    cacheOperationsData(publicKey, network),
  ])
  const store = useStore.getState()
  store.setLastSyncTimestamp(Date.now())
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
  const queue = await getSyncQueue()
  const newItem: SyncQueueItem = {
    ...item,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    retryCount: 0,
  }
  queue.push(newItem)
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const queue = await getSyncQueue()
  const filtered = queue.filter((item) => item.id !== id)
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered))
}

export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (!(await isOnline())) return { synced: 0, failed: 0 }

  const queue = await getSyncQueue()
  let synced = 0
  let failed = 0

  for (const item of queue) {
    try {
      const { publicKey, network } = item.payload as Record<string, string>

      if (item.type === 'account_refresh') {
        await cacheAccountData(publicKey, network)
      } else if (item.type === 'transactions_refresh') {
        await cacheTransactionsData(publicKey, network)
      } else if (item.type === 'operations_refresh') {
        await cacheOperationsData(publicKey, network)
      }

      await removeFromSyncQueue(item.id)
      synced++
    } catch {
      item.retryCount++
      if (item.retryCount >= 3) {
        await logConflict({
          key: item.type,
          localTimestamp: item.createdAt,
          remoteTimestamp: Date.now(),
          localData: item,
          remoteData: null,
          resolution: 'local',
        })
        await removeFromSyncQueue(item.id)
      }
      failed++
    }
  }

  return { synced, failed }
}

export async function getConflictLog(): Promise<ConflictRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(CONFLICT_LOG_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function logConflict(
  conflict: Omit<ConflictRecord, 'id' | 'resolvedAt'>,
): Promise<void> {
  const log = await getConflictLog()
  log.push({
    ...conflict,
    id: `conflict_${Date.now()}`,
    resolvedAt: Date.now(),
  })
  await AsyncStorage.setItem(CONFLICT_LOG_KEY, JSON.stringify(log.slice(-100)))
}

export async function clearConflictLog(): Promise<void> {
  await AsyncStorage.removeItem(CONFLICT_LOG_KEY)
}

export async function getStoredAccountData(
  publicKey: string,
): Promise<{ local: any; remote: any } | null> {
  const local = await getOfflineData<any>(`account:${publicKey}`)
  try {
    const store = useStore.getState()
    const remote = await fetchAccount(publicKey, store.network)
    return { local, remote }
  } catch {
    return local ? { local, remote: null } : null
  }
}

export async function resolveConflict(
  conflictId: string,
  resolution: 'local' | 'remote',
): Promise<void> {
  const log = await getConflictLog()
  const updated = log.map((c) =>
    c.id === conflictId ? { ...c, resolution, resolvedAt: Date.now() } : c,
  )
  await AsyncStorage.setItem(CONFLICT_LOG_KEY, JSON.stringify(updated))
}

export function getLastSyncTimestamp(): number | null {
  return useStore.getState().lastSyncTimestamp
}
