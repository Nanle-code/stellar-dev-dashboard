/**
 * userPreferences.ts — Issue #142, #188, #198
 * User preferences schema, defaults, and persistence helpers.
 * Custom network profiles support for multiple Horizon/RPC presets.
 */

import { getStoredValue, setStoredValue, removeStoredValue } from './storage'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddressEntry {
  label: string
  address: string
  network: string
  addedAt: string
}

export interface WidgetLayout {
  id: string
  type: string
  span: number
  order: number
  height?: number
  width?: number
  visible?: boolean // Added for Issue #198 visibility toggles
}

export interface NetworkProfile {
  id: string
  name: string
  horizonUrl: string
  sorobanUrl?: string
  passphrase: string
  createdAt: string
  updatedAt: string
}

export type PreferenceValue = string | number | boolean | string[] | number[] | Record<string, unknown> | null
export type PreferenceType = 'boolean' | 'string' | 'number' | 'select' | 'multiselect' | 'object'
export type PreferenceCategory =
  | 'general'
  | 'display'
  | 'dashboard'
  | 'data'
  | 'search'
  | 'notifications'
  | 'privacy'
  | 'accessibility'
  | 'performance'
  | 'developer'
  | 'sync'

export interface PreferenceDefinition {
  key: string
  path: string
  category: PreferenceCategory
  label: string
  type: PreferenceType
  defaultValue: PreferenceValue
  options?: PreferenceValue[]
  min?: number
  max?: number
  required?: boolean
}

export interface PreferencePreset {
  id: string
  name: string
  description: string
  values: Partial<UserPreferences>
  schemaVersion: number
  createdAt: string
  shared?: boolean
}

export interface PreferenceSyncState {
  enabled: boolean
  deviceId: string
  lastSyncedAt?: string
  remoteVersion?: number
  pendingChanges: number
  conflictStrategy: 'newest' | 'local' | 'remote'
}

