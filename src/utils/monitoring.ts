/**
 * Production Monitoring & Observability
 *
 * Initialises Sentry for error tracking + performance tracing,
 * bridges into the existing errorReporting / performance pipelines,
 * and captures global uncaught exceptions / unhandled rejections.
 *
 * Call `initMonitoring()` once at the very top of `src/main.jsx`,
 * before `ReactDOM.createRoot(…).render(…)`.
 *
 * Environment variables (set via .env or your CI secrets manager):
 *   VITE_SENTRY_DSN          – Sentry project DSN  (required in production)
 *   VITE_SENTRY_ENV          – "production" | "staging" | "development"
 *   VITE_SENTRY_RELEASE      – build SHA / semver tag injected at build time
 *   VITE_SENTRY_TRACES_RATE  – 0–1 float for performance sampling (default 0.1)
 *   VITE_SENTRY_REPLAY_RATE  – 0–1 float for Session Replay (default 0.05)
 */

import * as Sentry from '@sentry/react';
import {
  reportError,
  addBreadcrumb,
  initializeErrorReporting,
} from '../lib/errorReporting';
import { initPerformanceMonitoring } from '../lib/performance';
import { createLogger } from './logger';

const logger = createLogger('Monitoring');

// ─── Config ───────────────────────────────────────────────────────────────────

export interface MonitoringConfig {
  /** Sentry DSN – omit or leave empty to disable Sentry. */
  sentryDsn?: string;
  /** "production" | "staging" | "development" */
  environment: string;
  /** Release identifier (git SHA, semver tag). */
  release?: string;
  /** Fraction of transactions to sample for performance tracing (0–1). */
  tracesSampleRate: number;
  /** Fraction of sessions to record via Session Replay (0–1). */
  replaySampleRate: number;
  /** Optional RUM endpoint for the existing performance pipeline. */
  rumEndpoint?: string;
}

const defaultConfig: MonitoringConfig = {
  sentryDsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  environment: (import.meta.env.VITE_SENTRY_ENV as string | undefined) ?? import.meta.env.MODE ?? 'development',
  release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
  tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_RATE ?? 0.1),
  replaySampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_RATE ?? 0.05),
  rumEndpoint: import.meta.env.VITE_RUM_ENDPOINT as string | undefined,
};

let _initialised = false;

// ─── Sentry init ──────────────────────────────────────────────────────────────

function initialiseSentry(cfg: MonitoringConfig): void {
  if (!cfg.sentryDsn) {
    logger.warn('Sentry DSN not set – error tracking disabled.', { env: cfg.environment });
    return;
  }

  Sentry.init({
    dsn: cfg.sentryDsn,
    environment: cfg.environment,
    release: cfg.release,

    // ── Performance (APM) ────────────────────────────────────────────────────
    // Instruments fetch/XHR, React routing spans, and long-tasks automatically.
    tracesSampleRate: cfg.tracesSampleRate,

    // ── Session Replay ───────────────────────────────────────────────────────
    // Captures a lightweight DOM snapshot replay for error sessions.
    replaysSessionSampleRate: 0,           // don't record healthy sessions
    replaysOnErrorSampleRate: cfg.replaySampleRate,

    // ── Integrations ─────────────────────────────────────────────────────────
    integrations: [
      // Browser performance tracing (route changes, HTTP requests, long-tasks)
      Sentry.browserTracingIntegration(),
      // Session Replay on error
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
      // Capture console.error calls as breadcrumbs
      Sentry.breadcrumbsIntegration({ console: true }),
    ],

    // ── Scrubbing ────────────────────────────────────────────────────────────
    // Strip PII / secrets from outgoing event payloads.
    beforeSend(event) {
      // Remove auth tokens from request headers recorded in the event
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, string>;
        delete h['Authorization'];
        delete h['Cookie'];
        delete h['X-Api-Key'];
      }
      // Strip query params that may carry secrets
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url);
          ['token', 'key', 'secret', 'api_key', 'access_token'].forEach(p =>
            u.searchParams.delete(p),
          );
          event.request.url = u.toString();
        } catch {
          /* ignore malformed URLs */
        }
      }
      return event;
    },

    // Drop Sentry's own internal traffic and localhost noise
    denyUrls: [/localhost/, /127\.0\.0\.1/, /extensions\//i],
  });

  logger.info('Sentry initialised', {
    env: cfg.environment,
    release: cfg.release ?? 'unknown',
    tracesSampleRate: cfg.tracesSampleRate,
  });
}

// ─── Global error listeners ───────────────────────────────────────────────────

/**
 * Captures uncaught exceptions and unhandled promise rejections,
 * forwarding them to both Sentry and the existing errorReporting pipeline.
 */
