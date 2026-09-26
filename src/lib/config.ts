const PROFILE_KEY = "app-config-profiles";
const ACTIVE_PROFILE_KEY = "app-config-active-profile";

export const DEFAULT_CONFIG = {
  refreshIntervalMs: 30000,
  enableRealtime: true,
  enablePricePolling: true,
  maxResults: 50,
  environment: "development",
};

export function getEnvironmentConfig() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  return {
    ...DEFAULT_CONFIG,
    environment: isLocal ? "development" : "production",
    refreshIntervalMs: isLocal ? 10000 : 30000,
  };
}

export function loadConfigProfiles() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : [{ name: "default", config: getEnvironmentConfig() }];
  } catch {
    return [{ name: "default", config: getEnvironmentConfig() }];
  }
}

export function saveConfigProfiles(profiles) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  return profiles;
}

export function getActiveProfileName() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) || "default";
}

export function setActiveProfileName(name) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, name);
  return name;
}

export function upsertProfile(name, config) {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) return loadConfigProfiles();

  const profiles = loadConfigProfiles();
  const withoutCurrent = profiles.filter((profile) => profile.name !== normalizedName);
  const next = [{ name: normalizedName, config }, ...withoutCurrent].slice(0, 20);
  return saveConfigProfiles(next);
}

export function removeProfile(name) {
  const profiles = loadConfigProfiles().filter((profile) => profile.name !== name);
  const next = profiles.length
    ? profiles
    : [{ name: "default", config: getEnvironmentConfig() }];
  saveConfigProfiles(next);
  if (!next.some((profile) => profile.name === getActiveProfileName())) {
    setActiveProfileName(next[0].name);
  }
  return next;
}
