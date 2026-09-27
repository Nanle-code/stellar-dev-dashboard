/**
 * routes.ts — the single source of truth for dashboard navigation (#959).
 *
 * One typed registry declares `{ id, path, title, icon, group, loader,
 * minExpertise?, featureFlag? }` for every view. From it we derive:
 *   - the lazy React component for each view (see `routeComponents.ts`)
 *   - sidebar entries + group headers (`getNavGroups`)
 *   - command-palette navigation commands (`getNavRoutes`)
 *   - the document title (`getDocumentTitle`)
 *   - deep links / entity paths with params (`buildPath`, `matchRoute`)
 *
 * This module is intentionally framework-agnostic (no React/React-Router
 * runtime imports) so it can be consumed by pure logic such as
 * `keyboardNavigationAudit.ts` without pulling UI code into non-UI tests.
 */

import type { ComponentType } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpertiseTier = 'novice' | 'intermediate' | 'expert';

export type TabComponent = ComponentType<any>;

export type RouteLoader = () => Promise<{ default: TabComponent }>;

/** Sidebar grouping keys. `SYSTEM` exists for views that are routed but not shown in the sidebar. */
export type RouteGroup =
  | 'analytics'
  | 'network'
  | 'build'
  | 'explore'
  | 'payments'
  | 'tools'
  | 'system';

/** Metadata for entity views that expose a URL path parameter. */
export interface RouteParam {
  /** The `:name` key used in `path`. */
  name: string;
  /**
   * Optional store binding. When set, the decoded URL value is written into the
   * Zustand store on navigation so refreshing or sharing the URL restores the view.
   */
  store?: 'connectedAddress' | 'contractId' | 'selectedTxHash';
}

export interface AppRoute {
  /** Stable identifier. Also the legacy `activeTab` value used across the app. */
  id: string;
  /** URL path template, e.g. `/account/:address?`. Optional params use `?`. */
  path: string;
  /** Human-readable title used for document titles and the command palette. */
  title: string;
  /** Sidebar/command icon (emoji or glyph). */
  icon: string;
  /** Sidebar group. */
  group: RouteGroup;
  /** Lazy loader returning the view component as a default export. */
  loader: RouteLoader;
  /** Minimum expertise level required for progressive disclosure (metadata). */
  minExpertise?: ExpertiseTier;
  /** Feature-flag key gating the route, if any. */
  featureFlag?: string;
  /** Whether the view appears in the primary sidebar / command palette nav list. Defaults to true. */
  nav?: boolean;
  /** Entity path parameter, if this view supports deep links. */
  param?: RouteParam;
  /** Extra paths that resolve to this route (e.g. `/` for overview). */
  aliases?: string[];
}

// ─── Loader helpers ───────────────────────────────────────────────────────────

const defaultLoader = (
  loader: () => Promise<{ default: TabComponent }>,
): RouteLoader => loader;

const namedLoader = (
  loader: () => Promise<Record<string, unknown>>,
  exportName: string,
): RouteLoader => () =>
  loader().then((module) => ({ default: module[exportName] as TabComponent }));

// ─── Registry ─────────────────────────────────────────────────────────────────
// Order matters: it defines sidebar order within each group and match priority.

