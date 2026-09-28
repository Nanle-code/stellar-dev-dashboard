import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useStore } from '../store'
import { colors, radii, typography } from '../theme'
import OverviewScreen from '../screens/OverviewScreen'
import AccountScreen from '../screens/AccountScreen'
import TransactionsScreen from '../screens/TransactionsScreen'
import NetworkScreen from '../screens/NetworkScreen'
import DEXScreen from '../screens/DEXScreen'
import AssetsScreen from '../screens/AssetsScreen'
import SettingsScreen from '../screens/SettingsScreen'
import type { MainTabParamList } from './types'

const Tab = createBottomTabNavigator<MainTabParamList>()

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Overview: '\u2606',
    Account: '\u25C9',
    Transactions: '\u21C4',
    Network: '\u25C9',
    DEX: '\u2630',
    Assets: '\u25A0',
    Settings: '\u2699',
  }

  return (
    <Text style={[styles.tabIconText, focused && styles.tabIconFocused]}>
      {icons[label] || '\u25CF'}
    </Text>
  )
}

function MenuButton() {
  const navigation = useNavigation<any>()

  return (
    <TouchableOpacity
      style={styles.menuButton}
      onPress={() => navigation.openDrawer()}
    >
      <Text style={styles.menuIcon}>{'\u2630'}</Text>
    </TouchableOpacity>
  )
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarButton: (props) => <TouchableOpacity {...props} activeOpacity={0.7} />,
      })}
    >
      <Tab.Screen
        name="Overview"
        component={OverviewScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ tabBarLabel: 'Account' }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ tabBarLabel: 'Txns' }}
      />
      <Tab.Screen
        name="Network"
        component={NetworkScreen}
        options={{ tabBarLabel: 'Network' }}
      />
      <Tab.Screen
        name="DEX"
        component={DEXScreen}
        options={{ tabBarLabel: 'DEX' }}
      />
      <Tab.Screen
        name="Assets"
        component={AssetsScreen}
        options={{ tabBarLabel: 'Assets' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface.card,
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    paddingBottom: 4,
    paddingTop: 4,
    height: 60,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
  },
  tabIconText: {
    fontSize: 20,
    color: colors.text.muted,
  },
  tabIconFocused: {
    color: colors.cyan,
  },
  menuButton: {
    marginLeft: 12,
    padding: 8,
  },
  menuIcon: {
    fontSize: 22,
    color: colors.text.primary,
  },
})
