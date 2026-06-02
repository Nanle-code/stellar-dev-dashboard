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

export interface UserPreferences {
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
  customNetworkProfiles?: NetworkProfile[]
  activeCustomProfile?: string
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_PREFERENCES: UserPreferences = {
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
  customNetworkProfiles: [],
  activeCustomProfile: undefined,
}

const PREFS_KEY = 'user-preferences-v2'
const NETWORK_PROFILES_KEY = 'network-profiles-v1'

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function loadPreferences(): Promise<UserPreferences> {
  try {
    const stored = await getStoredValue(PREFS_KEY) as Partial<UserPreferences> | null
    return { ...DEFAULT_PREFERENCES, ...(stored || {}) }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export async function savePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
  const current = await loadPreferences()
  const next = { ...current, ...prefs }
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
  await setStoredValue(PREFS_KEY, DEFAULT_PREFERENCES)
  return { ...DEFAULT_PREFERENCES }
}