export const ROUTES: AppRoute[] = [
  // ── ANALYTICS ──────────────────────────────────────────────────────────────
  {
    id: 'overview',
    path: '/overview',
    title: 'Overview',
    icon: '◈',
    group: 'analytics',
    aliases: ['/'],
    loader: defaultLoader(() => import('../components/dashboard/Overview')),
  },
  {
    id: 'account',
    path: '/account/:address?',
    title: 'Account',
    icon: '◉',
    group: 'analytics',
    param: { name: 'address', store: 'connectedAddress' },
    loader: defaultLoader(() => import('../components/dashboard/Account')),
  },
  {
    id: 'claimableBalances',
    path: '/claimableBalances',
    title: 'Claimable',
    icon: '⊛',
    group: 'analytics',
    loader: defaultLoader(() => import('../components/dashboard/ClaimableBalances')),
  },
  {
    id: 'compare',
    path: '/compare',
    title: 'Compare',
    icon: '◫',
    group: 'analytics',
    loader: defaultLoader(() => import('../components/dashboard/AccountComparison')),
  },
  {
    id: 'transactions',
    path: '/transactions/:hash?',
    title: 'Transactions',
    icon: '⇄',
    group: 'analytics',
    param: { name: 'hash', store: 'selectedTxHash' },
    loader: defaultLoader(() => import('../components/dashboard/Transactions')),
  },
  {
    id: 'contracts',
    path: '/contracts/:contractId?',
    title: 'Contracts',
    icon: '◻',
    group: 'analytics',
    param: { name: 'contractId', store: 'contractId' },
    loader: defaultLoader(() => import('../components/dashboard/Contracts')),
  },
  {
    id: 'assets',
    path: '/assets',
    title: 'Assets',
    icon: '💎',
    group: 'analytics',
    loader: namedLoader(() => import('../components/assets'), 'AssetDiscovery'),
  },
  {
    id: 'anchors',
    path: '/anchors',
    title: 'Anchors',
    icon: '⚓',
    group: 'analytics',
    loader: namedLoader(() => import('../components/anchors'), 'AnchorIntegration'),
  },
  {
    id: 'search',
    path: '/search',
    title: 'Search',
    icon: '🔍',
    group: 'analytics',
    loader: defaultLoader(() => import('../components/dashboard/AdvancedSearch')),
  },

  // ── NETWORK ────────────────────────────────────────────────────────────────
  {
    id: 'network',
    path: '/network',
    title: 'Network Info',
    icon: '◎',
    group: 'network',
    loader: defaultLoader(() => import('../components/dashboard/NetworkStats')),
  },
  {
    id: 'validatorPredictor',
    path: '/validatorPredictor',
    title: 'Validator AI',
    icon: '🛡️',
    group: 'network',
    loader: defaultLoader(() => import('../components/dashboard/ValidatorPredictorPanel')),
  },
  {
    id: 'realtime',
    path: '/realtime',
    title: 'Real-Time',
    icon: '◉',
    group: 'network',
    loader: defaultLoader(() => import('../components/dashboard/RealTimeLedger')),
  },
  {
    id: 'liveActivity',
    path: '/liveActivity',
    title: 'Live Activity',
    icon: '⚡',
    group: 'network',
    loader: defaultLoader(() => import('../components/dashboard/LiveActivityFeed')),
  },
  {
    id: 'cacheStats',
    path: '/cacheStats',
    title: 'Cache Stats',
    icon: '⊞',
    group: 'network',
    loader: defaultLoader(() => import('../components/dashboard/CacheStats')),
  },
  {
    id: 'performance',
    path: '/performance',
    title: 'Performance',
    icon: 'P',
    group: 'network',
    loader: defaultLoader(() => import('../components/dashboard/PerformanceMonitor')),
  },
  {
    id: 'feeForecast',
    path: '/feeForecast',
    title: 'Fee Forecast',
    icon: '📈',
    group: 'network',
    nav: false,
    loader: defaultLoader(() => import('../components/dashboard/NetworkFeeForecast')),
  },

  // ── BUILD ──────────────────────────────────────────────────────────────────
  {
    id: 'builder',
    path: '/builder',
    title: 'Builder',
    icon: '⚒',
    group: 'build',
    loader: defaultLoader(() => import('../components/dashboard/Builder')),
  },
  {
    id: 'txSimulator',
    path: '/txSimulator',
    title: 'Simulator',
    icon: '▷',
    group: 'build',
    loader: defaultLoader(() => import('../components/dashboard/TransactionSimulator')),
  },
  {
    id: 'advancedSim',
    path: '/advancedSim',
    title: 'Advanced Sim',
    icon: '⚡',
    group: 'build',
    loader: defaultLoader(() => import('../components/dashboard/TransactionSimulatorAdvanced')),
  },
  {
    id: 'sorobanDebug',
    path: '/sorobanDebug',
    title: 'Soroban Debugging',
    icon: '🐞',
    group: 'build',
    loader: namedLoader(() => import('../components/dashboard/SorobanDebugTutorial'), 'SorobanDebugTutorial'),
  },
  {
    id: 'learningHub',
    path: '/learningHub',
    title: 'Learning Hub',
    icon: '🎓',
    group: 'build',
    loader: namedLoader(() => import('../components/dashboard/LearningHub'), 'LearningHub'),
  },
  {
    id: 'faucet',
    path: '/faucet',
    title: 'Faucet',
    icon: '⬡',
    group: 'build',
    loader: defaultLoader(() => import('../components/dashboard/Faucet')),
  },

  // ── EXPLORE ────────────────────────────────────────────────────────────────
  {
    id: 'dex',
    path: '/dex',
    title: 'DEX',
    icon: '⇌',
    group: 'explore',
    loader: defaultLoader(() => import('../components/dashboard/DEXExplorer')),
  },
  {
    id: 'liquidityPrediction',
    path: '/liquidityPrediction',
    title: 'Liquidity AI',
    icon: '🧠',
    group: 'explore',
    loader: defaultLoader(() => import('../components/dashboard/LiquidityPredictionDashboard')),
  },
  {
    id: 'pathExplorer',
    path: '/pathExplorer',
    title: 'Path Explorer',
    icon: '⇢',
    group: 'explore',
    loader: defaultLoader(() => import('../components/dashboard/PathExplorer')),
  },
  {
    id: 'explorers',
    path: '/explorers',
    title: 'Explorer Links',
    icon: '⊞',
    group: 'explore',
    loader: defaultLoader(() => import('../components/dashboard/ExplorerEmbed')),
  },

  // ── PAYMENTS ───────────────────────────────────────────────────────────────
  {
    id: 'paymentChannels',
    path: '/paymentChannels',
    title: 'Pay Channels',
    icon: '⇶',
    group: 'payments',
    loader: defaultLoader(() => import('../components/dashboard/PaymentChannels')),
  },

  // ── TOOLS ──────────────────────────────────────────────────────────────────
  {
    id: 'wallet',
    path: '/wallet',
    title: 'Wallet',
    icon: '⊡',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/WalletConnect')),
  },
  {
    id: 'signer',
    path: '/signer',
    title: 'Signer',
    icon: '✎',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/TransactionSigner')),
  },
  {
    id: 'multisig',
    path: '/multisig',
    title: 'Multisig',
    icon: '⊕',
    group: 'tools',
    loader: namedLoader(() => import('../components/multisig'), 'MultisigManager'),
  },
  {
    id: 'did',
    path: '/did',
    title: 'DID',
    icon: '🆔',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/DIDManagement')),
  },
  {
    id: 'alertRules',
    path: '/alertRules',
    title: 'Alerts',
    icon: '🔔',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/AlertRules')),
  },
  {
    id: 'portfolio',
    path: '/portfolio',
    title: 'Portfolio',
    icon: '◐',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/PortfolioValue')),
  },
  {
    id: 'portfolioAnalytics',
    path: '/portfolioAnalytics',
    title: 'Portfolio Analytics',
    icon: '📊',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/PortfolioAnalytics')),
  },
  {
    id: 'sandboxAnalytics',
    path: '/sandboxAnalytics',
    title: 'Sandbox Demos',
    icon: '🧪',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/SandboxAnalyticsDemo')),
  },
  {
    id: 'autonomousTrading',
    path: '/autonomousTrading',
    title: 'Trading Agent',
    icon: '🤖',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/AutonomousTradingAgent')),
  },
  {
    id: 'charts',
    path: '/charts',
    title: 'Charts',
    icon: '▤',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/ChartsTab')),
  },
  {
    id: 'dataStorytelling',
    path: '/dataStorytelling',
    title: 'Data Stories',
    icon: '📖',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/DataStorytelling')),
  },
  {
    id: 'analytics',
    path: '/analytics',
    title: 'Analytics',
    icon: '◍',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/Analytics')),
  },
  {
    id: 'designSystem',
    path: '/designSystem',
    title: 'Design System',
    icon: '◈',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/DesignSystem')),
  },
  {
    id: 'featureFlags',
    path: '/featureFlags',
    title: 'Flags',
    icon: '🚩',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/FeatureFlags')),
  },
  {
    id: 'codeReview',
    path: '/codeReview',
    title: 'Code Review',
    icon: '🔍',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/CodeReviewAssistant')),
  },
  {
    id: 'txPatterns',
    path: '/txPatterns',
    title: 'AI Patterns',
    icon: '🧠',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/TransactionPatternAnalysis')),
  },
  {
    id: 'anomalyViz',
    path: '/anomalyViz',
    title: 'Anomaly Viz',
    icon: '◉',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/AnomalyVisualization')),
  },
  {
    id: 'systemHealth',
    path: '/systemHealth',
    title: 'Health',
    icon: '⚕',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/SystemHealth')),
  },
  {
    id: 'monitoringDashboards',
    path: '/monitoringDashboards',
    title: 'Monitoring',
    icon: '📊',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/MonitoringDashboards')),
  },
  {
    id: 'throughputForecast',
    path: '/throughputForecast',
    title: 'Forecast',
    icon: '📈',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/ThroughputForecast')),
  },
  {
    id: 'dataExport',
    path: '/dataExport',
    title: 'Export',
    icon: '⬇',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/DataExport')),
  },
  {
    id: 'collaboration',
    path: '/collaboration',
    title: 'Collaboration',
    icon: '◌',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/CollaborationTab')),
  },
  {
    id: 'governance',
    path: '/governance',
    title: 'Governance',
    icon: '🗳',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/Governance')),
  },
  {
    id: 'settings',
    path: '/settings',
    title: 'Settings',
    icon: '⚙',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/Settings')),
  },
  {
    id: 'audit',
    path: '/audit',
    title: 'Audit',
    icon: '⊟',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/AuditLog')),
  },
  {
    id: 'personalization',
    path: '/personalization',
    title: 'AI Personalization',
    icon: '🧠',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/PersonalizationPanel')),
  },
  {
    id: 'security',
    path: '/security',
    title: 'Security',
    icon: '🛡️',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/SecurityDashboard')),
  },
  {
    id: 'dependencyManagement',
    path: '/dependencyManagement',
    title: 'Dependencies',
    icon: '📦',
    group: 'tools',
    loader: defaultLoader(() => import('../components/dashboard/DependencyManagement')),
  },

  // ── ROUTED BUT NOT IN THE SIDEBAR ─────────────────────────────────────────
  {
    id: 'txBuilder',
    path: '/txBuilder',
    title: 'Transaction Builder',
    icon: '⚒',
    group: 'build',
    nav: false,
    loader: defaultLoader(() => import('../components/dashboard/TransactionBuilder')),
  },
  {
    id: 'contractInteraction',
    path: '/contractInteraction',
    title: 'Contract Interaction',
    icon: '◻',
    group: 'build',
    nav: false,
    loader: defaultLoader(() => import('../components/dashboard/ContractInteraction')),
  },
  {
    id: 'contractABI',
    path: '/contractABI',
    title: 'Contract ABI',
    icon: '◻',
    group: 'build',
    nav: false,
    loader: defaultLoader(() => import('../components/dashboard/ContractABI')),
  },
  {
    id: 'contractRecommendations',
    path: '/contractRecommendations',
    title: 'Contract AI',
    icon: '💡',
    group: 'build',
    nav: false,
    loader: defaultLoader(() => import('../components/dashboard/ContractRecommendations')),
  },
  {
    id: 'txAnalytics',
    path: '/txAnalytics',
    title: 'Transaction Analytics',
    icon: '📊',
    group: 'analytics',
    nav: false,
    loader: defaultLoader(() => import('../components/dashboard/TransactionAnalyticsDashboard')),
  },
  {
    id: 'compliance',
    path: '/compliance',
    title: 'Compliance',
    icon: '📋',
    group: 'system',
    nav: false,
    minExpertise: 'expert',
    loader: defaultLoader(() => import('../components/dashboard/ComplianceDashboard')),
  },
  {
    id: 'devToolbar',
    path: '/devToolbar',
    title: 'Dev Toolbar',
    icon: '🛠',
    group: 'system',
    nav: false,
    minExpertise: 'expert',
    featureFlag: 'dev-toolbar',
    loader: defaultLoader(() => import('../components/dashboard/DevToolbar')),
  },
];

