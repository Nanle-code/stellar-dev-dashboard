import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native'
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer'
import { useStore } from '../store'
import { shortAddress } from '../services/stellar'
import { colors, radii, spacing, typography } from '../theme'

const NAV_ITEMS = [
  { label: 'Home', screen: 'MainTabs', icon: '\u2302' },
  { label: 'Connect', screen: 'Connect', icon: '\u2B21' },
  { label: 'Contracts', screen: 'Contracts', icon: '\u25A1' },
  { label: 'Faucet', screen: 'Faucet', icon: '\u2691' },
  { label: 'Portfolio', screen: 'Portfolio', icon: '\u2606' },
  { label: 'Multisig', screen: 'Multisig', icon: '\u2611' },
]

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const connectedAddress = useStore((s) => s.connectedAddress)
  const { navigation } = props

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{'\u2726'} STELLAR</Text>
        <Text style={styles.subtitle}>Dev Dashboard</Text>
        {connectedAddress && (
          <Text style={styles.address}>
            {shortAddress(connectedAddress, 8)}
          </Text>
        )}
      </View>

      <ScrollView style={styles.navList}>
        {NAV_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.screen}
            style={styles.navItem}
            onPress={() => {
              navigation.navigate(item.screen as any)
              navigation.closeDrawer()
            }}
          >
            <Text style={styles.navIcon}>{item.icon}</Text>
            <Text style={styles.navLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={() => {
          navigation.navigate('MainTabs' as any)
          navigation.closeDrawer()
        }}
      >
        <Text style={styles.settingsText}>Settings</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.cyan,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  address: {
    fontSize: typography.fontSize.xs,
    color: colors.cyan,
    marginTop: spacing.sm,
    opacity: 0.8,
  },
  navList: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md - 4,
    paddingHorizontal: spacing.lg,
  },
  navIcon: {
    fontSize: 18,
    color: colors.text.muted,
    width: 28,
  },
  navLabel: {
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  settingsBtn: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  settingsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },
})
