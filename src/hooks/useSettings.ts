import { useMemo, useState } from 'react';
import {
  getActiveProfileName,
  loadConfigProfiles,
  setActiveProfileName,
  upsertProfile,
  removeProfile,
  getEnvironmentConfig,
} from '../lib/config';
import { loadPreferences, savePreferences, updatePreference } from '../utils/preferences';

export interface AppConfig {
  refreshIntervalMs: number;
  enableRealtime: boolean;
  enablePricePolling: boolean;
  maxResults: number;
  environment: string;
  [key: string]: unknown;
}

export interface ConfigProfile {
  name: string;
  config: AppConfig;
}

export interface AppPreferences {
  compactMode: boolean;
  showAdvancedPanels: boolean;
  autoRefreshDashboard: boolean;
  defaultSearchScope: string;
  [key: string]: unknown;
}

export interface UseSettingsReturn {
  profiles: ConfigProfile[];
  activeProfile: ConfigProfile;
  activeProfileName: string;
  setActiveProfile: (name: string) => void;
  saveProfile: (name: string, config: AppConfig) => void;
  deleteProfile: (name: string) => void;
  preferences: AppPreferences;
  setAllPreferences: (prefs: AppPreferences) => void;
  setPreference: (key: string, value: unknown) => void;
}

export function useSettings(): UseSettingsReturn {
  const [profiles, setProfiles] = useState<ConfigProfile[]>(() => loadConfigProfiles());
  const [activeProfileName, setActiveNameState] = useState<string>(() => getActiveProfileName());
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());

  const activeProfile = useMemo<ConfigProfile>(
    () => profiles.find((p) => p.name === activeProfileName) ?? { name: 'default', config: getEnvironmentConfig() },
    [profiles, activeProfileName],
  );

  function setActiveProfile(name: string) {
    setActiveProfileName(name);
    setActiveNameState(name);
  }

  function saveProfile(name: string, config: AppConfig) {
    setProfiles(upsertProfile(name, config));
    setActiveProfile(name);
  }

  function deleteProfile(name: string) {
    setProfiles(removeProfile(name));
    setActiveNameState(getActiveProfileName());
  }

  function setAllPreferences(nextPreferences: AppPreferences) {
    setPreferences(savePreferences(nextPreferences));
  }

  function setPreference(key: string, value: unknown) {
    setPreferences(updatePreference(key, value));
  }

  return { profiles, activeProfile, activeProfileName, setActiveProfile, saveProfile, deleteProfile, preferences, setAllPreferences, setPreference };
}

export default useSettings;