// ─── Derived lookups ──────────────────────────────────────────────────────────

export const ROUTES_BY_ID: Record<string, AppRoute> = Object.freeze(
  ROUTES.reduce<Record<string, AppRoute>>((acc, route) => {
    acc[route.id] = route;
    return acc;
  }, {}),
);

export const GROUP_LABELS: Record<RouteGroup, string> = {
  analytics: 'ANALYTICS',
  network: 'NETWORK',
  build: 'BUILD',
  explore: 'EXPLORE',
  payments: 'PAYMENTS',
  tools: 'TOOLS',
  system: 'SYSTEM',
};

export function getRouteById(id: string): AppRoute | undefined {
  return ROUTES_BY_ID[id];
}

/** Routes shown in the sidebar / command palette, in registry order. */
export function getNavRoutes(): AppRoute[] {
  return ROUTES.filter((route) => route.nav !== false);
}

/**
 * Curated, smaller subset surfaced by the mobile drawer. Membership is
 * hand-picked for small screens, but titles/icons/paths are still resolved
 * from the registry so the mobile list cannot drift from the canonical
 * definitions (#959).
 */
const MOBILE_NAV_IDS = [
  'overview',
  'account',
  'compare',
  'transactions',
  'contracts',
  'assets',
  'network',
  'validatorPredictor',
  'realtime',
  'builder',
  'faucet',
  'wallet',
  'signer',
  'multisig',
  'portfolio',
  'autonomousTrading',
  'charts',
  'dataStorytelling',
  'designSystem',
  'featureFlags',
  'collaboration',
  'txPatterns',
  'contractRecommendations',
  'personalization',
  'security',
  'dependencyManagement',
] as const;

