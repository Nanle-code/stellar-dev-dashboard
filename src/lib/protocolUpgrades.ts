/**
 * protocolUpgrades.ts — loader + validator for the curated protocol upgrade
 * tracker (#985).
 *
 * Two very different sources feed the Network view:
 *   1. The *current* protocol version, read live from the ledger header
 *      (`protocol_version`) returned by Horizon.
 *   2. A curated, versioned JSON file (`src/data/protocol-upgrades.json`) that
 *      lists upcoming upgrade windows, their CAPs, and scheduled Testnet resets.
 *
 * The curated file is edited by humans, so every read goes through
 * `parseProtocolUpgrades()`. It never throws partial data: malformed input
 * raises a single `ProtocolUpgradesError` carrying every issue it found, which
 * lets the UI show a precise, recoverable error instead of a blank section.
 *
 * Keep this module free of React/network imports so it stays cheap to test.
 */

import rawProtocolUpgrades from '../data/protocol-upgrades.json';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpgradeStatus = 'in-development' | 'scheduled' | 'activated';
export type DateConfidence = 'confirmed' | 'estimated' | 'unknown';

export interface ProtocolCapRef {
  /** e.g. `CAP-0083`. */
  number: string;
  title: string;
  /** Must point at the canonical stellar-protocol CAP file. */
  url: string;
  /** `confirmed` when the CAP index maps it to the version, `tbd` for candidates. */
  assignment?: string;
}

export interface ActivationWindow {
  start: string;
  end: string;
}

export interface ProtocolUpgradeEntry {
  protocolVersion: number;
  status: UpgradeStatus;
  /** Networks the upgrade is already live on. */
  networks: string[];
  /** Networks the upgrade is expected to reach. */
  targetNetworks?: string[];
  activationDate: string | null;
  activationWindow: ActivationWindow | null;
  dateConfidence: DateConfidence;
  dateNote?: string;
  title: string;
  summary: string;
  impacts: string[];
  caps: ProtocolCapRef[];
  capsNote?: string;
}

export interface TestnetResetNotice {
  network: string;
  scheduledFor: string | null;
  dateConfidence: DateConfidence;
  dateNote?: string;
  summary: string;
  impacts: string[];
  reSeedGuideUrl: string;
  reSeedCommand?: string;
}

export interface ReferenceProtocolVersion {
  version: number;
  lastVerified: string;
  source: string;
}

export interface ProtocolUpgradesData {
  schemaVersion: number;
  dataVersion: number;
  lastUpdated: string;
  updateGuide: string;
  capIndexUrl: string;
  schema?: Record<string, unknown>;
  referenceProtocolVersions: Record<string, ReferenceProtocolVersion>;
  upgrades: ProtocolUpgradeEntry[];
  testnetResets: TestnetResetNotice[];
}

/** A reset notice already matched against a warning window. */
export interface ActiveResetNotice extends TestnetResetNotice {
  daysUntil: number;
}

export interface ProtocolVersionRow {
  network: string;
  version: number;
  source: 'ledger-header' | 'last-verified';
  live: boolean;
  lastVerified: string | null;
}