export interface UserPreferences {
  schemaVersion: number
  theme: 'light' | 'dark' | 'auto'
  defaultNetwork: 'mainnet' | 'testnet' | 'futurenet' | 'local' | 'custom'
  savedAddresses: AddressEntry[]
  dashboardLayout: WidgetLayout[]
  currency: 'USD' | 'EUR' | 'XLM'
  language: string
  compactMode: boolean
  showAdvancedPanels: boolean
  autoRefresh: boolean
  fontSize: 'small' | 'medium' | 'large'
  advanced: Record<string, PreferenceValue>
  customPresets?: PreferencePreset[]
  sync: PreferenceSyncState
  customNetworkProfiles?: NetworkProfile[]
  activeCustomProfile?: string
  transactionConfirmation: {
    enabled: boolean
    largeTransactionThreshold: number // in XLM
    cooldownPeriod: number // in seconds
    requireEmailConfirmation: boolean
    confirmationEmail: string
  }
  notificationPreferences?: import('./notificationPreferences').NotificationPreferences
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const CURRENT_PREFERENCE_SCHEMA_VERSION = 3

export const DEFAULT_ADVANCED_PREFERENCES: Record<string, PreferenceValue> = {
  startTab: 'overview',
  rememberLastTab: true,
  confirmBeforeReset: true,
  defaultAccountScope: 'all',
  defaultTimeRange: '7d',
  density: 'comfortable',
  sidebarLabels: true,
  animatedTransitions: true,
  highContrastCharts: false,
  monospaceNumbers: true,
  showTooltips: true,
  chartPalette: 'balanced',
  dashboardColumns: 3,
  showPortfolioWidget: true,
  showNetworkWidget: true,
  showRiskWidget: true,
  showRecentTransactionsWidget: true,
  pinFavoriteAccounts: true,
  widgetAutoHeight: true,
  collapseEmptyWidgets: true,
  defaultExportFormat: 'json',
  includeFailedTransactions: true,
  includeTestnetData: true,
  normalizeAssetCodes: true,
  staleDataWarningMinutes: 5,
  ledgerRefreshSeconds: 30,
  cacheAccountLookups: true,
  cacheTransactionLookups: true,
  searchDefaultTypes: ['transactions', 'operations', 'accounts'],
  searchFuzzyMatching: true,
  searchSavedQuerySuggestions: true,
  searchHistoryLimit: 50,
  searchResultPageSize: 20,
  searchHighlightMatches: true,
  searchAutoRunSavedQueries: false,
  notifyTransactionFailures: true,
  notifyLargePayments: true,
  notifyNetworkDegradation: true,
  notifyTrustlineChanges: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  redactAccountIds: false,
  redactMemoText: false,
  shareAnalytics: false,
  persistSessionState: true,
  requireConfirmationForExports: false,
  keyboardShortcuts: true,
  reduceMotion: false,
  focusRing: true,
  screenReaderLabels: true,
  tableRowHeight: 'normal',
  prefetchAccountData: true,
  prefetchNetworkStats: true,
  maxConcurrentRequests: 4,
  offlineQueueEnabled: true,
  backgroundSync: true,
  developerMode: false,
  showRawXdr: false,
  showApiTimings: false,
  enableExperimentalSorobanPanels: false,
  logLevel: 'warn',
  syncAcrossDevices: false,
  syncConflictStrategy: 'newest',
}

export const PREFERENCE_SCHEMA: PreferenceDefinition[] = [
  { key: 'theme', path: 'theme', category: 'display', label: 'Theme', type: 'select', defaultValue: 'dark', options: ['light', 'dark', 'auto'], required: true },
  { key: 'defaultNetwork', path: 'defaultNetwork', category: 'general', label: 'Default Network', type: 'select', defaultValue: 'testnet', options: ['mainnet', 'testnet', 'futurenet', 'local', 'custom'], required: true },
  { key: 'currency', path: 'currency', category: 'general', label: 'Currency', type: 'select', defaultValue: 'USD', options: ['USD', 'EUR', 'XLM'], required: true },
  { key: 'language', path: 'language', category: 'general', label: 'Language', type: 'string', defaultValue: 'en', required: true },
  { key: 'compactMode', path: 'compactMode', category: 'display', label: 'Compact Mode', type: 'boolean', defaultValue: false },
  { key: 'showAdvancedPanels', path: 'showAdvancedPanels', category: 'display', label: 'Show Advanced Panels', type: 'boolean', defaultValue: true },
  { key: 'autoRefresh', path: 'autoRefresh', category: 'data', label: 'Auto Refresh', type: 'boolean', defaultValue: true },
  { key: 'fontSize', path: 'fontSize', category: 'accessibility', label: 'Font Size', type: 'select', defaultValue: 'medium', options: ['small', 'medium', 'large'] },
  ...Object.entries(DEFAULT_ADVANCED_PREFERENCES).map(([key, defaultValue]) => {
    const categoryByKey: Record<string, PreferenceCategory> = {
      startTab: 'general',
      rememberLastTab: 'general',
      confirmBeforeReset: 'general',
      defaultAccountScope: 'general',
      defaultTimeRange: 'general',
      density: 'display',
      sidebarLabels: 'display',
      animatedTransitions: 'display',
      highContrastCharts: 'display',
      monospaceNumbers: 'display',
      showTooltips: 'display',
      chartPalette: 'display',
      dashboardColumns: 'dashboard',
      showPortfolioWidget: 'dashboard',
      showNetworkWidget: 'dashboard',
      showRiskWidget: 'dashboard',
      showRecentTransactionsWidget: 'dashboard',
      pinFavoriteAccounts: 'dashboard',
      widgetAutoHeight: 'dashboard',
      collapseEmptyWidgets: 'dashboard',
      defaultExportFormat: 'data',
      includeFailedTransactions: 'data',
      includeTestnetData: 'data',
      normalizeAssetCodes: 'data',
      staleDataWarningMinutes: 'data',
      ledgerRefreshSeconds: 'data',
      cacheAccountLookups: 'data',
      cacheTransactionLookups: 'data',
      searchDefaultTypes: 'search',
      searchFuzzyMatching: 'search',
      searchSavedQuerySuggestions: 'search',
      searchHistoryLimit: 'search',
      searchResultPageSize: 'search',
      searchHighlightMatches: 'search',
      searchAutoRunSavedQueries: 'search',
      notifyTransactionFailures: 'notifications',
      notifyLargePayments: 'notifications',
      notifyNetworkDegradation: 'notifications',
      notifyTrustlineChanges: 'notifications',
      quietHoursEnabled: 'notifications',
      quietHoursStart: 'notifications',
      quietHoursEnd: 'notifications',
      redactAccountIds: 'privacy',
      redactMemoText: 'privacy',
      shareAnalytics: 'privacy',
      persistSessionState: 'privacy',
      requireConfirmationForExports: 'privacy',
      keyboardShortcuts: 'accessibility',
      reduceMotion: 'accessibility',
      focusRing: 'accessibility',
      screenReaderLabels: 'accessibility',
      tableRowHeight: 'accessibility',
      prefetchAccountData: 'performance',
      prefetchNetworkStats: 'performance',
      maxConcurrentRequests: 'performance',
      offlineQueueEnabled: 'performance',
      backgroundSync: 'performance',
      developerMode: 'developer',
      showRawXdr: 'developer',
      showApiTimings: 'developer',
      enableExperimentalSorobanPanels: 'developer',
      logLevel: 'developer',
      syncAcrossDevices: 'sync',
      syncConflictStrategy: 'sync',
    }
    const optionsByKey: Record<string, PreferenceValue[]> = {
      startTab: ['overview', 'analytics', 'search', 'settings'],
      defaultAccountScope: ['all', 'favorites', 'active'],
      defaultTimeRange: ['24h', '7d', '30d', '90d'],
      density: ['compact', 'comfortable', 'spacious'],
      chartPalette: ['balanced', 'contrast', 'colorblind'],
      dashboardColumns: [1, 2, 3, 4],
      defaultExportFormat: ['json', 'csv', 'xlsx'],
      tableRowHeight: ['compact', 'normal', 'large'],
      logLevel: ['error', 'warn', 'info', 'debug'],
      syncConflictStrategy: ['newest', 'local', 'remote'],
    }
    return {
      key,
      path: `advanced.${key}`,
      category: categoryByKey[key] || 'general',
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
      type: Array.isArray(defaultValue) ? 'multiselect' : typeof defaultValue === 'boolean' ? 'boolean' : typeof defaultValue === 'number' ? 'number' : optionsByKey[key] ? 'select' : 'string',
      defaultValue,
      options: optionsByKey[key],
      min: key === 'maxConcurrentRequests' ? 1 : undefined,
      max: key === 'maxConcurrentRequests' ? 12 : undefined,
    } as PreferenceDefinition
  }),
]

export const DEFAULT_PREFERENCES: UserPreferences = {
  schemaVersion: CURRENT_PREFERENCE_SCHEMA_VERSION,
  theme: 'dark',
  defaultNetwork: 'testnet',
  savedAddresses: [],
  dashboardLayout: [],
  currency: 'USD',
  language: 'en',
  compactMode: false,
  showAdvancedPanels: true,
  autoRefresh: true,
  fontSize: 'medium',
  advanced: { ...DEFAULT_ADVANCED_PREFERENCES },
  customPresets: [],
  sync: {
    enabled: false,
    deviceId: 'local',
    pendingChanges: 0,
    conflictStrategy: 'newest',
  },
  customNetworkProfiles: [],
  activeCustomProfile: undefined,
  transactionConfirmation: {
    enabled: true,
    largeTransactionThreshold: 1000, // in XLM
    cooldownPeriod: 30, // in seconds
    requireEmailConfirmation: false,
    confirmationEmail: '',
  },
}

const PREFS_KEY = 'user-preferences-v2'
const NETWORK_PROFILES_KEY = 'network-profiles-v1'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge<T>(base: T, override: Partial<T> | Record<string, unknown> | null | undefined): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined || override === null ? clone(base) : override) as T
  }

  const result = clone(base) as Record<string, unknown>
  Object.entries(override).forEach(([key, value]) => {
    if (isPlainObject(result[key]) && isPlainObject(value)) {
      result[key] = deepMerge(result[key], value)
    } else if (value !== undefined) {
      result[key] = value
    }
  })
  return result as T
}