export function getMobileNavRoutes(): AppRoute[] {
  return MOBILE_NAV_IDS.map((id) => ROUTES_BY_ID[id]).filter(
    (route): route is AppRoute => Boolean(route),
  );
}

export interface NavGroup {
  group: RouteGroup;
  label: string;
  routes: AppRoute[];
}

/** Sidebar groups in first-appearance order, each with its nav routes. */
export function getNavGroups(): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const route of getNavRoutes()) {
    let group = groups.find((g) => g.group === route.group);
    if (!group) {
      group = { group: route.group, label: GROUP_LABELS[route.group], routes: [] };
      groups.push(group);
    }
    group.routes.push(route);
  }
  return groups;
}

// ─── Progressive disclosure ───────────────────────────────────────────────────

const LEVEL_RANK: Record<ExpertiseTier, number> = {
  novice: 0,
  intermediate: 1,
  expert: 2,
};

export interface RouteVisibilityOptions {
  expertiseLevel?: ExpertiseTier;
  /** Resolver for a feature flag. Flags without a resolver are treated as enabled. */
  isFeatureEnabled?: (flag: string) => boolean;
}

/**
 * Whether a route should be surfaced for the given user. Routes without
 * `minExpertise` / `featureFlag` always pass, so the default sidebar is
 * unchanged for existing users.
 */
