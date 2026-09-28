import React, { useEffect } from 'react'
import { StatusBar, LogBox } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AppNavigator from './navigation/AppNavigator'
import ErrorBoundary from './components/ErrorBoundary'
import { useStore } from './store'
import {
  subscribeToConnectivity,
  processSyncQueue,
  cacheAllOfflineData,
  getSyncQueue,
  getAllStoredAddresses,
} from './services/offline'
import {
  requestNotificationPermission,
  getFCMToken,
  setupForegroundHandler,
  onTokenRefresh,
} from './services/notifications'

LogBox.ignoreLogs(['Reanimated'])

export default function App() {
  useEffect(() => {
    const unsubNetInfo = subscribeToConnectivity(async (isConnected) => {
      useStore.getState().setIsOnline(isConnected)

      if (isConnected) {
        const { synced } = await processSyncQueue()
        if (synced > 0) {
          useStore.getState().addNotificationHistory({
            id: 'sync_complete',
            type: 'sync_complete',
            title: 'Sync Complete',
            body: `Successfully synced ${synced} pending changes`,
          })
        }

        const addresses = await getAllStoredAddresses()
        const currentAddress = useStore.getState().connectedAddress
        if (currentAddress) {
          await cacheAllOfflineData(currentAddress, useStore.getState().network)
        }
      }
    })

    return () => {
      unsubNetInfo()
    }
  }, [])

  useEffect(() => {
    async function init() {
      const hasPermission = await requestNotificationPermission()
      if (hasPermission) {
        const token = await getFCMToken()
        if (token) {
          useStore.getState().setPushToken(token)
        }

        const unsubForeground = setupForegroundHandler()

        const unsubTokenRefresh = onTokenRefresh((newToken: string) => {
          useStore.getState().setPushToken(newToken)
        })

        return () => {
          unsubForeground()
          unsubTokenRefresh()
        }
      }
    }

    init()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StatusBar barStyle="light-content" backgroundColor="#08111f" />
          <AppNavigator />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
