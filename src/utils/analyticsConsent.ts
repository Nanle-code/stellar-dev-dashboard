import {
  ANALYTICS_POLICY_VERSION,
  loadPreferences,
  savePreferences,
} from './preferences';

export type AnalyticsConsentListener = (_allowed: boolean) => void;

const PREFERENCES_KEY = 'user-preferences';
const consentListeners = new Set<AnalyticsConsentListener>();
let sessionConsentOverride: boolean | null = null;

function storedConsentIsCurrent(): boolean {
  const preferences = loadPreferences();
  return preferences.analyticsConsent === true
    && preferences.analyticsConsentPolicyVersion === ANALYTICS_POLICY_VERSION
    && preferences.analyticsConsentReviewedVersion === ANALYTICS_POLICY_VERSION;
}

/** Consent is opt-in and only applies to the policy version the user reviewed. */
export function hasCurrentAnalyticsConsent(): boolean {
  return sessionConsentOverride ?? storedConsentIsCurrent();
}

/** A new or materially changed policy must be reviewed once before tracking. */
export function needsAnalyticsConsentReview(): boolean {
  return loadPreferences().analyticsConsentReviewedVersion !== ANALYTICS_POLICY_VERSION;
}

export function subscribeToAnalyticsConsent(listener: AnalyticsConsentListener): () => void {
  consentListeners.add(listener);
  return () => consentListeners.delete(listener);
}

function notifyConsentChange(allowed: boolean): void {
  consentListeners.forEach(listener => {
    try {
      listener(allowed);
    } catch {
      // A consent listener must not prevent the user's decision from taking effect.
    }
  });
}

/**
 * Persist an explicit choice. Withdrawal is applied in memory before storage is
 * touched; granting remains fail-closed until its versioned choice is saved.
 */
export function saveAnalyticsConsentDecision(allowed: boolean) {
  if (typeof allowed !== 'boolean') {
    throw new TypeError('Analytics consent must be a boolean.');
  }

  if (!allowed) {
    sessionConsentOverride = false;
    notifyConsentChange(false);
  }

  const current = loadPreferences();
  const saved = savePreferences({
    ...current,
    analyticsConsent: allowed,
    diagnosticsConsent: allowed,
    analyticsConsentPolicyVersion: ANALYTICS_POLICY_VERSION,
    analyticsConsentReviewedVersion: ANALYTICS_POLICY_VERSION,
  });

  sessionConsentOverride = allowed;
  if (allowed) notifyConsentChange(true);
  return saved;
}

/** Apply another tab's persisted choice without writing it again. */
export function syncAnalyticsConsentFromStorage(): void {
  sessionConsentOverride = storedConsentIsCurrent();
  notifyConsentChange(sessionConsentOverride);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === PREFERENCES_KEY || event.key === null) {
      syncAnalyticsConsentFromStorage();
    }
  });
}