function getPreferenceValue(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    return isPlainObject(value) ? value[key] : undefined
  }, source)
}

function setPreferenceValue(source: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.')
  const target = keys.slice(0, -1).reduce<Record<string, unknown>>((current, key) => {
    if (!isPlainObject(current[key])) current[key] = {}
    return current[key] as Record<string, unknown>
  }, source)
  target[keys[keys.length - 1]] = value
}

function encodeSharePayload(payload: unknown) {
  const serialized = encodeURIComponent(JSON.stringify(payload))
  if (typeof btoa === 'function') return btoa(serialized)
  return serialized
}

function decodeSharePayload<T>(token: string): T {
  const serialized = typeof atob === 'function' ? atob(token) : token
  return JSON.parse(decodeURIComponent(serialized)) as T
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function loadPreferences(): Promise<UserPreferences> {
  try {
    const stored = await getStoredValue(PREFS_KEY) as Partial<UserPreferences> | null
    return migratePreferences(stored || {})
  } catch {
    return clone(DEFAULT_PREFERENCES)
  }
}

export async function savePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
  const current = await loadPreferences()
  const next = migratePreferences(deepMerge(current, prefs))
  const explicitPendingChanges = isPlainObject(prefs.sync) && typeof prefs.sync.pendingChanges === 'number'
  next.sync = {
    ...next.sync,
    pendingChanges: explicitPendingChanges ? prefs.sync!.pendingChanges : (current.sync?.pendingChanges || 0) + 1,
  }
  await setStoredValue(PREFS_KEY, next)
  return next
}

