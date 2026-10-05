/**
 * cspReporting.ts — Issue #831
 *
 * Content Security Policy violation capture with sampling and triage support.
 *
 * Design goals:
 *   - **Sampling** — CSP violations can be extremely noisy (third-party scripts,
 *     browser extensions). `sampleRate` keeps a configurable fraction, and the
 *     sample decision is injected (`random`) so it is deterministic in tests.
 *   - **No sensitive content** — `blocked-uri`, `document-uri`, `source-file`
 *     and `original-policy` are sanitised (query strings / fragments stripped,
 *     secret-shaped strings redacted, values truncated). The browser's
 *     `sample` / `script-sample` field is **never** captured, because it can
 *     contain page content.
 *   - **Failure paths** — invalid input is dropped and counted; dispatch errors
 *     never throw into the page; unsupported environments (no `document`) are a
 *     no-op.
 *
 * @see docs/security/csp-reporting.md
 * @see src/lib/securityEvents.ts — audit-trail integration
 */

import { redactSensitive } from '../utils/security';
import { createLogger } from '../utils/logger';

const logger = createLogger('CspReporting');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Same-origin collector declared by `report-uri` / `Reporting-Endpoints`. */
export const DEFAULT_CSP_REPORT_ENDPOINT = '/api/security/csp-report';

/** Fraction of CSP violations captured by default (0–1). */
export const DEFAULT_CSP_SAMPLE_RATE = 0.25;

/** Maximum number of violations retained in memory for the triage dashboard. */
export const DEFAULT_CSP_MAX_ENTRIES = 100;

const MAX_URI_LENGTH = 512;
const MAX_POLICY_LENGTH = 1024;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CspDisposition = 'enforce' | 'report' | string;

export interface CspViolation {
  id: string;
  timestamp: string;
  /** Sanitised URI of the resource that was blocked. */
  blockedUri: string;
  /** Sanitised URI of the document in which the violation occurred. */
  documentUri: string;
  violatedDirective: string;
  effectiveDirective: string;
  /** Truncated, redacted policy. */
  originalPolicy: string;
  disposition: CspDisposition;
  statusCode: number;
  /** Sanitised source file (query strings stripped). */
  sourceFile: string;
  lineNumber: number | null;
  columnNumber: number | null;
  /** Always `true` for entries in the store — unsampled reports are dropped. */
  sampled: true;
}

export interface CspReporterOptions {
  /** 0–1. Defaults to {@link DEFAULT_CSP_SAMPLE_RATE}. */
  sampleRate?: number;
  /** Ring-buffer capacity. Defaults to {@link DEFAULT_CSP_MAX_ENTRIES}. */
  maxEntries?: number;
  /** Collector endpoint. Defaults to {@link DEFAULT_CSP_REPORT_ENDPOINT}. */
  endpoint?: string;
  /** When `false`, reports are stored but never dispatched. Defaults to `true`. */
  send?: boolean;
  /** Injectable RNG for deterministic sampling in tests. */
  random?: () => number;
}

export interface CspReporterStats {
  received: number;
  recorded: number;
  droppedInvalid: number;
  droppedSampled: number;
}

export interface CspReportBody {
  'blocked-uri': string;
  'document-uri': string;
  'violated-directive': string;
  'effective-directive': string;
  'original-policy': string;
  disposition: CspDisposition;
  'status-code': number;
  'source-file': string;
  'line-number': number | null;
  'column-number': number | null;
}

// ─── Sanitisation helpers ─────────────────────────────────────────────────────

function redact(value: unknown): string {
  try {
    return String(redactSensitive(value, undefined) ?? '');
  } catch {
    return '';
  }
}

function toFiniteNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Sanitise a URI for reporting. Strips query strings and fragments (which may
 * carry tokens or user data), redacts secret-shaped strings, and truncates.
 */
