/**
 * Offline capability matrix (#892)
 *
 * Declares, for every view in the route registry, how it behaves without a
 * network connection. This module is the source of truth for the matrix in
 * `docs/guides/offline-support.md`; a unit test fails if the two drift or if a
 * route is added without an entry here.
 *
 * Levels
 * ------
 *  offline      Works fully offline once its code has been loaded (pure client work).
 *  degraded     Shows cached data read-only; network writes are blocked or queued.
 *  online-only  Needs a live connection (streaming, network-only endpoints, writes).
 */

import { ROUTES, GROUP_LABELS, type RouteGroup } from '../routes/routes';

export type OfflineLevel = 'offline' | 'degraded' | 'online-only';

export const OFFLINE_LEVELS: readonly OfflineLevel[] = ['offline', 'degraded', 'online-only'];

export const OFFLINE_LEVEL_LABELS: Record<OfflineLevel, string> = {
  offline: 'Works offline',
  degraded: 'Degraded (cached, read-only)',
  'online-only': 'Online only',
};

export interface OfflineCapability {
  level: OfflineLevel;
  /** What the user can and cannot do offline. Rendered into the docs matrix. */
  notes: string;
}

export const OFFLINE_CAPABILITIES: Readonly<Record<string, OfflineCapability>> = Object.freeze({
  // ── Analytics ──────────────────────────────────────────────────────────────
  overview: { level: 'degraded', notes: 'Last cached account and network summary.' },
  account: {
    level: 'degraded',
    notes: 'Cached balances and signers with a stale-data badge. Refresh is disabled.',
  },
  claimableBalances: { level: 'degraded', notes: 'Cached list only. Claiming needs a connection.' },
  compare: { level: 'degraded', notes: 'Only accounts already cached can be compared.' },
  transactions: {
    level: 'degraded',
    notes: 'Previously loaded pages only. Pagination beyond the cache fails.',
  },
  contracts: { level: 'degraded', notes: 'Cached contract metadata. Invocation is blocked.' },
  assets: { level: 'degraded', notes: 'Previously loaded asset lists only.' },
  anchors: { level: 'online-only', notes: 'SEP endpoints on anchor domains are never cached.' },
  search: { level: 'degraded', notes: 'Searches cached results and saved queries only.' },

  // ── Network ────────────────────────────────────────────────────────────────
  network: {
    level: 'degraded',
    notes: 'Cached ledger stats. Fee stats are always live and show as unavailable.',
  },
  validatorPredictor: { level: 'degraded', notes: 'Last computed predictions only.' },
  realtime: { level: 'online-only', notes: 'Horizon streaming; pauses until reconnected.' },
  liveActivity: { level: 'online-only', notes: 'Live stream; pauses until reconnected.' },
  cacheStats: { level: 'offline', notes: 'Reads local cache metrics.' },
  performance: { level: 'offline', notes: 'Reads in-browser performance metrics.' },
  feeForecast: { level: 'online-only', notes: '`/fee_stats` is never cached.' },

  // ── Build ──────────────────────────────────────────────────────────────────
  builder: {
    level: 'degraded',
    notes: 'Build and export XDR offline. Loading sequence numbers and submitting are blocked.',
  },
  txSimulator: {
    level: 'online-only',
    notes: 'Simulation calls Soroban RPC (POST, never cached).',
  },
  advancedSim: {
    level: 'online-only',
    notes: 'Simulation calls Soroban RPC (POST, never cached).',
  },
  sorobanDebug: { level: 'offline', notes: 'Static tutorial content.' },
  learningHub: { level: 'offline', notes: 'Static course content.' },
  faucet: { level: 'online-only', notes: 'Friendbot is network-only; funding is a write.' },

  // ── Explore ────────────────────────────────────────────────────────────────
  dex: { level: 'degraded', notes: 'Cached order books and trades, possibly stale.' },
  liquidityPrediction: { level: 'online-only', notes: 'Needs the ML prediction service.' },
  pathExplorer: { level: 'degraded', notes: 'Only path queries already cached resolve.' },
  explorers: { level: 'online-only', notes: 'Embeds third-party explorer sites.' },

  // ── Payments ───────────────────────────────────────────────────────────────
  paymentChannels: { level: 'online-only', notes: 'Channel state changes are network writes.' },

  // ── Tools ──────────────────────────────────────────────────────────────────
  wallet: {
    level: 'online-only',
    notes: 'Wallet extensions and account lookup need a connection.',
  },
  signer: {
    level: 'degraded',
    notes: 'Sign XDR locally. Submission is blocked until reconnected.',
  },
  multisig: {
    level: 'degraded',
    notes: 'Collect signatures on a loaded transaction. Submission is blocked.',
  },
  did: { level: 'online-only', notes: 'DID resolution needs the network.' },
  alertRules: {
    level: 'degraded',
    notes: 'Edit rules locally. Rules are not evaluated until reconnected.',
  },
  portfolio: { level: 'online-only', notes: 'Prices come from a network-only price feed.' },
  portfolioAnalytics: { level: 'degraded', notes: 'Analytics over cached history only.' },
  sandboxAnalytics: { level: 'offline', notes: 'Uses bundled fixture datasets.' },
  autonomousTrading: {
    level: 'online-only',
    notes: 'Trading needs live market data and submission.',
  },
  charts: { level: 'degraded', notes: 'Charts render from cached series only.' },
  dataStorytelling: { level: 'degraded', notes: 'Stories render from cached data only.' },
  analytics: { level: 'degraded', notes: 'Cached metrics only.' },
  designSystem: { level: 'offline', notes: 'Static component catalogue.' },
  featureFlags: { level: 'offline', notes: 'Flags are stored locally.' },
  codeReview: { level: 'offline', notes: 'Analysis runs in the browser.' },
  txPatterns: { level: 'degraded', notes: 'Analyses cached transactions only.' },
  anomalyViz: { level: 'degraded', notes: 'Analyses cached transactions only.' },
  systemHealth: { level: 'online-only', notes: 'Health probes need the network.' },
  monitoringDashboards: { level: 'degraded', notes: 'Last collected metrics only.' },
  throughputForecast: { level: 'online-only', notes: 'Needs live ledger throughput.' },
  dataExport: { level: 'degraded', notes: 'Exports cached data only.' },
  collaboration: { level: 'online-only', notes: 'Real-time sessions need a connection.' },
  governance: { level: 'online-only', notes: 'Proposals and votes are network reads and writes.' },
  settings: {
    level: 'offline',
    notes: 'Preferences save locally. Switching network loads no new data until reconnected.',
  },
  audit: { level: 'offline', notes: 'Audit log is stored locally.' },
  personalization: { level: 'offline', notes: 'Preferences save locally.' },
  security: { level: 'degraded', notes: 'Local checks run; network-backed checks are skipped.' },
  dependencyManagement: { level: 'offline', notes: 'Uses bundled dependency data.' },

  // ── Routed but not in the sidebar ──────────────────────────────────────────
  txBuilder: {
    level: 'degraded',
    notes: 'Build and export XDR offline. Submitting is blocked.',
  },
  contractInteraction: { level: 'online-only', notes: 'Invocation is a network write.' },
  contractABI: {
    level: 'degraded',
    notes: 'Parsing an uploaded WASM works offline; fetching by contract ID does not.',
  },
  contractRecommendations: { level: 'degraded', notes: 'Recommendations from cached data only.' },
  txAnalytics: { level: 'degraded', notes: 'Cached transactions only.' },
  compliance: { level: 'offline', notes: 'Reads the local audit log.' },
  devToolbar: { level: 'offline', notes: 'Local developer tooling.' },
});