export interface ProtocolUpgradesErrorReport {
  name: 'ProtocolUpgradesError';
  issues: string[];
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ProtocolUpgradesError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid protocol upgrades data: ${issues.join('; ')}`);
    this.name = 'ProtocolUpgradesError';
    this.issues = issues;
  }
}

/** Convert any thrown value into the shape the UI renders for bad data. */
export function toProtocolUpgradesErrorReport(error: unknown): ProtocolUpgradesErrorReport {
  if (error instanceof ProtocolUpgradesError) {
    return { name: 'ProtocolUpgradesError', issues: error.issues };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { name: 'ProtocolUpgradesError', issues: [message] };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UPGRADE_STATUSES: UpgradeStatus[] = ['in-development', 'scheduled', 'activated'];
const DATE_CONFIDENCES: DateConfidence[] = ['confirmed', 'estimated', 'unknown'];

const CAP_URL_PREFIX = 'https://github.com/stellar/stellar-protocol/';
const CAP_NUMBER_RE = /^CAP-(\d{4})$/;
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Small guards ─────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isIsoDay(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_DAY_RE.test(value) &&
    !Number.isNaN(parseIsoDay(value) as number)
  );
}

/** Parse a YYYY-MM-DD string as a UTC midnight timestamp, or `null`. */
export function parseIsoDay(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !ISO_DAY_RE.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateCap(raw: unknown, path: string, issues: string[]): ProtocolCapRef {
  if (!isPlainObject(raw)) {
    issues.push(`${path} must be an object`);
    return { number: '', title: '', url: '' };
  }

  const number = raw.number;
  const match = typeof number === 'string' ? CAP_NUMBER_RE.exec(number) : null;
  if (!match) {
    issues.push(`${path}.number must look like CAP-0000 (got ${JSON.stringify(number)})`);
  }

  if (!isNonEmptyString(raw.title)) {
    issues.push(`${path}.title must be a non-empty string`);
  }

  const url = raw.url;
  if (typeof url !== 'string' || !url.startsWith(CAP_URL_PREFIX)) {
    issues.push(`${path}.url must be a ${CAP_URL_PREFIX}… link`);
  } else if (match && !url.toLowerCase().includes(`cap-${match[1]}.md`)) {
    // Guard against copy/paste mix-ups where CAP-0062 points at cap-0063.md.
    issues.push(`${path}.url does not point at ${String(number).toLowerCase()}.md`);
  }

  if (raw.assignment !== undefined && !isNonEmptyString(raw.assignment)) {
    issues.push(`${path}.assignment must be a non-empty string when present`);
  }

  return {
    number: typeof number === 'string' ? number : '',
    title: typeof raw.title === 'string' ? raw.title : '',
    url: typeof url === 'string' ? url : '',
    assignment: typeof raw.assignment === 'string' ? raw.assignment : undefined,
  };
}

function validateActivationWindow(
  raw: unknown,
  path: string,
  issues: string[],
): ActivationWindow | null {
  if (raw === null || raw === undefined) return null;
  if (!isPlainObject(raw)) {
    issues.push(`${path} must be null or an object with start/end`);
    return null;
  }
  if (!isIsoDay(raw.start)) issues.push(`${path}.start must be a YYYY-MM-DD date`);
  if (!isIsoDay(raw.end)) issues.push(`${path}.end must be a YYYY-MM-DD date`);
  if (isIsoDay(raw.start) && isIsoDay(raw.end)) {
    if ((parseIsoDay(raw.start) as number) > (parseIsoDay(raw.end) as number)) {
      issues.push(`${path}.start must not be after ${path}.end`);
    }
  }
  return {
    start: typeof raw.start === 'string' ? raw.start : '',
    end: typeof raw.end === 'string' ? raw.end : '',
  };
}

function validateUpgrade(raw: unknown, index: number, issues: string[]): ProtocolUpgradeEntry {
  const path = `upgrades[${index}]`;
  const entry: ProtocolUpgradeEntry = {
    protocolVersion: 0,
    status: 'scheduled',
    networks: [],
    activationDate: null,
    activationWindow: null,
    dateConfidence: 'unknown',
    title: '',
    summary: '',
    impacts: [],
    caps: [],
  };

  if (!isPlainObject(raw)) {
    issues.push(`${path} must be an object`);
    return entry;
  }

  if (!isPositiveInt(raw.protocolVersion)) {
    issues.push(`${path}.protocolVersion must be a positive integer`);
  } else {
    entry.protocolVersion = raw.protocolVersion;
  }

  if (!UPGRADE_STATUSES.includes(raw.status as UpgradeStatus)) {
    issues.push(`${path}.status must be one of ${UPGRADE_STATUSES.join(' | ')}`);
  } else {
    entry.status = raw.status as UpgradeStatus;
  }

  if (!isStringArray(raw.networks) || raw.networks.length === 0) {
    issues.push(`${path}.networks must be a non-empty string array`);
  } else {
    entry.networks = raw.networks;
  }

  if (raw.targetNetworks !== undefined) {
    if (!isStringArray(raw.targetNetworks)) {
      issues.push(`${path}.targetNetworks must be a string array when present`);
    } else {
      entry.targetNetworks = raw.targetNetworks;
    }
  }

  if (raw.activationDate !== null && raw.activationDate !== undefined) {
    if (!isIsoDay(raw.activationDate)) {
      issues.push(`${path}.activationDate must be null or a YYYY-MM-DD date`);
    } else {
      entry.activationDate = raw.activationDate;
    }
  }

  entry.activationWindow = validateActivationWindow(raw.activationWindow, `${path}.activationWindow`, issues);

  if (!DATE_CONFIDENCES.includes(raw.dateConfidence as DateConfidence)) {
    issues.push(`${path}.dateConfidence must be one of ${DATE_CONFIDENCES.join(' | ')}`);
  } else {
    entry.dateConfidence = raw.dateConfidence as DateConfidence;
  }

  if (raw.dateNote !== undefined && !isNonEmptyString(raw.dateNote)) {
    issues.push(`${path}.dateNote must be a non-empty string when present`);
  } else if (typeof raw.dateNote === 'string') {
    entry.dateNote = raw.dateNote;
  }

  if (!isNonEmptyString(raw.title)) {
    issues.push(`${path}.title must be a non-empty string`);
  } else {
    entry.title = raw.title;
  }

  if (!isNonEmptyString(raw.summary)) {
    issues.push(`${path}.summary must be a non-empty string`);
  } else {
    entry.summary = raw.summary;
  }

  if (!isStringArray(raw.impacts)) {
    issues.push(`${path}.impacts must be a string array`);
  } else {
    entry.impacts = raw.impacts;
  }

  if (!Array.isArray(raw.caps)) {
    issues.push(`${path}.caps must be an array`);
  } else {
    entry.caps = raw.caps.map((cap, capIndex) =>
      validateCap(cap, `${path}.caps[${capIndex}]`, issues),
    );
    if (raw.caps.length === 0 && !isNonEmptyString(raw.capsNote)) {
      issues.push(`${path}.capsNote is required when no CAPs are assigned yet`);
    }
  }

  if (raw.capsNote !== undefined && !isNonEmptyString(raw.capsNote)) {
    issues.push(`${path}.capsNote must be a non-empty string when present`);
  } else if (typeof raw.capsNote === 'string') {
    entry.capsNote = raw.capsNote;
  }

  return entry;
}

function validateReset(raw: unknown, index: number, issues: string[]): TestnetResetNotice {
  const path = `testnetResets[${index}]`;
  const notice: TestnetResetNotice = {
    network: '',
    scheduledFor: null,
    dateConfidence: 'unknown',
    summary: '',
    impacts: [],
    reSeedGuideUrl: '',
  };

  if (!isPlainObject(raw)) {
    issues.push(`${path} must be an object`);
    return notice;
  }

  if (!isNonEmptyString(raw.network)) {
    issues.push(`${path}.network must be a non-empty string`);
  } else {
    notice.network = raw.network;
  }

  if (raw.scheduledFor !== null && raw.scheduledFor !== undefined) {
    if (!isIsoDay(raw.scheduledFor)) {
      issues.push(`${path}.scheduledFor must be null or a YYYY-MM-DD date`);
    } else {
      notice.scheduledFor = raw.scheduledFor;
    }
  }

  if (!DATE_CONFIDENCES.includes(raw.dateConfidence as DateConfidence)) {
    issues.push(`${path}.dateConfidence must be one of ${DATE_CONFIDENCES.join(' | ')}`);
  } else {
    notice.dateConfidence = raw.dateConfidence as DateConfidence;
  }

  if (raw.dateNote !== undefined && !isNonEmptyString(raw.dateNote)) {
    issues.push(`${path}.dateNote must be a non-empty string when present`);
  } else if (typeof raw.dateNote === 'string') {
    notice.dateNote = raw.dateNote;
  }

  if (!isNonEmptyString(raw.summary)) {
    issues.push(`${path}.summary must be a non-empty string`);
  } else {
    notice.summary = raw.summary;
  }

  if (!isStringArray(raw.impacts)) {
    issues.push(`${path}.impacts must be a string array`);
  } else {
    notice.impacts = raw.impacts;
  }

  if (!isNonEmptyString(raw.reSeedGuideUrl)) {
    issues.push(`${path}.reSeedGuideUrl must be a non-empty string`);
  } else {
    notice.reSeedGuideUrl = raw.reSeedGuideUrl;
  }

  if (raw.reSeedCommand !== undefined && !isNonEmptyString(raw.reSeedCommand)) {
    issues.push(`${path}.reSeedCommand must be a non-empty string when present`);
  } else if (typeof raw.reSeedCommand === 'string') {
    notice.reSeedCommand = raw.reSeedCommand;
  }

  return notice;
}

/**
 * Validate an arbitrary value into `ProtocolUpgradesData`.
 *
 * Throws a single `ProtocolUpgradesError` listing every problem found, so a
 * maintainer sees all schema mistakes at once instead of one per re-run.
 */
export function parseProtocolUpgrades(raw: unknown): ProtocolUpgradesData {
  if (!isPlainObject(raw)) {
    throw new ProtocolUpgradesError(['root must be an object']);
  }

  const issues: string[] = [];

  if (!isPositiveInt(raw.schemaVersion)) issues.push('schemaVersion must be a positive integer');
  if (raw.dataVersion !== undefined && !isPositiveInt(raw.dataVersion)) {
    issues.push('dataVersion must be a positive integer when present');
  }
  if (!isIsoDay(raw.lastUpdated)) issues.push('lastUpdated must be a YYYY-MM-DD date');
  if (!isNonEmptyString(raw.updateGuide)) issues.push('updateGuide must be a non-empty string');
  if (!isNonEmptyString(raw.capIndexUrl)) {
    issues.push('capIndexUrl must be a non-empty string');
  } else if (!raw.capIndexUrl.startsWith(CAP_URL_PREFIX)) {
    issues.push(`capIndexUrl must be a ${CAP_URL_PREFIX}… link`);
  }
  if (raw.schema !== undefined && !isPlainObject(raw.schema)) {
    issues.push('schema must be an object when present');
  }

  const referenceProtocolVersions: Record<string, ReferenceProtocolVersion> = {};
  if (!isPlainObject(raw.referenceProtocolVersions)) {
    issues.push('referenceProtocolVersions must be an object');
  } else {
    for (const [network, value] of Object.entries(raw.referenceProtocolVersions)) {
      const path = `referenceProtocolVersions.${network}`;
      if (!isPlainObject(value)) {
        issues.push(`${path} must be an object`);
        continue;
      }
      if (!isPositiveInt(value.version)) issues.push(`${path}.version must be a positive integer`);
      if (!isIsoDay(value.lastVerified)) issues.push(`${path}.lastVerified must be a YYYY-MM-DD date`);
      if (!isNonEmptyString(value.source)) issues.push(`${path}.source must be a non-empty string`);
      referenceProtocolVersions[network] = {
        version: isPositiveInt(value.version) ? value.version : 0,
        lastVerified: typeof value.lastVerified === 'string' ? value.lastVerified : '',
        source: typeof value.source === 'string' ? value.source : '',
      };
    }
  }

  let upgrades: ProtocolUpgradeEntry[] = [];
  if (!Array.isArray(raw.upgrades)) {
    issues.push('upgrades must be an array');
  } else {
    upgrades = raw.upgrades.map((entry, index) => validateUpgrade(entry, index, issues));
  }

  let testnetResets: TestnetResetNotice[] = [];
  if (!Array.isArray(raw.testnetResets)) {
    issues.push('testnetResets must be an array');
  } else {
    testnetResets = raw.testnetResets.map((entry, index) => validateReset(entry, index, issues));
  }

  if (issues.length > 0) {
    throw new ProtocolUpgradesError(issues);
  }

  return {
    schemaVersion: raw.schemaVersion as number,
    dataVersion: isPositiveInt(raw.dataVersion) ? raw.dataVersion : 1,
    lastUpdated: raw.lastUpdated as string,
    updateGuide: raw.updateGuide as string,
    capIndexUrl: raw.capIndexUrl as string,
    schema: isPlainObject(raw.schema) ? raw.schema : undefined,
    referenceProtocolVersions,
    upgrades,
    testnetResets,
  };
}

// ─── Default loader ───────────────────────────────────────────────────────────

let cachedDefault: ProtocolUpgradesData | null = null;

/**
 * Return validated tracker data. Pass `raw` (a fixture, or an in-memory edit)
 * to validate it instead of the bundled JSON — handy for tests and for the UI
 * failure path.
 */
export function getProtocolUpgrades(raw?: unknown): ProtocolUpgradesData {
  if (raw !== undefined) return parseProtocolUpgrades(raw);
  if (!cachedDefault) cachedDefault = parseProtocolUpgrades(rawProtocolUpgrades);
  return cachedDefault;
}

/** Test-only: drop the memoized bundled data so a suite can re-parse it. */
export function resetProtocolUpgradesCacheForTests(): void {
  cachedDefault = null;
}

// ─── Live ledger header ───────────────────────────────────────────────────────

/**
 * Read the protocol version from a Horizon ledger header. Horizon exposes it as
 * `protocol_version`; we also accept the camelCase form used by some mocks.
 */
export function extractProtocolVersion(ledger: unknown): number | null {
  if (!isPlainObject(ledger)) return null;
  const raw = ledger.protocol_version ?? ledger.protocolVersion;
  const value = typeof raw === 'string' ? Number(raw) : raw;
  return isPositiveInt(value) ? value : null;
}

/**
 * Build one row per known network. The active network uses the live ledger
 * header when available and falls back to the curated last-verified value;
 * every other network always shows its last-verified value.
 */
export function resolveProtocolVersionRows(
  data: ProtocolUpgradesData,
  options: { network?: string; ledger?: unknown } = {},
): ProtocolVersionRow[] {
  const { network, ledger } = options;
  const liveVersion = ledger !== undefined ? extractProtocolVersion(ledger) : null;
  const preferredOrder = ['mainnet', 'testnet', 'futurenet'];

  return Object.keys(data.referenceProtocolVersions)
    .sort((a, b) => {
      const ai = preferredOrder.indexOf(a);
      const bi = preferredOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .map((key) => {
      const reference = data.referenceProtocolVersions[key];
      const isActiveNetwork = network === key;
      const useLive = isActiveNetwork && liveVersion !== null;
      return {
        network: key,
        version: useLive ? (liveVersion as number) : reference.version,
        source: useLive ? 'ledger-header' : 'last-verified',
        live: useLive,
        lastVerified: reference.lastVerified || null,
      };
    });
}

// ─── Selection helpers ────────────────────────────────────────────────────────

/** Whole UTC days until an ISO day: 0 = today, negative = already past. */
export function daysUntilIsoDay(isoDay: string | null | undefined, now: Date = new Date()): number | null {
  const target = parseIsoDay(isoDay);
  if (target === null) return null;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - todayUtc) / DAY_MS);
}

export interface ResetWindowOptions {
  now?: Date;
  /**
   * How many days ahead of a reset the banner appears. A reset exactly
   * `warningWindowDays` away is included; the next day is not.
   */
  warningWindowDays?: number;
}

/** Resets that are due today or within the warning window, soonest first. */
export function getActiveResetNotices(
  data: ProtocolUpgradesData,
  options: ResetWindowOptions = {},
): ActiveResetNotice[] {
  const now = options.now ?? new Date();
  const window = options.warningWindowDays ?? 14;

  return data.testnetResets
    .map((notice) => {
      const daysUntil = daysUntilIsoDay(notice.scheduledFor, now);
      return daysUntil === null ? null : { ...notice, daysUntil };
    })
    .filter((notice): notice is ActiveResetNotice => {
      if (!notice) return false;
      return notice.daysUntil >= 0 && notice.daysUntil <= window;
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/** Upgrades that have not fully activated yet, newest version first. */
export function getUpcomingUpgrades(data: ProtocolUpgradesData): ProtocolUpgradeEntry[] {
  return data.upgrades
    .filter((upgrade) => upgrade.status !== 'activated')
    .sort((a, b) => b.protocolVersion - a.protocolVersion);
}

/** Every upgrade entry, newest version first (for the version history list). */
export function getUpgradesByVersion(data: ProtocolUpgradesData): ProtocolUpgradeEntry[] {
  return [...data.upgrades].sort((a, b) => b.protocolVersion - a.protocolVersion);
}