export function sanitizeCspUri(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return '';

  let candidate = value.trim().slice(0, MAX_URI_LENGTH);

  // High-risk opaque schemes can embed content — never report it verbatim.
  if (/^data:/i.test(candidate)) return 'data:[redacted]';
  if (/^blob:/i.test(candidate)) return 'blob:[redacted]';
  if (/^(inline|eval|wasm-eval|trusted-types-eval|report-sample)$/i.test(candidate)) {
    return candidate;
  }

  const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate);
  try {
    const url = new URL(candidate, 'https://placeholder.invalid');
    candidate = isAbsolute ? `${url.origin}${url.pathname}` : url.pathname;
  } catch {
    candidate = candidate.split(/[?#]/)[0];
  }

  return redact(candidate).slice(0, MAX_URI_LENGTH);
}

function readField(source: Record<string, unknown>, camel: string, kebab: string): unknown {
  return source[camel] ?? source[kebab];
}

/**
 * Normalise a `SecurityPolicyViolationEvent` or a raw `csp-report` JSON object.
 * Returns `null` for invalid input (non-objects, unusable directives).
 */
export function normalizeCspViolation(raw: unknown): CspViolation | null {
  if (!raw || typeof raw !== 'object') return null;

  const source = raw as Record<string, unknown>;
  const violatedDirective = redact(
    readField(source, 'violatedDirective', 'violated-directive') ??
      readField(source, 'effectiveDirective', 'effective-directive'),
  ).slice(0, MAX_URI_LENGTH);

  if (!violatedDirective) return null;

  const now = Date.now();
  return {
    id: `csp-${now}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(now).toISOString(),
    blockedUri: sanitizeCspUri(readField(source, 'blockedURI', 'blocked-uri')),
    documentUri: sanitizeCspUri(readField(source, 'documentURI', 'document-uri')),
    violatedDirective,
    effectiveDirective: redact(
      readField(source, 'effectiveDirective', 'effective-directive'),
    ).slice(0, MAX_URI_LENGTH),
    originalPolicy: redact(
      readField(source, 'originalPolicy', 'original-policy'),
    ).slice(0, MAX_POLICY_LENGTH),
    disposition: (readField(source, 'disposition', 'disposition') as CspDisposition) ?? 'enforce',
    statusCode: toFiniteNumberOrNull(readField(source, 'statusCode', 'status-code')) ?? 0,
    sourceFile: sanitizeCspUri(readField(source, 'sourceFile', 'source-file')),
    lineNumber: toFiniteNumberOrNull(readField(source, 'lineNumber', 'line-number')),
    columnNumber: toFiniteNumberOrNull(readField(source, 'columnNumber', 'column-number')),
    sampled: true,
  };
}

/**
 * Build the wire-format report body. Deliberately omits `sample` /
 * `script-sample` so page content is never transmitted.
 */
export function toCspReportBody(violation: CspViolation): CspReportBody {
  return {
    'blocked-uri': violation.blockedUri,
    'document-uri': violation.documentUri,
    'violated-directive': violation.violatedDirective,
    'effective-directive': violation.effectiveDirective,
    'original-policy': violation.originalPolicy,
    disposition: violation.disposition,
    'status-code': violation.statusCode,
    'source-file': violation.sourceFile,
    'line-number': violation.lineNumber,
    'column-number': violation.columnNumber,
  };
}

// ─── Sampling ─────────────────────────────────────────────────────────────────

/**
 * Decide whether a violation should be kept.
 *
 * @throws {TypeError} if `rate` is not a finite number — invalid configuration
 *   is a programmer error, not something to silently guess at.
 */
export function shouldSample(rate: number, random: () => number = Math.random): boolean {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new TypeError('CSP sample rate must be a finite number');
  }
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return random() < rate;
}

// ─── Reporter ─────────────────────────────────────────────────────────────────

export type CspViolationListener = (_violation: CspViolation) => void;

export class CspReporter {
  private violations: CspViolation[] = [];
  private readonly listeners = new Set<CspViolationListener>();
  private readonly sampleRate: number;
  private readonly maxEntries: number;
  private readonly endpoint: string;
  private readonly send: boolean;
  private readonly random: () => number;
  private stats: CspReporterStats = {
    received: 0,
    recorded: 0,
    droppedInvalid: 0,
    droppedSampled: 0,
  };

  constructor(options: CspReporterOptions = {}) {
    const rate = options.sampleRate ?? DEFAULT_CSP_SAMPLE_RATE;
    if (typeof rate !== 'number' || !Number.isFinite(rate)) {
      throw new TypeError('CSP sample rate must be a finite number');
    }
    this.sampleRate = Math.min(1, Math.max(0, rate));
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? DEFAULT_CSP_MAX_ENTRIES));
    this.endpoint = options.endpoint ?? DEFAULT_CSP_REPORT_ENDPOINT;
    this.send = options.send ?? true;
    this.random = options.random ?? Math.random;
  }

  /** Capture a raw violation. Returns the stored entry, or `null` if dropped. */
  report(raw: unknown): CspViolation | null {
    this.stats.received += 1;

    const violation = normalizeCspViolation(raw);
    if (!violation) {
      this.stats.droppedInvalid += 1;
      return null;
    }

    if (!shouldSample(this.sampleRate, this.random)) {
      this.stats.droppedSampled += 1;
      return null;
    }

    this.violations.unshift(violation);
    if (this.violations.length > this.maxEntries) {
      this.violations.length = this.maxEntries;
    }
    this.stats.recorded += 1;

    this.listeners.forEach((listener) => {
      try {
        listener(violation);
      } catch {
        /* listener errors must never break capture */
      }
    });

    if (this.send) this.dispatch(violation);

    return violation;
  }

  getViolations(): CspViolation[] {
    return [...this.violations];
  }

  getStats(): CspReporterStats {
    return { ...this.stats };
  }

  clear(): void {
    this.violations = [];
    this.stats = { received: 0, recorded: 0, droppedInvalid: 0, droppedSampled: 0 };
  }

  subscribe(listener: CspViolationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private dispatch(violation: CspViolation): void {
    if (!this.endpoint) return;
    const payload = JSON.stringify({ 'csp-report': toCspReportBody(violation) });

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob =
          typeof Blob !== 'undefined'
            ? new Blob([payload], { type: 'application/csp-report' })
            : payload;
        if (navigator.sendBeacon(this.endpoint, blob)) return;
      }

      if (typeof fetch === 'function') {
        void fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/csp-report' },
          body: payload,
          keepalive: true,
        }).catch((error) => {
          logger.warn('CSP report dispatch failed', { endpoint: this.endpoint, error: String(error) });
        });
        return;
      }

      logger.warn('CSP report dropped: no network transport', { endpoint: this.endpoint });
    } catch (error) {
      logger.warn('CSP report dispatch threw', {
        endpoint: this.endpoint,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ─── Default reporter (shared with the audit trail) ─────────────────────────────

let defaultReporter: CspReporter | null = null;

export function getCspReporter(): CspReporter {
  if (!defaultReporter) defaultReporter = new CspReporter();
  return defaultReporter;
}

/** Replace the shared reporter (used by init/config and tests). */
export function configureCspReporter(options: CspReporterOptions): CspReporter {
  defaultReporter = new CspReporter(options);
  return defaultReporter;
}

/** Reset the shared reporter to `null` (tests). */
export function resetCspReporter(): void {
  defaultReporter = null;
}

// ─── DOM listener ──────────────────────────────────────────────────────────────

/**
 * Subscribe to the browser's `securitypolicyviolation` events and forward them
 * to a reporter. No-op (returns an uninstaller) in unsupported environments.
 */
export function installCspReporting(reporter: CspReporter = getCspReporter()): () => void {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
    logger.warn('CSP reporting not installed: unsupported environment');
    return () => {};
  }

  const handler = (event: Event): void => {
    reporter.report(event);
  };

  document.addEventListener('securitypolicyviolation', handler);
  return () => document.removeEventListener('securitypolicyviolation', handler);
}
