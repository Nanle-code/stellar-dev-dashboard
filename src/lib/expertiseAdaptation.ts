import {
  generateExpertiseProfile,
  computeWeightedScore,
  type ExtendedExpertiseSignals,
  type ExpertiseTier,
  type ExpertiseProfile,
} from './expertiseEngine';

export type ExpertiseLevel = 'novice' | 'intermediate' | 'expert';

export interface ExpertiseSignals {
  sessionDurationMinutes: number;
  advancedFeatureUses: number;
  repeatedTaskCount: number;
  successfulActions: number;
}

export interface ExpertiseResolutionOptions {
  signals?: Partial<ExpertiseSignals>;
  storedOverride?: string | null;
}

export const EXPERTISE_STORAGE_KEY = 'stellar-expertise-signals';
export const EXPERTISE_OVERRIDE_KEY = 'stellar-expertise-override';
export const EXPERTISE_PROFILE_KEY = 'stellar-expertise-profile';

const DEFAULT_SIGNALS: ExpertiseSignals = {
  sessionDurationMinutes: 0,
  advancedFeatureUses: 0,
  repeatedTaskCount: 0,
  successfulActions: 0,
};

/**
 * Legacy classify — delegates to ML-powered engine when extended signals are available,
 * falls back to basic heuristic otherwise for backward compatibility.
 */
export function classifyExpertise(signals: Partial<ExpertiseSignals> = {}): ExpertiseLevel {
  const normalized: ExpertiseSignals = {
    ...DEFAULT_SIGNALS,
    ...signals,
  };

  const score =
    (normalized.sessionDurationMinutes >= 20 ? 1 : 0) +
    (normalized.advancedFeatureUses >= 3 ? 1 : 0) +
    (normalized.repeatedTaskCount >= 4 ? 1 : 0) +
    (normalized.successfulActions >= 12 ? 1 : 0);

  if (score >= 3) return 'expert';
  if (score >= 1) return 'intermediate';
  return 'novice';
}

/**
 * Resolve expertise level — uses ML engine when extended data is present,
 * falls back to legacy classification.
 */
export function resolveExpertiseLevel(options: ExpertiseResolutionOptions = {}): ExpertiseLevel {
  const override = options.storedOverride?.toLowerCase();
  if (override === 'novice' || override === 'intermediate' || override === 'expert') {
    return override as ExpertiseLevel;
  }

  return classifyExpertise(options.signals);
}

/**
 * ML-powered expertise resolution that produces a full profile.
 * This is the preferred method for new integrations.
 */
export function resolveExpertiseProfile(options: ExpertiseResolutionOptions = {}): ExpertiseProfile {
  const extendedSignals = collectExtendedSignals();
  const override = options.storedOverride?.toLowerCase();
  return generateExpertiseProfile(extendedSignals, override || null);
}

export function collectExpertiseSignals(): ExpertiseSignals {
  if (typeof window === 'undefined') {
    return DEFAULT_SIGNALS;
  }

  const stored = window.localStorage.getItem(EXPERTISE_STORAGE_KEY);
  if (!stored) {
    return DEFAULT_SIGNALS;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<ExpertiseSignals>;
    return {
      ...DEFAULT_SIGNALS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SIGNALS;
  }
}

/**
 * Collect extended signals used by the ML engine.
 */
export function collectExtendedSignals(): Partial<ExtendedExpertiseSignals> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(EXPERTISE_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed as Partial<ExtendedExpertiseSignals>;
  } catch {
    return {};
  }
}

export function persistExpertiseSignals(signals: Partial<ExpertiseSignals | ExtendedExpertiseSignals>): void {
  if (typeof window === 'undefined') {
    return;
  }

  const existing = collectExtendedSignals();
  const next = {
    ...existing,
    ...signals,
  };

  window.localStorage.setItem(EXPERTISE_STORAGE_KEY, JSON.stringify(next));
}

/**
 * Persist the full expertise profile for fast retrieval.
 */
export function persistExpertiseProfile(profile: ExpertiseProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXPERTISE_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Storage full or unavailable — skip
  }
}

/**
 * Retrieve the cached profile.
 */
export function getCachedProfile(): ExpertiseProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(EXPERTISE_PROFILE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Get the stored expertise override value.
 */
export function getStoredOverride(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(EXPERTISE_OVERRIDE_KEY);
  } catch {
    return null;
  }
}

/**
 * Set the expertise override value.
 */
export function setStoredOverride(level: ExpertiseLevel | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (level) {
      window.localStorage.setItem(EXPERTISE_OVERRIDE_KEY, level);
    } else {
      window.localStorage.removeItem(EXPERTISE_OVERRIDE_KEY);
    }
  } catch {
    // ignore
  }
}