export async function updatePreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): Promise<UserPreferences> {
  return savePreferences({ [key]: value } as Partial<UserPreferences>)
}

// ─── Dashboard Layout Helpers (Issue #198) ────────────────────────────────────

/**
 * Persists the modified dashboard layout state array.
 */
export async function saveDashboardLayout(layout: WidgetLayout[]): Promise<UserPreferences> {
  return updatePreference('dashboardLayout', layout);
}

/**
 * Retrieves the current dashboard layout array.
 */
export async function getDashboardLayout(): Promise<WidgetLayout[]> {
  const prefs = await loadPreferences();
  return prefs.dashboardLayout || [];
}

// ─── Address book helpers ─────────────────────────────────────────────────────

export async function addSavedAddress(entry: Omit<AddressEntry, 'addedAt'>): Promise<UserPreferences> {
  const prefs = await loadPreferences()
  const exists = prefs.savedAddresses.some((a) => a.address === entry.address)
  if (exists) return prefs
  return savePreferences({
    savedAddresses: [
      ...prefs.savedAddresses,
      { ...entry, addedAt: new Date().toISOString() },
    ],
  })
}

export async function removeSavedAddress(address: string): Promise<UserPreferences> {
  const prefs = await loadPreferences()
  return savePreferences({
    savedAddresses: prefs.savedAddresses.filter((a) => a.address !== address),
  })
}

// ─── Custom Network Profile helpers (Issue #188) ────────────────────────────────

/**
 * Load all custom network profiles.
 */
export async function loadNetworkProfiles(): Promise<NetworkProfile[]> {
  try {
    const stored = await getStoredValue(NETWORK_PROFILES_KEY) as NetworkProfile[] | null
    return stored || []
  } catch {
    return []
  }
}

/**
 * Save a new or updated network profile.
 * @param profile Profile to save (if no id, one is generated)
 * @returns The saved profile with id and timestamps
 */
