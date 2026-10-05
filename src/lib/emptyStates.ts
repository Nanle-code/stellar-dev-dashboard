/**
 * emptyStates.ts — contextual empty states with next-best actions (#876).
 *
 * A blank panel is a dead end. Each preset here describes *why* a panel is
 * empty and which dashboard tools are the most useful next step. Actions point
 * at route ids from the route registry (`routes.ts`) so they can never drift
 * from real views: unknown ids, routes hidden by expertise / feature flags, and
 * tools that do not work on the active network are filtered out before render.
 *
 * Framework-agnostic on purpose (no React imports) so the resolution logic can
 * be unit-tested without rendering.
 */

import {
  getRouteById,
  isRouteVisible,
  type RouteVisibilityOptions,
} from '../routes/routes';

export type EmptyStateNetwork = 'mainnet' | 'testnet' | 'futurenet' | 'local' | 'custom';

export interface EmptyStateAction {
  /** Button label, e.g. "Open Faucet". */
  label: string;
  /** Route id from the registry to navigate to. Mutually exclusive with `onSelect`. */
  routeId?: string;
  /** In-page handler (e.g. switching a sub-tab). Takes precedence over `routeId`. */
  onSelect?: () => void;
  /** Short explanation rendered under the label. */
  hint?: string;
  /** Networks this action works on. Omitted means every network. */
  networks?: EmptyStateNetwork[];
}

export interface EmptyStatePreset {
  title: string;
  description: string;
  actions: EmptyStateAction[];
}

export interface ResolveActionsOptions extends RouteVisibilityOptions {
  /** Active network; actions restricted to other networks are dropped. */
  network?: string;
  /** Route id of the current view; actions pointing at it are dropped. */
  currentRouteId?: string;
  /** Maximum number of actions to surface. Defaults to 3. */
  maxActions?: number;
}

export const DEFAULT_MAX_ACTIONS = 3;

const TESTNET_ONLY: EmptyStateNetwork[] = ['testnet', 'futurenet', 'local'];

export const EMPTY_STATE_PRESETS = {
  generic: {
    title: 'Nothing to show yet',
    description: 'There is no data for this view right now.',
    actions: [
      { label: 'Go to Overview', routeId: 'overview', hint: 'See network and account status' },
      { label: 'Search the network', routeId: 'search', hint: 'Look up an account, transaction or asset' },
    ],
  },
  walletRequired: {
    title: 'No account connected',
    description: 'Connect an account to see balances, positions and history for it.',
    actions: [
      { label: 'Connect a wallet', routeId: 'wallet', hint: 'Freighter, Albedo, xBull and more' },
      { label: 'Fund a test account', routeId: 'faucet', hint: 'Create and fund with Friendbot', networks: TESTNET_ONLY },
    ],
  },
  noPools: {
    title: 'No liquidity pools found',
    description: 'No pools exist for this asset pair on the current network. Try a different pair or explore the order book instead.',
    actions: [
      { label: 'Browse the DEX', routeId: 'dex', hint: 'Order books and trades for any pair' },
      { label: 'Find a payment path', routeId: 'pathExplorer', hint: 'Route between assets without a pool' },
      { label: 'Discover assets', routeId: 'assets', hint: 'Find asset codes and issuers' },
    ],
  },
  noPoolSelected: {
    title: 'No pool selected',
    description: 'Choose a pool to inspect its reserves, fees and your LP share.',
    actions: [],
  },
  noPoolTrades: {
    title: 'No recent trades',
    description: 'This pool has no trades in the recent history window.',
    actions: [
      { label: 'Open the DEX', routeId: 'dex', hint: 'Compare with order book activity' },
      { label: 'Watch live activity', routeId: 'liveActivity', hint: 'Stream operations as they close' },
    ],
  },
  noLpPositions: {
    title: 'No LP shares for this pool',
    description: 'The connected account has not deposited into this pool.',
    actions: [
      { label: 'Build a deposit', routeId: 'builder', hint: 'Compose a liquidity_pool_deposit operation' },
      { label: 'Review balances', routeId: 'account', hint: 'Check trustlines and available funds' },
    ],
  },
  noLpHistory: {
    title: 'No deposit or withdrawal history',
    description: 'There are no recent liquidity operations for this pool on the connected account.',
    actions: [
      { label: 'View transactions', routeId: 'transactions', hint: 'Full operation history for the account' },
    ],
  },
  noRelationships: {
    title: 'No relationships found',
    description: 'This account has not interacted with other accounts in the analysed window.',
    actions: [
      { label: 'View transactions', routeId: 'transactions', hint: 'Check whether the account has any activity' },
      { label: 'Compare accounts', routeId: 'compare', hint: 'Analyse two accounts side by side' },
    ],
  },
  noAddresses: {
    title: 'No addresses found',
    description: 'No counterparties were ranked for this account yet.',
    actions: [
      { label: 'Search the network', routeId: 'search', hint: 'Look up a counterparty directly' },
    ],
  },
  noClusters: {
    title: 'No clusters detected',
    description: 'Clusters appear once an account has several related counterparties.',
    actions: [
      { label: 'Detect patterns', routeId: 'txPatterns', hint: 'AI transaction pattern analysis' },
    ],
  },
} satisfies Record<string, EmptyStatePreset>;

export type EmptyStateContext = keyof typeof EMPTY_STATE_PRESETS;

export function isEmptyStateContext(value: unknown): value is EmptyStateContext {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EMPTY_STATE_PRESETS, value);
}

/** Look up a preset, falling back to `generic` for unknown or malformed keys. */
export function getEmptyStatePreset(context: unknown): EmptyStatePreset {
  return isEmptyStateContext(context) ? EMPTY_STATE_PRESETS[context] : EMPTY_STATE_PRESETS.generic;
}

function isActionAvailable(action: EmptyStateAction, options: ResolveActionsOptions): boolean {
  if (!action || typeof action.label !== 'string' || action.label.trim() === '') return false;

  if (action.networks && action.networks.length > 0 && options.network) {
    if (!action.networks.includes(options.network as EmptyStateNetwork)) return false;
  }

  if (typeof action.onSelect === 'function') return true;

  if (typeof action.routeId !== 'string' || action.routeId === '') return false;
  if (action.routeId === options.currentRouteId) return false;

  const route = getRouteById(action.routeId);
  if (!route) return false;
  return isRouteVisible(route, options);
}

/**
 * Filter a list of candidate actions down to the ones that can actually be
 * taken right now: valid, visible, supported on the network, not the current
 * view, de-duplicated by target, and capped at `maxActions`.
 */
export function resolveEmptyStateActions(
  actions: readonly EmptyStateAction[] | null | undefined,
  options: ResolveActionsOptions = {},
): EmptyStateAction[] {
  if (!Array.isArray(actions)) return [];

  const rawMax = options.maxActions ?? DEFAULT_MAX_ACTIONS;
  const max = Number.isFinite(rawMax) ? Math.max(0, Math.floor(rawMax)) : DEFAULT_MAX_ACTIONS;

  const seen = new Set<string>();
  const resolved: EmptyStateAction[] = [];
  for (const action of actions) {
    if (resolved.length >= max) break;
    if (!isActionAvailable(action, options)) continue;
    const key = action.onSelect ? `handler:${action.label}` : `route:${action.routeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push(action);
  }
  return resolved;
}
