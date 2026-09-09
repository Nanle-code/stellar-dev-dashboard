/**
 * useExpertiseTracking — Auto-tracks user interaction patterns for expertise classification.
 *
 * This hook automatically collects:
 *  - Feature/panel usage frequency
 *  - Task completion rates
 *  - Error rates during interactions
 *  - Keyboard shortcut usage
 *  - Advanced panel exploration
 *  - Time on task by category
 *  - Exploration score based on unique features used
 *  - Customization changes
 *  - Realtime feature usage
 *
 * Integrates with ExpertiseContext via updateSignals.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useExpertise } from '../context/ExpertiseContext';
import { addBreadcrumb } from '../lib/errorReporting';

interface TrackingConfig {
  /** Enable/disable all tracking */
  enabled: boolean;
  /** The feature/panel identifier being tracked */
  featureId?: string;
  /** Category of the current task (e.g. 'transactions', 'builder', 'network') */
  taskCategory?: string;
}

const FEATURE_INTERACTION_EVENT = 'stellar:feature-interaction';
const TASK_COMPLETE_EVENT = 'stellar:task-complete';
const TASK_ERROR_EVENT = 'stellar:task-error';
const SHORTCUT_EVENT = 'stellar:shortcut-used';
const CUSTOMIZATION_EVENT = 'stellar:customization-change';

/**
 * Hook that tracks user expertise signals automatically.
 * Should be called once at the app level (e.g., in DashboardLayout).
 */
