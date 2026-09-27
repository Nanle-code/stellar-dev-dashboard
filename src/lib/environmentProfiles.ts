/**
 * Multi-environment configuration profiles for Testnet and Mainnet
 * Allows developers to switch between named environment profiles without manual edits
 */

import { NetworkName, NetworkConfig, NETWORKS } from './stellar';

export type EnvironmentType = 'testnet' | 'mainnet';

export interface EnvironmentProfile {
  id: string;
  name: string;
  type: EnvironmentType;
  horizonUrl: string;
  sorobanUrl: string;
  passphrase: string;
  faucetUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentProfileConfig {
  profiles: EnvironmentProfile[];
  activeProfileId: string;
}

const STORAGE_KEY = 'env-profiles';
const ACTIVE_PROFILE_KEY = 'active-env-profile';

/**
 * Built-in environment profiles for Testnet and Mainnet
 */
const BUILT_IN_PROFILES: EnvironmentProfile[] = [
  {
    id: 'testnet-official',
    name: 'Testnet (Official)',
    type: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanUrl: 'https://soroban-testnet.stellar.org',
    passphrase: 'Test SDF Network ; September 2015',
    faucetUrl: 'https://friendbot.stellar.org',
    description: 'Official Stellar Testnet environment',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mainnet-official',
    name: 'Mainnet (Official)',
    type: 'mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanUrl: 'https://soroban-rpc.stellar.org',
    passphrase: 'Public Global Stellar Network ; September 2015',
    description: 'Official Stellar Mainnet environment (production)',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Validates environment profile for required fields and format
 * @throws Error if profile is invalid
 */
export function validateEnvironmentProfile(profile: Partial<EnvironmentProfile>): void {
  const errors: string[] = [];

  if (!profile.name || typeof profile.name !== 'string' || !profile.name.trim()) {
    errors.push('Profile name is required and must be a non-empty string');
  }

  if (!profile.type || !['testnet', 'mainnet'].includes(profile.type)) {
    errors.push('Profile type must be either "testnet" or "mainnet"');
  }

  if (!profile.horizonUrl || typeof profile.horizonUrl !== 'string' || !profile.horizonUrl.trim()) {
    errors.push('Horizon URL is required and must be a non-empty string');
  } else {
    try {
      new URL(profile.horizonUrl);
    } catch {
      errors.push('Horizon URL must be a valid URL');
    }
  }

  if (!profile.sorobanUrl || typeof profile.sorobanUrl !== 'string' || !profile.sorobanUrl.trim()) {
    errors.push('Soroban URL is required and must be a non-empty string');
  } else {
    try {
      new URL(profile.sorobanUrl);
    } catch {
      errors.push('Soroban URL must be a valid URL');
    }
  }

  if (!profile.passphrase || typeof profile.passphrase !== 'string' || !profile.passphrase.trim()) {
    errors.push('Passphrase is required and must be a non-empty string');
  }

  if (profile.faucetUrl && typeof profile.faucetUrl === 'string' && profile.faucetUrl.trim()) {
    try {
      new URL(profile.faucetUrl);
    } catch {
      errors.push('Faucet URL must be a valid URL');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment profile: ${errors.join('; ')}`);
  }
}

/**
 * Load all environment profiles from storage
 * Returns built-in profiles merged with user-created profiles
 */
export function loadEnvironmentProfiles(): EnvironmentProfile[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return BUILT_IN_PROFILES;
    }

    const parsed = JSON.parse(stored) as EnvironmentProfile[];
    // Merge user profiles with built-in profiles, user profiles take precedence
    const userProfileIds = new Set(parsed.map((p) => p.id));
    const builtInNotOverridden = BUILT_IN_PROFILES.filter((p) => !userProfileIds.has(p.id));

    return [...parsed, ...builtInNotOverridden];
  } catch {
    return BUILT_IN_PROFILES;
  }
}

/**
 * Save environment profiles to storage
 */
export function saveEnvironmentProfiles(profiles: EnvironmentProfile[]): void {
  // Only save user-created profiles (not built-in ones)
  const userProfiles = profiles.filter((p) => !BUILT_IN_PROFILES.some((bp) => bp.id === p.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfiles));
}

/**
 * Get active environment profile ID
 */
export function getActiveEnvironmentProfileId(): string {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) || 'testnet-official';
}

/**
 * Set active environment profile
 * @throws Error if profile ID is invalid
 */
export function setActiveEnvironmentProfile(profileId: string): void {
  const profiles = loadEnvironmentProfiles();
  const profile = profiles.find((p) => p.id === profileId);

  if (!profile) {
    throw new Error(`Environment profile not found: ${profileId}`);
  }

  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
}

/**
 * Get active environment profile
 */
export function getActiveEnvironmentProfile(): EnvironmentProfile {
  const profiles = loadEnvironmentProfiles();
  const activeId = getActiveEnvironmentProfileId();
  const profile = profiles.find((p) => p.id === activeId);

  if (!profile) {
    // Fallback to testnet-official if active profile not found
    return BUILT_IN_PROFILES[0];
  }

  return profile;
}

/**
 * Get environment profile by ID
 */
export function getEnvironmentProfile(profileId: string): EnvironmentProfile | null {
  const profiles = loadEnvironmentProfiles();
  return profiles.find((p) => p.id === profileId) || null;
}

/**
 * Create a new custom environment profile
 * @throws Error if profile is invalid or name already exists
 */
export function createEnvironmentProfile(
  profile: Omit<EnvironmentProfile, 'id' | 'createdAt' | 'updatedAt'>,
): EnvironmentProfile {
  validateEnvironmentProfile(profile);

  const profiles = loadEnvironmentProfiles();
  const now = new Date().toISOString();

  // Check for duplicate names
  if (profiles.some((p) => p.name === profile.name)) {
    throw new Error(`Environment profile with name "${profile.name}" already exists`);
  }

  const newProfile: EnvironmentProfile = {
    ...profile,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  };

  profiles.push(newProfile);
  saveEnvironmentProfiles(profiles);

  return newProfile;
}

/**
 * Update an existing environment profile
 * @throws Error if profile is invalid or not found
 */
export function updateEnvironmentProfile(
  profileId: string,
  updates: Partial<Omit<EnvironmentProfile, 'id' | 'createdAt'>>,
): EnvironmentProfile {
  const profiles = loadEnvironmentProfiles();
  const index = profiles.findIndex((p) => p.id === profileId);

  if (index === -1) {
    throw new Error(`Environment profile not found: ${profileId}`);
  }

  const existing = profiles[index];
  const updated: EnvironmentProfile = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  validateEnvironmentProfile(updated);

  // Check for duplicate names (excluding current profile)
  if (
    updates.name &&
    profiles.some((p) => p.id !== profileId && p.name === updates.name)
  ) {
    throw new Error(`Environment profile with name "${updates.name}" already exists`);
  }

  profiles[index] = updated;
  saveEnvironmentProfiles(profiles);

  return updated;
}

/**
 * Delete an environment profile
 * @throws Error if profile not found, is built-in, or is active
 */
export function deleteEnvironmentProfile(profileId: string): void {
  // Prevent deletion of built-in profiles
  if (BUILT_IN_PROFILES.some((p) => p.id === profileId)) {
    throw new Error('Cannot delete built-in environment profile');
  }

  // Prevent deletion of active profile
  if (getActiveEnvironmentProfileId() === profileId) {
    throw new Error('Cannot delete the active environment profile. Switch to another profile first.');
  }

  const profiles = loadEnvironmentProfiles();
  const filtered = profiles.filter((p) => p.id !== profileId);

  if (filtered.length === profiles.length) {
    throw new Error(`Environment profile not found: ${profileId}`);
  }

  saveEnvironmentProfiles(filtered);
}

/**
 * Switch to an environment profile and update app configuration
 * This updates both the active profile and network settings
 * @throws Error if profile not found or invalid environment type
 */
export function switchEnvironmentProfile(profileId: string): EnvironmentProfile {
  const profile = getEnvironmentProfile(profileId);

  if (!profile) {
    throw new Error(`Cannot switch to environment profile: Profile not found (${profileId})`);
  }

  setActiveEnvironmentProfile(profileId);

  // Update global network configuration if needed
  if (profile.type === 'testnet' || profile.type === 'mainnet') {
    const networkName: NetworkName = profile.type === 'testnet' ? 'testnet' : 'mainnet';
    if (NETWORKS[networkName]) {
      NETWORKS[networkName].horizonUrl = profile.horizonUrl;
      NETWORKS[networkName].sorobanUrl = profile.sorobanUrl;
      NETWORKS[networkName].passphrase = profile.passphrase;
      if (profile.faucetUrl) {
        NETWORKS[networkName].faucetUrl = profile.faucetUrl;
      }
    }
  }

  return profile;
}

/**
 * Get all profiles filtered by environment type
 */
export function getProfilesByType(type: EnvironmentType): EnvironmentProfile[] {
  return loadEnvironmentProfiles().filter((p) => p.type === type);
}

/**
 * Get environment type from network name
 */
export function getEnvironmentTypeFromNetwork(network: NetworkName): EnvironmentType | null {
  switch (network) {
    case 'testnet':
      return 'testnet';
    case 'mainnet':
      return 'mainnet';
    default:
      return null;
  }
}

/**
 * Validate that a profile is for a supported environment
 */
export function isSupportedEnvironment(type: EnvironmentType): boolean {
  return ['testnet', 'mainnet'].includes(type);
}

/**
 * Get default profile for environment type
 */
export function getDefaultProfileForType(type: EnvironmentType): EnvironmentProfile | null {
  const profiles = getProfilesByType(type);
  return profiles.length > 0 ? profiles[0] : null;
}