export function isRouteVisible(
  route: AppRoute,
  options: RouteVisibilityOptions = {},
): boolean {
  if (route.minExpertise && options.expertiseLevel) {
    if (LEVEL_RANK[options.expertiseLevel] < LEVEL_RANK[route.minExpertise]) {
      return false;
    }
  }
  if (route.featureFlag && options.isFeatureEnabled) {
    return options.isFeatureEnabled(route.featureFlag);
  }
  return true;
}

// ─── Path building ────────────────────────────────────────────────────────────

/**
 * Build a concrete URL for a route id, substituting params.
 *
 *   buildPath('overview')                        // → '/overview'
 *   buildPath('account', { address: 'G...' })    // → '/account/G...'
 *   buildPath('account')                         // → '/account' (optional param omitted)
 */
export function buildPath(
  id: string,
  params: Record<string, string | number> = {},
): string {
  const route = ROUTES_BY_ID[id];
  if (!route) return '/';
  let path = route.path;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    path = path.replace(
      new RegExp(`:${key}\\??`),
      encodeURIComponent(String(value)),
    );
  }
  // Drop any optional segments the caller did not supply.
  path = path.replace(/\/:[^/]+\?/g, '');
  return path || '/';
}

// ─── Matching ────────────────────────────────────────────────────────────────

