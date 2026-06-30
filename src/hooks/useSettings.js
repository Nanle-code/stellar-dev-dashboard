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

export function useSettings() {
  const [profiles, setProfiles] = useState(() => loadConfigProfiles());
  const [activeProfileName, setActiveNameState] = useState(() => getActiveProfileName());
  const [preferences, setPreferences] = useState(() => loadPreferences());

  const activeProfile = useMemo(() => {
    return (
      profiles.find((profile) => profile.name === activeProfileName) || {
        name: "default",
        config: getEnvironmentConfig(),
      }
    );
  }, [profiles, activeProfileName]);

  function setActiveProfile(name) {
    setActiveProfileName(name);
    setActiveNameState(name);
  }

  function saveProfile(name, config) {
    const nextProfiles = upsertProfile(name, config);
    setProfiles(nextProfiles);
    setActiveProfile(name);
  }

  function deleteProfile(name) {
    const nextProfiles = removeProfile(name);
    setProfiles(nextProfiles);
    const nextActive = getActiveProfileName();
    setActiveNameState(nextActive);
  }

  function setAllPreferences(nextPreferences) {
    setPreferences(savePreferences(nextPreferences));
  }

  function setPreference(key, value) {
    setPreferences(updatePreference(key, value));
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