export function useExpertiseTracking(config?: TrackingConfig) {
  const { updateSignals, signals, extendedSignals, level, isNovice, isIntermediate, isExpert } = useExpertise();
  const taskStartTime = useRef<Record<string, number>>({});
  const sessionStartTime = useRef<number>(Date.now());
  const featureOpens = useRef<Record<string, number>>({});
  const currentConfig = useRef<TrackingConfig>(config || { enabled: true });
  const successCount = useRef(0);
  const errorCount = useRef(0);
  const shortcutCount = useRef(0);
  const advancedPanelOpens = useRef(0);
  const customizationCount = useRef(0);
  const realtimeUses = useRef(0);
  const uniqueFeaturesUsed = useRef<Set<string>>(new Set());

  // Update config ref when it changes
  useEffect(() => {
    currentConfig.current = config || { enabled: true };
  }, [config]);

  /**
   * Track when a feature/panel is opened.
   */
  const trackFeatureInteraction = useCallback((featureId: string) => {
    if (!currentConfig.current.enabled) return;

    featureOpens.current[featureId] = (featureOpens.current[featureId] || 0) + 1;
    uniqueFeaturesUsed.current.add(featureId);

    // Check if this is an advanced feature
    const advancedFeatures = [
      'governance', 'devToolbar', 'compliance', 'security', 'txPatterns',
      'capacityPlanning', 'audit', 'collaboration', 'monitoringDashboards',
      'systemHealth', 'logAnalyzer', 'dataExport', 'designSystem', 'featureFlags',
    ];
    if (advancedFeatures.includes(featureId)) {
      advancedPanelOpens.current += 1;
    }

    // Check if realtime feature
    const realtimeFeatures = ['realtime', 'liveActivity', 'streaming', 'websocket'];
    if (realtimeFeatures.includes(featureId)) {
      realtimeUses.current += 1;
    }

    // Track time-on-task start
    taskStartTime.current[featureId] = Date.now();

    addBreadcrumb(`Expertise: tracked feature ${featureId}`, 'info', {
      featureId,
      count: featureOpens.current[featureId],
    });
  }, []);

  /**
   * Track when a task is completed successfully.
   */
  const trackTaskComplete = useCallback((taskId?: string) => {
    if (!currentConfig.current.enabled) return;
    successCount.current += 1;

    // Also track time-on-task if we have a start time
    if (taskId && taskStartTime.current[taskId]) {
      const duration = (Date.now() - taskStartTime.current[taskId]) / 1000;
      delete taskStartTime.current[taskId];
      addBreadcrumb(`Expertise: task ${taskId} completed in ${duration}s`, 'info');
    }

    updateSignals({
      successfulActions: (signals.successfulActions || 0) + 1,
      taskCompletionRate: calculateCompletionRate(),
    });
  }, [signals, updateSignals]);

  /**
   * Track when a task encounters an error.
   */
  const trackTaskError = useCallback((taskId?: string) => {
    if (!currentConfig.current.enabled) return;
    errorCount.current += 1;

    if (taskId && taskStartTime.current[taskId]) {
      delete taskStartTime.current[taskId];
    }

    updateSignals({
      errorRate: calculateErrorRate(),
    });
  }, [signals, updateSignals]);

  /**
   * Track keyboard shortcut usage.
   */
  const trackShortcutUsed = useCallback((shortcutName: string) => {
    if (!currentConfig.current.enabled) return;
    shortcutCount.current += 1;

    updateSignals({
      shortcutUsageCount: (extendedSignals.shortcutUsageCount || 0) + 1,
    });

    addBreadcrumb(`Expertise: shortcut ${shortcutName} used`, 'info', {
      shortcut: shortcutName,
      totalShortcuts: shortcutCount.current,
    });
  }, [extendedSignals, updateSignals]);

  /**
   * Track when a user changes a customization/preference setting.
   */
  const trackCustomization = useCallback((settingName: string) => {
    if (!currentConfig.current.enabled) return;
    customizationCount.current += 1;

    updateSignals({
      customizationCount: (extendedSignals.customizationCount || 0) + 1,
    });
  }, [extendedSignals, updateSignals]);

  /**
   * Track advanced search usage.
   */
  const trackAdvancedSearch = useCallback(() => {
    if (!currentConfig.current.enabled) return;

    updateSignals({
      advancedSearchUsage: (extendedSignals.advancedSearchUsage || 0) + 1,
    });
  }, [extendedSignals, updateSignals]);

  /**
   * Track tutorial completion.
   */
  const trackTutorialCompleted = useCallback(() => {
    if (!currentConfig.current.enabled) return;

    updateSignals({
      completedTutorials: (extendedSignals.completedTutorials || 0) + 1,
    });
  }, [extendedSignals, updateSignals]);

  // Calculate completion rate
  function calculateCompletionRate(): number {
    const total = successCount.current + errorCount.current;
    if (total === 0) return extendedSignals.taskCompletionRate || 0;
    return successCount.current / total;
  }

  // Calculate error rate
  function calculateErrorRate(): number {
    const total = successCount.current + errorCount.current;
    if (total === 0) return extendedSignals.errorRate || 0;
    return errorCount.current / total;
  }

  // Calculate exploration score
  const calculateExplorationScore = useCallback((): number => {
    const totalPossibleFeatures = 50; // approximate number of features
    return Math.min(1, uniqueFeaturesUsed.current.size / totalPossibleFeatures);
  }, []);

  /**
   * Persist aggregated signals to the context periodically.
   */
  const flushTrackingData = useCallback(() => {
    const sessionDuration = Math.floor((Date.now() - sessionStartTime.current) / 60000);

    updateSignals({
      sessionDurationMinutes: sessionDuration,
      advancedFeatureUses: advancedPanelOpens.current,
      featureUsageFrequency: { ...featureOpens.current },
      explorationScore: calculateExplorationScore(),
      realtimeFeatureUses: realtimeUses.current,
    });
  }, [updateSignals, calculateExplorationScore]);

  // Flush tracking data on unmount
  useEffect(() => {
    return () => {
      flushTrackingData();
    };
  }, [flushTrackingData]);

  // Periodic flush (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      flushTrackingData();
    }, 30000);

    return () => clearInterval(interval);
  }, [flushTrackingData]);

  return {
    trackFeatureInteraction,
    trackTaskComplete,
    trackTaskError,
    trackShortcutUsed,
    trackCustomization,
    trackAdvancedSearch,
    trackTutorialCompleted,
    flushTrackingData,
    featureOpens: featureOpens.current,
    uniqueFeaturesUsed: uniqueFeaturesUsed.current.size,
  };
}

/**
 * Higher-order component wrapper that auto-tracks feature interactions.
 * Wrap any component with this to automatically track its usage.
 * Note: Import this from a .tsx file if using JSX, or use createElement directly.
 */
export function withExpertiseTracking<P extends Record<string, unknown>>(
  WrappedComponent: React.ComponentType<P>,
  featureId: string
): React.ComponentType<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  const TrackedComponent: React.FC<P> = (props: P) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { trackFeatureInteraction } = useExpertiseTracking({ enabled: true, featureId });

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (featureId) {
        trackFeatureInteraction(featureId);
      }
    }, [featureId, trackFeatureInteraction]);

    return React.createElement(WrappedComponent, props);
  };
  TrackedComponent.displayName = `withExpertiseTracking(${displayName})`;
  return TrackedComponent;
}

