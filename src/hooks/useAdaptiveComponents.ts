/**
 * useAdaptiveComponents — Hook that provides component visibility/behavior configuration
 * based on the user's detected expertise level.
 *
 * This drives the progressive disclosure system: novice users see simplified views
 * with guidance, while experts get full access to all features.
 *
 * Integrates with:
 *  - Sidebar (filter nav items)
 *  - DashboardGrid (show/hide widgets)
 *  - DashboardLayout (overall view mode)
 *  - Individual components (simplified vs detailed rendering)
 */

import { useMemo } from 'react';
import { useExpertise } from '../context/ExpertiseContext';
import {
  getFeatureVisibilityForLevel,
  getDashboardViewMode,
  shouldShowGuidance as checkShouldShowGuidance,
  getTooltipDetail,
  type ExpertiseTier,
  type FeatureVisibilityConfig,
} from '../lib/expertiseEngine';

export interface ComponentAdaptation {
  /** Whether the component should be rendered */
  visible: boolean;
  /** Whether to show simplified version */
  simplified: boolean;
  /** Whether to show guidance/tooltips */
  showGuidance: boolean;
  /** Whether the component is highlighted */
  highlighted: boolean;
  /** Tooltip detail level */
  tooltipDetail: 'simple' | 'normal' | 'advanced';
  /** Detailed config from the engine */
  config: FeatureVisibilityConfig;
}

export interface SidebarAdaptation {
  /** Ordered list of visible nav items with their adaptations */
  visibleItems: Array<{ id: string; adaptation: ComponentAdaptation }>;
  /** Whether sidebar labels should be shown */
  showLabels: boolean;
  /** Whether to show the full expanded sidebar */
  expanded: boolean;
}

export interface DashboardAdaptation {
  /** Overall view mode */
  viewMode: 'simplified' | 'standard' | 'detailed';
  /** Number of grid columns */
  gridColumns: number;
  /** Whether to show compact cards */
  compactCards: boolean;
  /** Whether advanced features section is visible */
  showAdvancedSection: boolean;
  /** Whether to show data table with all columns */
  showFullDataTables: boolean;
}

/**
 * Hook that returns adaptation configs for components based on expertise level.
 * Use this in any component that needs to adapt its rendering.
 */
export function useAdaptiveComponents() {
  const {
    level,
    getFeatureVisibility,
    dashboardViewMode,
    shouldShowGuidance: contextShouldShowGuidance,
    tooltipDetail,
    isNovice,
    isIntermediate,
    isExpert,
  } = useExpertise();

  /**
   * Get adaptation config for a specific feature/component.
   */
  const getAdaptation = (featureId: string): ComponentAdaptation => {
    const config = getFeatureVisibility(featureId);
    return {
      visible: config.visible,
      simplified: dashboardViewMode === 'simplified',
      showGuidance: config.showGuidance,
      highlighted: config.highlighted,
      tooltipDetail,
      config,
    };
  };

  /**
   * Dashboard-level adaptation config.
   */
  const dashboardAdaptation = useMemo<DashboardAdaptation>(() => ({
    viewMode: dashboardViewMode,
    gridColumns: isNovice ? 1 : isIntermediate ? 2 : 3,
    compactCards: isExpert,
    showAdvancedSection: isExpert || isIntermediate,
    showFullDataTables: isExpert,
  }), [dashboardViewMode, isNovice, isIntermediate, isExpert]);

  /**
   * Sidebar adaptation config.
   */
  const sidebarAdaptation = useMemo<SidebarAdaptation>(() => {
    const allFeatureIds = [
      'overview', 'account', 'transactions', 'network', 'faucet',
      'builder', 'contracts', 'assets', 'anchors', 'search',
      'wallet', 'signer', 'multisig', 'charts', 'analytics',
      'portfolio', 'liveActivity', 'compare', 'claimableBalances',
      'alertRules', 'portfolioAnalytics', 'pathExplorer', 'realtime',
      'settings', 'governance', 'devToolbar', 'compliance', 'security',
      'txPatterns', 'capacityPlanning', 'audit', 'collaboration',
      'monitoringDashboards', 'systemHealth', 'logAnalyzer', 'dataExport',
      'designSystem', 'featureFlags', 'dex', 'cacheStats', 'did',
      'paymentChannels', 'txSimulator', 'advancedSim', 'performance',
    ];

    const visibleItems = allFeatureIds
      .map(id => ({ id, adaptation: getAdaptation(id) }))
      .filter(item => item.adaptation.visible);

    return {
      visibleItems,
      showLabels: !isNovice,
      expanded: isExpert,
    };
  }, [level, getFeatureVisibility, dashboardViewMode, tooltipDetail, isNovice, isExpert]);

  /**
   * Get tooltip content appropriate for the user's level.
   */
  const getTooltipContent = (featureId: string, options: {
    simple?: string;
    normal?: string;
    advanced?: string;
  }): string => {
    switch (tooltipDetail) {
      case 'simple': return options.simple || options.normal || options.advanced || '';
      case 'normal': return options.normal || options.advanced || options.simple || '';
      case 'advanced': return options.advanced || options.normal || options.simple || '';
      default: return options.normal || '';
    }
  };

  /**
   * Check if a feature should be rendered with simplified UI.
   */
  const isSimplified = (featureId: string): boolean => {
    return dashboardViewMode === 'simplified' || getAdaptation(featureId).simplified;
  };

  return {
    getAdaptation,
    dashboardAdaptation,
    sidebarAdaptation,
    getTooltipContent,
    isSimplified,
    level,
    isNovice,
    isIntermediate,
    isExpert,
    tooltipDetail,
    dashboardViewMode,
  };
}

/**
 * Utility function to conditionally render based on minimum expertise level.
 * Use this in component render logic for simple visibility checks.
 */
export function isFeatureAccessible(
  currentLevel: ExpertiseTier,
  minimumLevel: ExpertiseTier
): boolean {
  const levelOrder: Record<ExpertiseTier, number> = {
    novice: 0,
    intermediate: 1,
    expert: 2,
  };

  return levelOrder[currentLevel] >= levelOrder[minimumLevel];
}