export interface RouteMatch {
  route: AppRoute;
  params: Record<string, string>;
}

interface CompiledPattern {
  regex: RegExp;
  keys: string[];
}

const patternCache = new Map<string, CompiledPattern>();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePattern(pattern: string): CompiledPattern {
  const cached = patternCache.get(pattern);
  if (cached) return cached;

  const segments = pattern.split('/').filter(Boolean);
  const keys: string[] = [];
  let source = '^';
  for (const segment of segments) {
    if (segment.startsWith(':')) {
      const optional = segment.endsWith('?');
      const name = segment.slice(1).replace(/\?$/, '');
      keys.push(name);
      source += optional ? '(?:/([^/]+))?' : '/([^/]+)';
    } else {
      source += '/' + escapeRegExp(segment);
    }
  }
  source += '/?$';

  const compiled = { regex: new RegExp(source), keys };
  patternCache.set(pattern, compiled);
  return compiled;
}

function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    // A malformed percent-encoding must not throw while resolving a route;
    // fall back to the raw segment so callers still get a usable value.
    return raw;
  }
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const { regex, keys } = compilePattern(pattern);
  const match = regex.exec(pathname);
  if (!match) return null;

  const params: Record<string, string> = {};
  keys.forEach((key, index) => {
    const raw = match[index + 1];
    if (raw !== undefined) params[key] = decodeParam(raw);
  });
  return params;
}

/**
 * Resolve a URL path to a route (and any path params), or `null` when the path
 * is unknown — callers should render the 404 view in that case.
 */
export function matchRoute(pathname: string): RouteMatch | null {
  const clean = pathname.split('?')[0] || '/';
  for (const route of ROUTES) {
    const patterns = [route.path, ...(route.aliases ?? [])];
    for (const pattern of patterns) {
      const params = matchPath(pattern, clean);
      if (params) return { route, params };
    }
  }
  return null;
}

// ─── Titles ──────────────────────────────────────────────────────────────────

export const APP_TITLE_SUFFIX = 'Stellar Dev Dashboard';

/** Document title for a matched route (falls back to a 404 title). */
export function getDocumentTitle(route: AppRoute | null | undefined): string {
  return route ? `${route.title} · ${APP_TITLE_SUFFIX}` : `Page not found · ${APP_TITLE_SUFFIX}`;
}