export async function saveNetworkProfile(profile: Omit<NetworkProfile, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }): Promise<NetworkProfile> {
  const profiles = await loadNetworkProfiles()
  const now = new Date().toISOString()
  
  const profileId = profile.id || `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  
  // Check if updating existing
  const existingIndex = profiles.findIndex((p) => p.id === profileId)
  const newProfile: NetworkProfile = {
    id: profileId,
    name: profile.name,
    horizonUrl: profile.horizonUrl,
    sorobanUrl: profile.sorobanUrl,
    passphrase: profile.passphrase,
    createdAt: existingIndex >= 0 ? profiles[existingIndex].createdAt : now,
    updatedAt: now,
  }
  
  if (existingIndex >= 0) {
    profiles[existingIndex] = newProfile
  } else {
    profiles.push(newProfile)
  }
  
  await setStoredValue(NETWORK_PROFILES_KEY, profiles)
  
  // Update preferences to track active profile
  const prefs = await loadPreferences()
  await savePreferences({
    customNetworkProfiles: profiles,
    activeCustomProfile: prefs.activeCustomProfile || profileId,
  })
  
  return newProfile
}

/**
 * Delete a network profile by ID.
 */
export async function deleteNetworkProfile(profileId: string): Promise<void> {
  const profiles = await loadNetworkProfiles()
  const filtered = profiles.filter((p) => p.id !== profileId)
  await setStoredValue(NETWORK_PROFILES_KEY, filtered)
  
  // Update preferences
  const prefs = await loadPreferences()
  await savePreferences({
    customNetworkProfiles: filtered,
    activeCustomProfile: prefs.activeCustomProfile === profileId ? undefined : prefs.activeCustomProfile,
  })
}

/**
 * Get a specific profile by ID.
 */
export async function getNetworkProfile(profileId: string): Promise<NetworkProfile | null> {
  const profiles = await loadNetworkProfiles()
  return profiles.find((p) => p.id === profileId) || null
}

/**
 * Get the active profile.
 */
export async function getActiveProfile(): Promise<NetworkProfile | null> {
  const prefs = await loadPreferences()
  if (!prefs.activeCustomProfile) return null
  return getNetworkProfile(prefs.activeCustomProfile)
}

/**
 * Set the active profile.
 */
export async function setActiveProfile(profileId: string): Promise<void> {
  await savePreferences({ activeCustomProfile: profileId })
}

export async function resetPreferences(): Promise<UserPreferences> {
  const defaults = clone(DEFAULT_PREFERENCES)
  await setStoredValue(PREFS_KEY, defaults)
  return defaults
}

// ─── Advanced preference helpers (Issue #448) ────────────────────────────────

export const PREFERENCE_PRESETS: PreferencePreset[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Quiet workspace with fewer panels and lighter background activity.',
    schemaVersion: CURRENT_PREFERENCE_SCHEMA_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    values: {
      compactMode: true,
      showAdvancedPanels: false,
      autoRefresh: false,
      advanced: {
        density: 'compact',
        showPortfolioWidget: true,
        showNetworkWidget: false,
        showRiskWidget: false,
        animatedTransitions: false,
        searchSavedQuerySuggestions: false,
        notifyNetworkDegradation: false,
        prefetchAccountData: false,
        prefetchNetworkStats: false,
        backgroundSync: false,
      },
    },
  },
  {
    id: 'power-user',
    name: 'Power User',
    description: 'Dense dashboard, faster data refresh, and developer-facing details.',
    schemaVersion: CURRENT_PREFERENCE_SCHEMA_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    values: {
      compactMode: true,
      showAdvancedPanels: true,
      autoRefresh: true,
      advanced: {
        density: 'compact',
        dashboardColumns: 4,
        ledgerRefreshSeconds: 15,
        searchHistoryLimit: 100,
        searchResultPageSize: 50,
        maxConcurrentRequests: 8,
        developerMode: true,
        showRawXdr: true,
        showApiTimings: true,
        logLevel: 'info',
      },
    },
  },
  {
    id: 'analyst',
    name: 'Analyst',
    description: 'Report-friendly exports, longer history, and richer risk context.',
    schemaVersion: CURRENT_PREFERENCE_SCHEMA_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    values: {
      defaultNetwork: 'mainnet',
      showAdvancedPanels: true,
      advanced: {
        defaultTimeRange: '30d',
        defaultExportFormat: 'csv',
        showRiskWidget: true,
        includeFailedTransactions: true,
        searchHighlightMatches: true,
        notifyLargePayments: true,
        requireConfirmationForExports: true,
      },
    },
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'Larger type, reduced motion, stronger focus treatment, and screen reader labels.',
    schemaVersion: CURRENT_PREFERENCE_SCHEMA_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    values: {
      fontSize: 'large',
      compactMode: false,
      advanced: {
        density: 'spacious',
        animatedTransitions: false,
        highContrastCharts: true,
        reduceMotion: true,
        focusRing: true,
        screenReaderLabels: true,
        tableRowHeight: 'large',
      },
    },
  },
]

export function getPreferenceSchema(category?: PreferenceCategory): PreferenceDefinition[] {
  return category ? PREFERENCE_SCHEMA.filter((definition) => definition.category === category) : PREFERENCE_SCHEMA
}

export function migratePreferences(input: Partial<UserPreferences> | Record<string, unknown> | null | undefined): UserPreferences {
  const migrated = deepMerge(DEFAULT_PREFERENCES, input || {}) as UserPreferences
  migrated.schemaVersion = CURRENT_PREFERENCE_SCHEMA_VERSION
  migrated.advanced = {
    ...DEFAULT_ADVANCED_PREFERENCES,
    ...(isPlainObject((input as UserPreferences | null)?.advanced) ? (input as UserPreferences).advanced : {}),
  }
  migrated.customPresets = Array.isArray(migrated.customPresets) ? migrated.customPresets : []
  migrated.sync = {
    ...DEFAULT_PREFERENCES.sync,
    ...(isPlainObject((input as UserPreferences | null)?.sync) ? (input as UserPreferences).sync : {}),
  }
  return migrated
}

export function validatePreferences(preferences: Partial<UserPreferences>) {
  const migrated = migratePreferences(preferences as Partial<UserPreferences>)
  const errors: string[] = []
  const warnings: string[] = []

  PREFERENCE_SCHEMA.forEach((definition) => {
    const value = getPreferenceValue(migrated as unknown as Record<string, unknown>, definition.path)
    if (definition.required && (value === undefined || value === null || value === '')) {
      errors.push(`${definition.path} is required`)
    }
    if (definition.options && value !== undefined && value !== null) {
      const values = Array.isArray(value) ? value : [value]
      values.forEach((entry) => {
        if (!definition.options?.includes(entry as PreferenceValue)) {
          errors.push(`${definition.path} has unsupported value ${String(entry)}`)
        }
      })
    }
    if (definition.type === 'number' && typeof value === 'number') {
      if (definition.min !== undefined && value < definition.min) errors.push(`${definition.path} is below ${definition.min}`)
      if (definition.max !== undefined && value > definition.max) errors.push(`${definition.path} is above ${definition.max}`)
    }
    if (definition.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${definition.path} must be a boolean`)
    }
    if (definition.type === 'number' && typeof value !== 'number') {
      errors.push(`${definition.path} must be a number`)
    }
  })

  if (migrated.schemaVersion !== CURRENT_PREFERENCE_SCHEMA_VERSION) {
    warnings.push(`Preference schema will be migrated to ${CURRENT_PREFERENCE_SCHEMA_VERSION}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    preferenceCount: PREFERENCE_SCHEMA.length,
  }
}

export function applyPreferencePreset(
  presetId: string,
  current: UserPreferences = DEFAULT_PREFERENCES,
  customPresets: PreferencePreset[] = current.customPresets || []
): UserPreferences {
  const preset = [...PREFERENCE_PRESETS, ...customPresets].find((entry) => entry.id === presetId)
  if (!preset) throw new Error(`Unknown preference preset: ${presetId}`)
  return migratePreferences(deepMerge(current, preset.values))
}

export function createPreferencePreset(
  name: string,
  preferences: UserPreferences,
  options: { description?: string; shared?: boolean } = {}
): PreferencePreset {
  return {
    id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    description: options.description || '',
    values: migratePreferences(preferences),
    schemaVersion: CURRENT_PREFERENCE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    shared: Boolean(options.shared),
  }
}

export function exportPreferences(preferences: UserPreferences) {
  const migrated = migratePreferences(preferences)
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    schemaVersion: CURRENT_PREFERENCE_SCHEMA_VERSION,
    validation: validatePreferences(migrated),
    preferences: migrated,
  }, null, 2)
}

export function importPreferences(payload: string | Record<string, unknown>): UserPreferences {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload
  const candidate = isPlainObject(parsed) && isPlainObject(parsed.preferences)
    ? parsed.preferences as Partial<UserPreferences>
    : parsed as Partial<UserPreferences>
  const migrated = migratePreferences(candidate)
  const validation = validatePreferences(migrated)
  if (!validation.valid) {
    throw new Error(`Invalid preferences: ${validation.errors.join(', ')}`)
  }
  return migrated
}

export async function saveImportedPreferences(payload: string | Record<string, unknown>): Promise<UserPreferences> {
  const imported = importPreferences(payload)
  await setStoredValue(PREFS_KEY, imported)
  return imported
}

export function sharePreferencePreset(preset: PreferencePreset) {
  return encodeSharePayload({
    schemaVersion: CURRENT_PREFERENCE_SCHEMA_VERSION,
    preset,
  })
}

export function importSharedPreferencePreset(token: string): PreferencePreset {
  const payload = decodeSharePayload<{ schemaVersion: number; preset: PreferencePreset }>(token)
  if (!payload.preset || !isPreferenceVersionCompatible(payload.schemaVersion)) {
    throw new Error('Shared preset is not compatible with this preference schema')
  }
  return {
    ...payload.preset,
    schemaVersion: CURRENT_PREFERENCE_SCHEMA_VERSION,
    shared: true,
  }
}

export function isPreferenceVersionCompatible(version?: number) {
  return !version || version <= CURRENT_PREFERENCE_SCHEMA_VERSION
}

export function resolvePreferenceConflicts(
  local: UserPreferences,
  remote: UserPreferences,
  strategy: PreferenceSyncState['conflictStrategy'] = local.sync?.conflictStrategy || 'newest'
) {
  const localTime = new Date(local.sync?.lastSyncedAt || 0).getTime()
  const remoteTime = new Date(remote.sync?.lastSyncedAt || 0).getTime()
  const conflicts = PREFERENCE_SCHEMA
    .filter((definition) => {
      const localValue = getPreferenceValue(local as unknown as Record<string, unknown>, definition.path)
      const remoteValue = getPreferenceValue(remote as unknown as Record<string, unknown>, definition.path)
      return JSON.stringify(localValue) !== JSON.stringify(remoteValue)
    })
    .map((definition) => definition.path)

  const winner = strategy === 'local'
    ? local
    : strategy === 'remote'
      ? remote
      : remoteTime > localTime ? remote : local

  return {
    preferences: migratePreferences(winner),
    strategy,
    conflicts,
    resolvedAt: new Date().toISOString(),
  }
}

export function getPreferenceSyncStatus(preferences: UserPreferences, remoteVersion?: number) {
  const validation = validatePreferences(preferences)
  const incompatible = remoteVersion !== undefined && !isPreferenceVersionCompatible(remoteVersion)
  return {
    state: incompatible ? 'incompatible' : preferences.sync.pendingChanges > 0 ? 'pending' : 'synced',
    schemaVersion: preferences.schemaVersion,
    remoteVersion,
    pendingChanges: preferences.sync.pendingChanges,
    lastSyncedAt: preferences.sync.lastSyncedAt,
    conflictStrategy: preferences.sync.conflictStrategy,
    valid: validation.valid,
    issueCount: validation.errors.length + validation.warnings.length,
  }
}

export function setAdvancedPreference(
  preferences: UserPreferences,
  key: string,
  value: PreferenceValue
): UserPreferences {
  const next = migratePreferences(preferences)
  setPreferenceValue(next as unknown as Record<string, unknown>, `advanced.${key}`, value)
  return migratePreferences(next)
}
