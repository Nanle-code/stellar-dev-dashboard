import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  collectExpertiseSignals,
  collectExtendedSignals,
  persistExpertiseSignals,
  persistExpertiseProfile,
  resolveExpertiseProfile,
  getCachedProfile,
  getStoredOverride,
  setStoredOverride,
  type ExpertiseLevel,
  type ExpertiseSignals,
} from '../lib/expertiseAdaptation';
import {
  type ExtendedExpertiseSignals,
  type ExpertiseProfile,
  type ExpertiseTier,
  getFeatureVisibilityForLevel,
  getDashboardViewMode,
  shouldShowGuidance,
  getTooltipDetail,
  type FeatureVisibilityConfig,
} from '../lib/expertiseEngine';

interface ExpertiseContextValue {
  level: ExpertiseLevel;
  profile: ExpertiseProfile | null;
  signals: ExpertiseSignals;
  extendedSignals: Partial<ExtendedExpertiseSignals>;
  setLevel: (level: ExpertiseLevel) => void;
  clearOverride: () => void;
  updateSignals: (patch: Partial<ExpertiseSignals | ExtendedExpertiseSignals> | ((current: any) => Partial<any>)) => void;
  isNovice: boolean;
  isIntermediate: boolean;
  isExpert: boolean;
  /** Get visibility config for a specific feature based on current level */
  getFeatureVisibility: (featureId: string) => FeatureVisibilityConfig;
  /** Current dashboard view mode (simplified/standard/detailed) */
  dashboardViewMode: 'simplified' | 'standard' | 'detailed';
  /** Whether guidance/tooltips should be shown for a given feature */
  shouldShowGuidance: (featureName: string) => boolean;
  /** Tooltip complexity level */
  tooltipDetail: 'simple' | 'normal' | 'advanced';
  /** Recompute profile from current signals */
  refreshProfile: () => void;
}

const ExpertiseContext = createContext<ExpertiseContextValue | undefined>(undefined);

export function ExpertiseProvider({ children }: { children: React.ReactNode }) {
  const [level, setLevelState] = useState<ExpertiseLevel>('novice');
  const [profile, setProfile] = useState<ExpertiseProfile | null>(null);
  const [signals, setSignals] = useState<ExpertiseSignals>(collectExpertiseSignals());
  const [extendedSignals, setExtendedSignals] = useState<Partial<ExtendedExpertiseSignals>>(collectExtendedSignals());

  // Compute profile from signals
  const computeProfile = useCallback(() => {
    const storedOverride = getStoredOverride();
    const newProfile = resolveExpertiseProfile({ storedOverride });
    setProfile(newProfile);
    setLevelState(newProfile.level as ExpertiseLevel);
    persistExpertiseProfile(newProfile);
  }, []);

  // Initial profile computation
  useEffect(() => {
    // Try to use cached profile first for performance
    const cached = getCachedProfile();
    if (cached && cached.lastUpdated) {
      const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
      // Use cache if less than 5 minutes old
      if (cacheAge < 5 * 60 * 1000) {
        setProfile(cached);
        setLevelState(cached.level as ExpertiseLevel);
        return;
      }
    }
    computeProfile();
  }, [computeProfile]);

  // Recompute when signals change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      computeProfile();
    }, 2000); // 2s debounce to avoid excessive recomputation
    return () => clearTimeout(timer);
  }, [signals, extendedSignals, computeProfile]);

  // Persist signals on change
  useEffect(() => {
    persistExpertiseSignals({ ...signals, ...extendedSignals });
  }, [signals, extendedSignals]);

  const setLevel = useCallback((next: ExpertiseLevel) => {
    setStoredOverride(next);
    setLevelState(next);
    // Recompute profile with override
    const newProfile = resolveExpertiseProfile({ storedOverride: next });
    setProfile(newProfile);
    persistExpertiseProfile(newProfile);
  }, []);

  const clearOverride = useCallback(() => {
    setStoredOverride(null);
    computeProfile();
  }, [computeProfile]);

  const updateSignals = useCallback((
    patch: Partial<ExpertiseSignals | ExtendedExpertiseSignals> | ((current: any) => Partial<any>)
  ) => {
    setSignals((current) => {
      const nextPatch = typeof patch === 'function' ? patch(current) : patch;
      return { ...current, ...nextPatch } as ExpertiseSignals;
    });
    // Also update extended signals for any extended fields
    setExtendedSignals((current) => {
      const nextPatch = typeof patch === 'function' ? patch({ ...signals, ...current }) : patch;
      return { ...current, ...nextPatch };
    });
  }, [signals]);

  const refreshProfile = useCallback(() => {
    // Re-sync extended signals from storage
    setExtendedSignals(collectExtendedSignals());
    computeProfile();
  }, [computeProfile]);

  const getFeatureVisibility = useCallback(
    (featureId: string): FeatureVisibilityConfig => {
      const configs = getFeatureVisibilityForLevel(level as ExpertiseTier);
      return configs[featureId] || { visible: true, showGuidance: false, highlighted: false, minimumLevel: 'novice' };
    },
    [level]
  );

  const visibilityCheck = useCallback(
    (featureName: string): boolean => shouldShowGuidance(level as ExpertiseTier, featureName),
    [level]
  );

  const dashboardViewMode = useMemo(() => getDashboardViewMode(level as ExpertiseTier), [level]);
  const tooltipDetail = useMemo(() => getTooltipDetail(level as ExpertiseTier), [level]);

  const value = useMemo<ExpertiseContextValue>(() => ({
    level,
    profile,
    signals,
    extendedSignals,
    setLevel,
    clearOverride,
    updateSignals,
    isNovice: level === 'novice',
    isIntermediate: level === 'intermediate',
    isExpert: level === 'expert',
    getFeatureVisibility,
    dashboardViewMode,
    shouldShowGuidance: visibilityCheck,
    tooltipDetail,
    refreshProfile,
  }), [
    level,
    profile,
    signals,
    extendedSignals,
    setLevel,
    clearOverride,
    updateSignals,
    getFeatureVisibility,
    dashboardViewMode,
    visibilityCheck,
    tooltipDetail,
    refreshProfile,
  ]);

  return <ExpertiseContext.Provider value={value}>{children}</ExpertiseContext.Provider>;
}

export function useExpertise() {
  const context = useContext(ExpertiseContext);
  if (!context) {
    throw new Error('useExpertise must be used within an ExpertiseProvider');
  }
  return context;
}
