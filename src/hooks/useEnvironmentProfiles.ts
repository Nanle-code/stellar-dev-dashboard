/**
 * React hook for managing environment profiles
 * Integrates with the environment profiles system and provides reactive state management
 */

import { useEffect, useMemo, useState } from 'react';
import {
  loadEnvironmentProfiles,
  getActiveEnvironmentProfile,
  switchEnvironmentProfile,
  createEnvironmentProfile,
  updateEnvironmentProfile,
  deleteEnvironmentProfile,
  getEnvironmentProfile,
  getProfilesByType,
  type EnvironmentProfile,
  type EnvironmentType,
} from '../lib/environmentProfiles';

export interface UseEnvironmentProfilesReturn {
  profiles: EnvironmentProfile[];
  activeProfile: EnvironmentProfile | null;
  testnetProfiles: EnvironmentProfile[];
  mainnetProfiles: EnvironmentProfile[];
  loading: boolean;
  error: string | null;
  switchProfile: (profileId: string) => void;
  createProfile: (
    profile: Omit<EnvironmentProfile, 'id' | 'createdAt' | 'updatedAt'>,
  ) => EnvironmentProfile;
  updateProfile: (
    profileId: string,
    updates: Partial<Omit<EnvironmentProfile, 'id' | 'createdAt'>>,
  ) => EnvironmentProfile;
  deleteProfile: (profileId: string) => void;
  getProfile: (profileId: string) => EnvironmentProfile | null;
}

export function useEnvironmentProfiles(): UseEnvironmentProfilesReturn {
  const [profiles, setProfiles] = useState<EnvironmentProfile[]>(() => loadEnvironmentProfiles());
  const [activeProfile, setActiveProfile] = useState<EnvironmentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active profile on mount and when profiles change
  useEffect(() => {
    try {
      setLoading(true);
      const active = getActiveEnvironmentProfile();
      setActiveProfile(active);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load active profile');
    } finally {
      setLoading(false);
    }
  }, [profiles]);

  // Filter profiles by type
  const testnetProfiles = useMemo(() => {
    return getProfilesByType('testnet');
  }, [profiles]);

  const mainnetProfiles = useMemo(() => {
    return getProfilesByType('mainnet');
  }, [profiles]);

  // Handle profile switching
  const handleSwitchProfile = (profileId: string) => {
    try {
      setLoading(true);
      setError(null);
      switchEnvironmentProfile(profileId);
      setProfiles(loadEnvironmentProfiles());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch profile';
      setError(message);
      console.error('Profile switch error:', message);
    } finally {
      setLoading(false);
    }
  };

  // Handle profile creation
  const handleCreateProfile = (profile: Omit<EnvironmentProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      setError(null);
      const created = createEnvironmentProfile(profile);
      setProfiles(loadEnvironmentProfiles());
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create profile';
      setError(message);
      console.error('Profile creation error:', message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Handle profile update
  const handleUpdateProfile = (
    profileId: string,
    updates: Partial<Omit<EnvironmentProfile, 'id' | 'createdAt'>>,
  ) => {
    try {
      setLoading(true);
      setError(null);
      const updated = updateEnvironmentProfile(profileId, updates);
      setProfiles(loadEnvironmentProfiles());
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setError(message);
      console.error('Profile update error:', message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Handle profile deletion
  const handleDeleteProfile = (profileId: string) => {
    try {
      setLoading(true);
      setError(null);
      deleteEnvironmentProfile(profileId);
      setProfiles(loadEnvironmentProfiles());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete profile';
      setError(message);
      console.error('Profile deletion error:', message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get profile by ID
  const handleGetProfile = (profileId: string): EnvironmentProfile | null => {
    try {
      return getEnvironmentProfile(profileId);
    } catch (err) {
      console.error('Failed to get profile:', err);
      return null;
    }
  };

  return {
    profiles,
    activeProfile,
    testnetProfiles,
    mainnetProfiles,
    loading,
    error,
    switchProfile: handleSwitchProfile,
    createProfile: handleCreateProfile,
    updateProfile: handleUpdateProfile,
    deleteProfile: handleDeleteProfile,
    getProfile: handleGetProfile,
  };
}

export default useEnvironmentProfiles;
