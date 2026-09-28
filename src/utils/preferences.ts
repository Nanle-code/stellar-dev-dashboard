const PREFERENCES_KEY = "user-preferences";

/** Bump this when the analytics or diagnostics policy changes materially. */
export const ANALYTICS_POLICY_VERSION = '1';

export const DEFAULT_PREFERENCES = {
  compactMode: false,
  showAdvancedPanels: true,
  autoRefreshDashboard: true,
  defaultSearchScope: "all",
  diagnosticsConsent: false,
  analyticsConsent: false,
  analyticsConsentPolicyVersion: null,
  analyticsConsentReviewedVersion: null,
};

function isPreferencesRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePreferences(value: unknown) {
  const parsed = isPreferencesRecord(value) ? value : {};
  const consentIsCurrent = parsed.analyticsConsent === true
    && parsed.analyticsConsentPolicyVersion === ANALYTICS_POLICY_VERSION
    && parsed.analyticsConsentReviewedVersion === ANALYTICS_POLICY_VERSION;

  return {
    ...DEFAULT_PREFERENCES,
    ...parsed,
    diagnosticsConsent: consentIsCurrent,
    analyticsConsent: consentIsCurrent,
    analyticsConsentPolicyVersion: typeof parsed.analyticsConsentPolicyVersion === 'string'
      ? parsed.analyticsConsentPolicyVersion
      : null,
    analyticsConsentReviewedVersion: typeof parsed.analyticsConsentReviewedVersion === 'string'
      ? parsed.analyticsConsentReviewedVersion
      : null,
  };
}

export function loadPreferences() {
  try {
    if (typeof localStorage === 'undefined') return normalizePreferences({});
    const raw = localStorage.getItem(PREFERENCES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return normalizePreferences(parsed);
  } catch {
    return normalizePreferences({});
  }
}

export function savePreferences(preferences) {
  const current = loadPreferences();
  const next = normalizePreferences({ ...current, ...(isPreferencesRecord(preferences) ? preferences : {}) });
  if (typeof localStorage === 'undefined') {
    throw new Error('Preferences cannot be saved in this environment.');
  }
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  return next;
}

export function updatePreference(key, value) {
  const current = loadPreferences();
  const next = { ...current, [key]: value };
  return savePreferences(next);
}