// ─── Errors ───────────────────────────────────────────────────────────────────

export class UnknownFeatureError extends Error {
  readonly featureId: string;
  constructor(featureId: string) {
    super(`No offline capability is declared for "${featureId}".`);
    this.name = 'UnknownFeatureError';
    this.featureId = featureId;
  }
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function getOfflineCapability(featureId: unknown): OfflineCapability {
  if (typeof featureId !== 'string' || featureId.trim() === '') {
    throw new TypeError('Feature id must be a non-empty string.');
  }
  const capability = Object.prototype.hasOwnProperty.call(OFFLINE_CAPABILITIES, featureId)
    ? OFFLINE_CAPABILITIES[featureId]
    : undefined;
  if (!capability) throw new UnknownFeatureError(featureId);
  return capability;
}

// ─── Runtime availability ─────────────────────────────────────────────────────

export type Availability = 'available' | 'degraded' | 'unavailable';

export interface OfflineEnvironment {
  /** Current connectivity. */
  online: boolean;
  /** `'serviceWorker' in navigator`. Without it nothing survives a reload offline. */
  serviceWorkerSupported?: boolean;
  /** The view's code chunk is cached by the service worker or already in memory. */
  routeCodeCached?: boolean;
  /** The data the view needs has at least one cached entry. */
  hasCachedData?: boolean;
}

export interface AvailabilityResult {
  status: Availability;
  level: OfflineLevel;
  reason: string;
}

/**
 * Decide whether a view can be used right now.
 *
 * Unknown feature ids throw `UnknownFeatureError`; malformed environments throw
 * `TypeError`. Callers rendering UI should use `describeAvailability`, which
 * never throws.
 */
export function resolveAvailability(
  featureId: unknown,
  env: OfflineEnvironment
): AvailabilityResult {
  const { level } = getOfflineCapability(featureId);
  if (!env || typeof env.online !== 'boolean') {
    throw new TypeError('Environment must include a boolean `online` flag.');
  }

  if (env.online) {
    return { status: 'available', level, reason: 'Online.' };
  }

  if (!env.routeCodeCached) {
    return {
      status: 'unavailable',
      level,
      reason:
        env.serviceWorkerSupported === false
          ? 'This browser has no service worker support, so views cannot load offline.'
          : 'This view was not opened while online, so its code is not cached.',
    };
  }

  switch (level) {
    case 'offline':
      return { status: 'available', level, reason: 'Works offline.' };
    case 'degraded':
      return env.hasCachedData
        ? {
            status: 'degraded',
            level,
            reason: 'Showing cached data. Changes are blocked or queued.',
          }
        : { status: 'unavailable', level, reason: 'No cached data for this view yet.' };
    case 'online-only':
    default:
      return { status: 'unavailable', level, reason: 'This view needs a network connection.' };
  }
}

/** Never-throwing variant for UI. Unknown views are reported as unavailable offline. */
export function describeAvailability(
  featureId: unknown,
  env: OfflineEnvironment
): AvailabilityResult {
  try {
    return resolveAvailability(featureId, env);
  } catch {
    return {
      status: env?.online ? 'available' : 'unavailable',
      level: 'online-only',
      reason: env?.online ? 'Online.' : 'Offline support for this view is unknown.',
    };
  }
}

// ─── Docs rendering ───────────────────────────────────────────────────────────

export const MATRIX_START_MARKER = '<!-- offline-matrix:start -->';
export const MATRIX_END_MARKER = '<!-- offline-matrix:end -->';

const escapeCell = (text: string) => text.replace(/\|/g, '\\|');

/**
 * Render the capability matrix as Markdown tables grouped like the sidebar.
 * The docs page embeds this output between the matrix markers.
 */
export function renderOfflineMatrixMarkdown(): string {
  const groups = new Map<RouteGroup, typeof ROUTES>();
  for (const route of ROUTES) {
    const list = groups.get(route.group) ?? [];
    list.push(route);
    groups.set(route.group, list);
  }

  const sections: string[] = [];
  for (const [group, routes] of groups) {
    const rows = routes.map((route) => {
      const { level, notes } = getOfflineCapability(route.id);
      const name = route.nav === false ? `${route.title} (not in sidebar)` : route.title;
      return `| ${escapeCell(name)} | \`${route.path}\` | ${OFFLINE_LEVEL_LABELS[level]} | ${escapeCell(notes)} |`;
    });
    sections.push(
      [
        `### ${GROUP_LABELS[group]}`,
        '',
        '| View | Path | Offline | Notes |',
        '| --- | --- | --- | --- |',
        ...rows,
      ].join('\n')
    );
  }
  return sections.join('\n\n');
}

/**
 * Normalise Markdown so formatter padding (e.g. Prettier aligning table
 * columns) does not register as drift.
 */
export function normalizeMatrixMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/\s*\|\s*/g, '|')
        .replace(/-{3,}/g, '---')
        .replace(/\s+/g, ' ')
    )
    .filter((line) => line !== '')
    .join('\n');
}

/** Extract the matrix block embedded in a docs page, or `null` if the markers are missing. */
export function extractMatrixFromDoc(doc: string): string | null {
  const start = doc.indexOf(MATRIX_START_MARKER);
  const end = doc.indexOf(MATRIX_END_MARKER);
  if (start === -1 || end === -1 || end < start) return null;
  return doc.slice(start + MATRIX_START_MARKER.length, end).trim();
}
