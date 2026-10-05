/**
 * commandPalette.ts — pure command model for the Ctrl/Cmd+K palette (#877).
 *
 * The palette lets keyboard users jump to accounts, contracts, and settings
 * from anywhere in the dashboard. Everything here is framework-agnostic so it
 * can be unit tested without rendering: commands describe a *target*, and the
 * palette component decides how to execute it.
 */

import { StrKey } from '@stellar/stellar-sdk';
import { buildPath, getNavRoutes } from '../routes/routes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaletteTarget =
  | { type: 'route'; path: string }
  | { type: 'account'; address: string }
  | { type: 'contract'; contractId: string }
  | { type: 'template'; templateId: string }
  | { type: 'preferences' }
  | { type: 'shortcuts' };

export interface PaletteCommand {
  id: string;
  label: string;
  category: string;
  /** Extra search terms that are matched but not displayed. */
  keywords?: string[];
  target: PaletteTarget;
}

export type PaletteQuery =
  | { kind: 'empty' }
  | { kind: 'text'; value: string }
  | { kind: 'account'; value: string }
  | { kind: 'contract'; value: string }
  | { kind: 'invalid'; value: string; reason: string };

export interface RecentAccountLike {
  publicKey?: unknown;
}

export interface TemplateLike {
  id?: unknown;
  label?: unknown;
  name?: unknown;
}

export interface BuildCommandsInput {
  recentAccounts?: RecentAccountLike[];
  templates?: TemplateLike[];
}

/** Queries longer than this are rejected rather than filtered. */
export const MAX_QUERY_LENGTH = 256;

/** Length of a G… account address or C… contract id. */
const STRKEY_LENGTH = 56;

// Base32 alphabet used by StrKey, with a G/C version prefix. Anything that
// matches this shape is clearly an attempt at an address, so we validate it
// instead of treating it as free-text search.
const STRKEY_SHAPE = /^[GC][A-Z2-7]{20,}$/;

// ─── Query classification ────────────────────────────────────────────────────

/**
 * Work out what the user typed: free text to filter by, a valid account or
 * contract to jump to, or something address-shaped that is malformed.
 */
export function classifyPaletteQuery(raw: unknown): PaletteQuery {
  if (typeof raw !== 'string') return { kind: 'empty' };
  const value = raw.trim();
  if (!value) return { kind: 'empty' };

  if (value.length > MAX_QUERY_LENGTH) {
    return {
      kind: 'invalid',
      value,
      reason: `Search is too long (max ${MAX_QUERY_LENGTH} characters).`,
    };
  }

  // Addresses are uppercase base32; accept a lowercased paste as well.
  const upper = value.toUpperCase();
  if (!STRKEY_SHAPE.test(upper)) return { kind: 'text', value };

  const noun = upper.startsWith('G') ? 'account address' : 'contract ID';
  if (upper.length !== STRKEY_LENGTH) {
    return {
      kind: 'invalid',
      value,
      reason: `A Stellar ${noun} is ${STRKEY_LENGTH} characters; this one has ${upper.length}.`,
    };
  }

  if (upper.startsWith('G') && StrKey.isValidEd25519PublicKey(upper)) {
    return { kind: 'account', value: upper };
  }
  if (upper.startsWith('C') && StrKey.isValidContract(upper)) {
    return { kind: 'contract', value: upper };
  }

  return {
    kind: 'invalid',
    value,
    reason: `This is not a valid Stellar ${noun} (checksum failed). Check for typos.`,
  };
}

// ─── Command catalogue ───────────────────────────────────────────────────────

/** Settings-type destinations, grouped under "Settings" in the palette. */
const SETTINGS_ROUTES: Array<{ id: string; label: string; keywords: string[] }> = [
  { id: 'settings', label: 'Open Settings', keywords: ['preferences', 'config', 'network'] },
  { id: 'featureFlags', label: 'Feature Flags', keywords: ['flags', 'experiments', 'toggles'] },
  { id: 'personalization', label: 'AI Personalization', keywords: ['personalize', 'recommendations'] },
  { id: 'security', label: 'Security Settings', keywords: ['security', 'privacy'] },
];

