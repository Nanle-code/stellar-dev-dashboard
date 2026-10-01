/**
 * Tamper-evident audit export for privileged dashboard actions.
 *
 * Privileged actions are a subset of the general audit log:
 *   - Mainnet writes (transaction submissions, contract invocations)
 *   - Settings changes (network switch, wallet config, security preferences)
 *   - Admin operations (bulk operations, data exports, role changes)
 *
 * Each export includes the chain-head hash so that reviewers can verify
 * the exported records against the live log. See SECURITY.md for details.
 *
 * Compatibility: pure TypeScript, no runtime dependencies beyond the
 * existing audit utilities. Works in Node and browser environments.
 *
 * Security: exports MUST NOT include secret keys or credentials. The
 * redaction layer in audit.ts handles this before entries reach this module.
 */

import {
  getAuditEntries,
  exportAuditJson,
  exportAuditCsv,
  verifyAuditChain,
  AuditCategory,
  AuditSeverity,
} from './audit.js';
import type { AuditEntry } from '../types/audit';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Supported export formats. */
export type ExportFormat = 'json' | 'csv';

/** Options for a privileged audit export. */
export interface PrivilegedAuditExportOptions {
  /** Only include entries at or after this ISO-8601 timestamp. */
  since?: string;
  /** Only include entries at or before this ISO-8601 timestamp. */
  until?: string;
  /** Restrict to a specific actor (wallet address or user ID). */
  actor?: string;
  /** Output format. Defaults to "json". */
  format?: ExportFormat;
  /**
   * When true, the chain integrity is verified before export.
   * Defaults to true. Set to false only for read-only diagnostic exports.
   */
  verifyChain?: boolean;
}

/** The result of a successful privileged audit export. */
export interface PrivilegedAuditExportResult {
  /** Serialised export content (JSON string or CSV string). */
  content: string;
  /** Format used for this export. */
  format: ExportFormat;
  /** Number of privileged entries included in this export. */
  entryCount: number;
  /**
   * Hash of the last entry in the export (chain head at export time).
   * Reviewers can compare this against the live log to detect post-export
   * tampering.
   */
  chainHeadHash: string;
  /** ISO-8601 timestamp when this export was generated. */
  exportedAt: string;
  /** Whether chain integrity was verified before export. */
  chainVerified: boolean;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class AuditExportError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_FORMAT'
      | 'INVALID_TIME_RANGE'
      | 'UNSUPPORTED_ENVIRONMENT'
      | 'CHAIN_INTEGRITY_FAILURE'
      | 'STORE_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'AuditExportError';
  }
}

// ── Privileged category set ───────────────────────────────────────────────────

/**
 * Categories that constitute "privileged" actions for this export.
 * Covers Mainnet writes (transaction, contract) and settings/admin changes.
 */
export const PRIVILEGED_CATEGORIES = new Set([
  AuditCategory.TRANSACTION,
  AuditCategory.CONTRACT,
  AuditCategory.CONFIG,
  AuditCategory.ADMIN,
  AuditCategory.SECURITY,
  AuditCategory.WALLET,
]);

/**
 * Severity levels that always qualify an entry as privileged regardless
 * of category — catches high-severity events from any category.
 */
export const PRIVILEGED_SEVERITIES = new Set([
  AuditSeverity.HIGH,
  AuditSeverity.CRITICAL,
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidIso8601(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function isPrivileged(entry: AuditEntry): boolean {
  return (
    PRIVILEGED_CATEGORIES.has(entry.category as any) ||
    PRIVILEGED_SEVERITIES.has(entry.severity as any)
  );
}

/**
 * Detect whether the audit store is accessible. In environments where
 * IndexedDB / localStorage is unavailable (e.g. server-side rendering
 * without a DOM), the audit log cannot be read reliably.
 */
function isAuditStoreAvailable(): boolean {
  // In Node (tests / SSR) there is no window, but the in-memory ring is
  // still usable — treat as available.
  if (typeof window === 'undefined') return true;
  try {
    return typeof window.indexedDB !== 'undefined' || typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Export privileged dashboard audit entries in the requested format.
 *
 * Throws AuditExportError on:
 * - unsupported format
 * - malformed or inverted time range
 * - unavailable audit store
 * - chain integrity failure (when verifyChain is true, the default)
 */
export async function exportPrivilegedAudit(
  options: PrivilegedAuditExportOptions = {},
): Promise<PrivilegedAuditExportResult> {
  const {
    since,
    until,
    actor,
    format = 'json',
    verifyChain = true,
  } = options;

  // ── Validate format ──────────────────────────────────────────────────────
  if (format !== 'json' && format !== 'csv') {
    throw new AuditExportError(
      'INVALID_FORMAT',
      `Unsupported export format "${String(format)}". Supported formats: json, csv.`,
    );
  }

  // ── Validate time range ──────────────────────────────────────────────────
  if (since !== undefined && !isValidIso8601(since)) {
    throw new AuditExportError(
      'INVALID_TIME_RANGE',
      `"since" is not a valid ISO-8601 timestamp: "${since}".`,
    );
  }
  if (until !== undefined && !isValidIso8601(until)) {
    throw new AuditExportError(
      'INVALID_TIME_RANGE',
      `"until" is not a valid ISO-8601 timestamp: "${until}".`,
    );
  }
  if (since !== undefined && until !== undefined) {
    if (Date.parse(since) > Date.parse(until)) {
      throw new AuditExportError(
        'INVALID_TIME_RANGE',
        `"since" (${since}) must not be after "until" (${until}).`,
      );
    }
  }

  // ── Check environment ────────────────────────────────────────────────────
  if (!isAuditStoreAvailable()) {
    throw new AuditExportError(
      'UNSUPPORTED_ENVIRONMENT',
      'Audit export is not available in this environment: the audit store is inaccessible.',
    );
  }

  // ── Verify chain integrity before export ─────────────────────────────────
  let chainVerified = false;
  if (verifyChain) {
    const verification = await verifyAuditChain();
    if (!verification.valid) {
      throw new AuditExportError(
        'CHAIN_INTEGRITY_FAILURE',
        `Audit chain integrity check failed at entry index ${verification.brokenAt}: ${verification.reason}. ` +
          'The log may have been tampered with. Aborting export.',
      );
    }
    chainVerified = true;
  }

  // ── Fetch and filter entries ─────────────────────────────────────────────
  let entries: AuditEntry[];
  try {
    entries = getAuditEntries({ since, until, actor, limit: 10_000 } as any) as AuditEntry[];
  } catch (err) {
    throw new AuditExportError(
      'STORE_UNAVAILABLE',
      `Failed to read audit entries: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const privileged = entries.filter(isPrivileged);

  // ── Serialise ────────────────────────────────────────────────────────────
  const content =
    format === 'json' ? exportAuditJson(privileged) : exportAuditCsv(privileged);

  const chainHeadHash = privileged.length > 0 ? privileged[0].hash : '0';

  return {
    content,
    format,
    entryCount: privileged.length,
    chainHeadHash,
    exportedAt: new Date().toISOString(),
    chainVerified,
  };
}

/**
 * Quick helper to record a privileged action directly.
 * Re-exports recordAudit from audit.ts so callers only need one import.
 */
export { recordAudit as recordPrivilegedAction } from './audit.js';