function attachGlobalErrorHandlers(): void {
  window.addEventListener('error', (event: ErrorEvent) => {
    const err = event.error instanceof Error ? event.error : new Error(event.message);

    // Sentry already captures window.onerror via its SDK, but we add extra
    // context tags here for the existing in-app error store.
    Sentry.withScope(scope => {
      scope.setTag('capture_mechanism', 'window.onerror');
      scope.setExtra('filename', event.filename);
      scope.setExtra('lineno', event.lineno);
      scope.setExtra('colno', event.colno);
      Sentry.captureException(err);
    });

    reportError(err, {
      context: 'Global Error Handler',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      category: 'javascript',
      severity: 'high',
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : new Error(String(reason ?? 'Unhandled rejection'));

    Sentry.withScope(scope => {
      scope.setTag('capture_mechanism', 'unhandledrejection');
      Sentry.captureException(err);
    });

    reportError(err, {
      context: 'Unhandled Promise Rejection',
      category: 'promise',
      severity: 'high',
    });
  });
}

// ─── Web Vitals → Sentry custom measurements ─────────────────────────────────

/**
 * Pipes Core Web Vitals collected by the existing performance pipeline
 * into Sentry as custom measurements on the active transaction/span,
 * and also emits a Sentry breadcrumb for quick triage.
 */
function attachWebVitalsBridge(): void {
  if (typeof PerformanceObserver === 'undefined') return;

  // LCP
  try {
    const lcpObs = new PerformanceObserver(list => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry;
      if (!last) return;
      const value = Math.round(last.startTime);
      Sentry.setMeasurement('lcp', value, 'millisecond');
      addBreadcrumb(`LCP: ${value}ms`, 'performance', { value });
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* observer not supported */ }

  // CLS
  try {
    let clsValue = 0;
    const clsObs = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        clsValue += (entry as unknown as { value: number }).value ?? 0;
      }
      const cls = Number(clsValue.toFixed(3));
      Sentry.setMeasurement('cls', cls, 'none');
      addBreadcrumb(`CLS: ${cls}`, 'performance', { value: cls });
    });
    clsObs.observe({ type: 'layout-shift', buffered: true });
  } catch { /* observer not supported */ }

  // FID / INP
  try {
    const inputObs = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const e = entry as unknown as { processingStart: number; startTime: number };
        const fid = Math.round(e.processingStart - e.startTime);
        Sentry.setMeasurement('fid', fid, 'millisecond');
        addBreadcrumb(`FID: ${fid}ms`, 'performance', { value: fid });
      }
    });
    inputObs.observe({ type: 'first-input', buffered: true });
  } catch { /* observer not supported */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise the full monitoring stack.
 *
 * Call once before `ReactDOM.createRoot(…).render(…)`.
 */
export function initMonitoring(userConfig: Partial<MonitoringConfig> = {}): void {
  if (_initialised) return;
  _initialised = true;

  const cfg: MonitoringConfig = { ...defaultConfig, ...userConfig };

  // 1. Sentry SDK
  initialiseSentry(cfg);

  // 2. Global error capture (bridges into errorReporting + Sentry)
  attachGlobalErrorHandlers();

  // 3. Web Vitals → Sentry measurements + breadcrumbs
  attachWebVitalsBridge();

  // 4. Existing performance monitoring (LCP/CLS/FID budgets, RUM endpoint)
  initPerformanceMonitoring({ rumEndpoint: cfg.rumEndpoint });

  // 5. Existing error reporting queue (batched flush, localStorage backup)
  initializeErrorReporting({ enabled: true });

  logger.info('Monitoring stack initialised', { env: cfg.environment });
}

// ─── Sentry user context helpers ─────────────────────────────────────────────

/**
 * Attach a Stellar account address as the Sentry "user" for session correlation.
 * Call after wallet connect; pass `null` to clear on disconnect.
 */
export function setMonitoringUser(
  stellarAddress: string | null,
  extra?: Record<string, unknown>,
): void {
  if (stellarAddress) {
    Sentry.setUser({ id: stellarAddress, ...extra });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Wrap a synchronous or async operation in a named Sentry performance span.
 *
 * @example
 * const result = await withSpan('stellar.horizon.fetchAccount', async () =>
 *   horizon.loadAccount(address)
 * );
 */
export async function withSpan<T>(
  name: string,
  fn: () => T | Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return Sentry.startSpan({ name, attributes }, () => fn());
}

/**
 * Manually capture an exception in Sentry with additional context.
 * Mirrors the existing `reportError` API but also sends to Sentry.
 */
export function captureError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  Sentry.withScope(scope => {
    if (context) {
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    }
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
  });
  reportError(err, context ?? {});
}

/**
 * Expose the Sentry error boundary component for wrapping route-level trees.
 *
 * @example
 * <SentryErrorBoundary fallback={<p>Something went wrong</p>}>
 *   <MyRoute />
 * </SentryErrorBoundary>
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

export default {
  initMonitoring,
  setMonitoringUser,
  withSpan,
  captureError,
  SentryErrorBoundary,
};