const SETTINGS_ROUTE_IDS = new Set(SETTINGS_ROUTES.map((r) => r.id));

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-4)}`;
}

/**
 * Build the static command list. Malformed recent-account or template records
 * (e.g. from corrupted localStorage) are skipped rather than crashing the palette.
 */
export function buildPaletteCommands(input: BuildCommandsInput = {}): PaletteCommand[] {
  const commands: PaletteCommand[] = [];

  // Navigation — generated from the route registry (#959). Settings-type
  // routes are listed once, under Settings, rather than twice.
  for (const route of getNavRoutes()) {
    if (SETTINGS_ROUTE_IDS.has(route.id)) continue;
    commands.push({
      id: `nav-${route.id}`,
      label: `Go to ${route.title}`,
      category: 'Navigation',
      keywords: [route.id],
      target: { type: 'route', path: buildPath(route.id) },
    });
  }

  commands.push(
    { id: 'action-builder', label: 'Open Transaction Builder', category: 'Actions', target: { type: 'route', path: buildPath('txBuilder') } },
    { id: 'action-faucet', label: 'Request Testnet Funds', category: 'Actions', target: { type: 'route', path: buildPath('faucet') } },
    { id: 'action-compare', label: 'Compare Accounts', category: 'Actions', target: { type: 'route', path: buildPath('compare') } },
  );

  for (const setting of SETTINGS_ROUTES) {
    commands.push({
      id: `settings-${setting.id}`,
      label: setting.label,
      category: 'Settings',
      keywords: setting.keywords,
      target: { type: 'route', path: buildPath(setting.id) },
    });
  }
  commands.push(
    { id: 'settings-preferences', label: 'Open User Preferences', category: 'Settings', keywords: ['theme', 'language', 'display'], target: { type: 'preferences' } },
    { id: 'settings-shortcuts', label: 'Show Keyboard Shortcuts', category: 'Settings', keywords: ['keys', 'hotkeys', 'help'], target: { type: 'shortcuts' } },
  );

  const seenAccounts = new Set<string>();
  for (const account of input.recentAccounts ?? []) {
    const key = account?.publicKey;
    if (typeof key !== 'string' || !StrKey.isValidEd25519PublicKey(key) || seenAccounts.has(key)) continue;
    seenAccounts.add(key);
    commands.push({
      id: `account-${key}`,
      label: `Switch to ${shortAddress(key)}`,
      category: 'Recent Accounts',
      keywords: [key],
      target: { type: 'account', address: key },
    });
  }

  for (const template of input.templates ?? []) {
    if (typeof template?.id !== 'string' || !template.id) continue;
    const name = [template.label, template.name].find((v) => typeof v === 'string' && v) as string | undefined;
    commands.push({
      id: `template-${template.id}`,
      label: `Load Template: ${name ?? template.id}`,
      category: 'Templates',
      target: { type: 'template', templateId: template.id },
    });
  }

  return commands;
}

/**
 * Commands to show for a query. A valid account/contract produces a single
 * "jump" command; an invalid query produces none (the palette shows the
 * validation reason instead).
 */
export function getPaletteResults(commands: PaletteCommand[], query: PaletteQuery): PaletteCommand[] {
  switch (query.kind) {
    case 'empty':
      return commands;
    case 'invalid':
      return [];
    case 'account':
      return [
        {
          id: `jump-account-${query.value}`,
          label: `Open account ${shortAddress(query.value)}`,
          category: 'Jump to',
          target: { type: 'account', address: query.value },
        },
      ];
    case 'contract':
      return [
        {
          id: `jump-contract-${query.value}`,
          label: `Open contract ${shortAddress(query.value)}`,
          category: 'Jump to',
          target: { type: 'contract', contractId: query.value },
        },
      ];
    case 'text': {
      const needle = query.value.toLowerCase();
      return commands.filter((cmd) =>
        [cmd.label, cmd.category, ...(cmd.keywords ?? [])].some((field) =>
          field.toLowerCase().includes(needle),
        ),
      );
    }
    default:
      return [];
  }
}

/** Resolve a target to the URL it navigates to, or `null` for in-page actions. */
export function resolveTargetPath(target: PaletteTarget): string | null {
  switch (target.type) {
    case 'route':
      return target.path;
    case 'account':
      return buildPath('account', { address: target.address });
    case 'contract':
      return buildPath('contracts', { contractId: target.contractId });
    case 'template':
      return buildPath('txBuilder');
    default:
      return null;
  }
}

/** "⌘K" on Apple platforms, "Ctrl+K" elsewhere (and when the platform is unknown). */
export function getPaletteShortcutLabel(nav: { platform?: string; userAgent?: string } | undefined =
  typeof navigator === 'undefined' ? undefined : navigator): string {
  const platform = `${nav?.platform ?? ''} ${nav?.userAgent ?? ''}`;
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘K' : 'Ctrl+K';
}
