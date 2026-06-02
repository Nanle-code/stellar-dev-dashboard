const PREFERENCES_KEY = "user-preferences";

export const DEFAULT_PREFERENCES = {
  compactMode: false,
  showAdvancedPanels: true,
  autoRefreshDashboard: true,
  defaultSearchScope: "all",
};

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(preferences) {
  const next = { ...DEFAULT_PREFERENCES, ...(preferences || {}) };
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  return next;
}

export function updatePreference(key, value) {
  const current = loadPreferences();
  const next = { ...current, [key]: value };
  return savePreferences(next);
}
