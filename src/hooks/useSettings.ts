import { useMemo, useState } from "react";
import {
  getActiveProfileName,
  loadConfigProfiles,
  setActiveProfileName,
  upsertProfile,
  removeProfile,
  getEnvironmentConfig,
} from "../lib/config";
import {
  loadPreferences,
  savePreferences,
  updatePreference,
} from "../utils/preferences";

export interface ConfigProfile {
  name: string;
  config: Record<string, unknown>;
}

export interface SettingsPreferences {
  compactMode: boolean;
  showAdvancedPanels: boolean;
  autoRefreshDashboard: boolean;
  defaultSearchScope: string;
  diagnosticsConsent: boolean;
  [key: string]: unknown;
}

export interface UseSettingsReturn {
  profiles: ConfigProfile[];
  activeProfile: ConfigProfile;
  activeProfileName: string;
  setActiveProfile: (name: string) => void;
  saveProfile: (name: string, config: Record<string, unknown>) => void;
  deleteProfile: (name: string) => void;
  preferences: SettingsPreferences;
  setAllPreferences: (nextPreferences: SettingsPreferences) => void;
  setPreference: (key: string, value: unknown) => void;
}

export function useSettings(): UseSettingsReturn {
  const [profiles, setProfiles] = useState<ConfigProfile[]>(() => loadConfigProfiles() as ConfigProfile[]);
  const [activeProfileName, setActiveNameState] = useState<string>(() => getActiveProfileName() as string);
  const [preferences, setPreferences] = useState<SettingsPreferences>(() => loadPreferences() as SettingsPreferences);

  const activeProfile = useMemo(() => {
    return (
      profiles.find((profile) => profile.name === activeProfileName) || {
        name: "default",
        config: getEnvironmentConfig(),
      }
    );
  }, [profiles, activeProfileName]);

  function setActiveProfile(name: string): void {
    setActiveProfileName(name);
    setActiveNameState(name);
  }

  function saveProfile(name: string, config: Record<string, unknown>): void {
    const nextProfiles = upsertProfile(name, config) as ConfigProfile[];
    setProfiles(nextProfiles);
    setActiveProfile(name);
  }

  function deleteProfile(name: string): void {
    const nextProfiles = removeProfile(name) as ConfigProfile[];
    setProfiles(nextProfiles);
    const nextActive = getActiveProfileName() as string;
    setActiveNameState(nextActive);
  }

  function setAllPreferences(nextPreferences: SettingsPreferences): void {
    setPreferences(savePreferences(nextPreferences) as SettingsPreferences);
  }

  function setPreference(key: string, value: unknown): void {
    setPreferences(updatePreference(key, value) as SettingsPreferences);
  }

  return {
    profiles,
    activeProfile,
    activeProfileName,
    setActiveProfile,
    saveProfile,
    deleteProfile,
    preferences,
    setAllPreferences,
    setPreference,
  };
}

export default useSettings;
