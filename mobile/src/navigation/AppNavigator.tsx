import React, { useEffect, useState } from 'react'
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createDrawerNavigator } from '@react-navigation/drawer'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { useStore } from '../store'
import { authenticateWithBiometrics, isBiometricsEnabled } from '../services/biometrics'
import TabNavigator from './TabNavigator'
import ContractsScreen from '../screens/ContractsScreen'
import FaucetScreen from '../screens/FaucetScreen'
import PortfolioScreen from '../screens/PortfolioScreen'
import MultisigScreen from '../screens/MultisigScreen'
import ConnectScreen from '../screens/ConnectScreen'
import CustomDrawerContent from '../components/CustomDrawerContent'
import type { RootStackParamList, DrawerParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()
const Drawer = createDrawerNavigator<DrawerParamList>()

const navDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#08111f',
    card: '#0f172a',
    text: '#f8fafc',
    border: 'rgba(148, 163, 184, 0.15)',
    primary: '#00d4aa',
  },
}

function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          backgroundColor: '#0f172a',
          width: 280,
        },
        drawerLabelStyle: {
          color: '#f8fafc',
          fontSize: 14,
        },
        drawerActiveTintColor: '#00d4aa',
        drawerInactiveTintColor: '#94a3b8',
      }}
    >
      <Drawer.Screen name="MainTabs" component={TabNavigator} />
      <Drawer.Screen name="Connect" component={ConnectScreen} />
      <Drawer.Screen name="Contracts" component={ContractsScreen} />
      <Drawer.Screen name="Faucet" component={FaucetScreen} />
      <Drawer.Screen name="Portfolio" component={PortfolioScreen} />
      <Drawer.Screen name="Multisig" component={MultisigScreen} />
    </Drawer.Navigator>
  )
}

function BiometricGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const biometricsPassed = useStore((s) => s.biometricsPassed)

  useEffect(() => {
    async function check() {
      const enabled = await isBiometricsEnabled()
      if (!enabled || biometricsPassed) {
        setAuthenticated(true)
        setLoading(false)
        return
      }
      const success = await authenticateWithBiometrics()
      if (success) {
        useStore.getState().setBiometricsPassed(true)
        setAuthenticated(true)
      }
      setLoading(false)
    }
    check()
  }, [biometricsPassed])

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#00d4aa" />
      </View>
    )
  }

  if (!authenticated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    )
  }

  return <>{children}</>
}

export default function AppNavigator() {
  return (
    <NavigationContainer theme={navDarkTheme}>
      <BiometricGate>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={DrawerNavigator} />
        </Stack.Navigator>
      </BiometricGate>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#08111f',
  },
})
