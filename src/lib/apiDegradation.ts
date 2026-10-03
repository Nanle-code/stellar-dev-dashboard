/**
 * API Degradation Model (#821)
 * ============================
 * Pure, framework-agnostic logic that turns raw Horizon / Soroban RPC health
 * signals into a user-facing degradation banner with actionable retry guidance.
 *
 * The dashboard polls several upstream services. When one of them is slow or
 * unreachable we want to tell the user *what* is degraded and *whether* it is
 * worth retrying, instead of letting individual panels fail silently or render
 * a blank screen.
 *
 * Design rules:
 *  - Never throw on invalid input — unknown/malformed services degrade to the
 *    `unknown` health state so a banner can always be produced.
 *  - Works in unsupported environments (SSR / no `navigator`) because it has no
 *    browser dependencies.
 *  - Deterministic: callers pass `now`/`attempt` so tests can assert backoff.
 */

export type ApiServiceName = 'horizon' | 'soroban-rpc' | 'price-feed' | 'unknown';

export type ServiceHealth = 'operational' | 'degraded' | 'outage' | 'unknown';

export type DegradationSeverity = 'info' | 'warning' | 'critical';

export interface ServiceStatusInput {
  /** Logical service identifier (`horizon`, `soroban-rpc`, …). */
  service?: string | null;
  /** `false` means the last probe failed; `true` reachable; `null`/missing unknown. */
  reachable?: boolean | null;
  /** Round-trip latency of the most recent successful probe, milliseconds. */
  latencyMs?: number | null;
  /** Percentage (0–100) of recent requests that failed. */
  errorRatePct?: number | null;
  /** Epoch ms of the most recent error, if any. */
  lastErrorAt?: number | null;
  /** Optional human-readable detail from the probe. */
  message?: string | null;
}

export interface ServiceHealthResult {
  service: ApiServiceName;
  rawService: string;
  health: ServiceHealth;
  latencyMs: number | null;
  errorRatePct: number | null;
  reason: string;
}

export interface RetryGuidance {
  /** Whether the UI should offer a retry affordance at all. */
  retryable: boolean;
  /** Suggested delay before the next automatic retry (ms). */
  suggestedDelayMs: number;
  /** Human-readable instructions rendered under the banner headline. */
  steps: string[];
}

export interface DegradationBanner {
  /** Render the banner only when this is true. */
  visible: boolean;
  severity: DegradationSeverity;
  headline: string;
  detail: string;
  /** Services currently in outage / degraded state (in input order). */
  affected: ServiceHealthResult[];
  /** Services whose state could not be determined. */
  unknown: ServiceHealthResult[];
  retry: RetryGuidance;
}

/** Latency above which a reachable service is considered degraded. */
export const DEGRADED_LATENCY_MS = 2_000;
/** Error-rate percentage above which a reachable service is degraded. */
export const DEGRADED_ERROR_RATE_PCT = 5;

const RETRY_BASE_MS = 1_500;
const RETRY_MAX_MS = 60_000;

const KNOWN_SERVICES: ApiServiceName[] = ['horizon', 'soroban-rpc', 'price-feed'];

function normaliseService(raw: unknown): ApiServiceName {
  if (typeof raw !== 'string') return 'unknown';
  const value = raw.trim().toLowerCase();
  if (value === 'horizon' || value === 'horizon-testnet' || value === 'horizon-futurenet') {
    return 'horizon';
  }
  if (value.startsWith('soroban')) return 'soroban-rpc';
  if (value.includes('price')) return 'price-feed';
  return KNOWN_SERVICES.includes(value as ApiServiceName) ? (value as ApiServiceName) : 'unknown';
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

/**
 * Classify a single service signal into a health state.
 * Invalid input never throws — it yields `unknown`.
 */
export function classifyServiceHealth(input: ServiceStatusInput | null | undefined): ServiceHealthResult {
  const raw = input && typeof input === 'object' ? input : {};
  const service = normaliseService((raw as ServiceStatusInput).service);
  const latencyMs = finiteOrNull((raw as ServiceStatusInput).latencyMs);
  const errorRatePct = finiteOrNull((raw as ServiceStatusInput).errorRatePct);
  const reachable = (raw as ServiceStatusInput).reachable;

  let health: ServiceHealth = 'unknown';
  let reason = 'No health signal available.';

  if (reachable === false) {
    health = 'outage';
    reason =
      typeof (raw as ServiceStatusInput).message === 'string' && (raw as ServiceStatusInput).message
        ? String((raw as ServiceStatusInput).message)
        : 'Service is unreachable.';
  } else if (reachable === true) {
    const slow = latencyMs !== null && latencyMs > DEGRADED_LATENCY_MS;
    const erroring = errorRatePct !== null && errorRatePct >= DEGRADED_ERROR_RATE_PCT;
    if (slow || erroring) {
      health = 'degraded';
      const parts: string[] = [];
      if (slow) parts.push(`latency ${Math.round(latencyMs as number)}ms`);
      if (erroring) parts.push(`error rate ${(errorRatePct as number).toFixed(1)}%`);
      reason = `Service responding slowly (${parts.join(', ')}).`;
    } else {
      health = 'operational';
      reason = 'Service operating normally.';
    }
  }

  return {
    service,
    rawService: typeof (raw as ServiceStatusInput).service === 'string' ? String((raw as ServiceStatusInput).service) : 'unknown',
    health,
    latencyMs,
    errorRatePct,
    reason,
  };
}

/**
 * Exponential backoff with a hard cap. `attempt` is zero-based; values below 0
 * are treated as 0 so callers never get a negative delay.
 */
export function computeRetryDelayMs(attempt: number, baseMs = RETRY_BASE_MS, maxMs = RETRY_MAX_MS): number {
  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  const delay = baseMs * Math.pow(2, Math.min(safeAttempt, 10));
  return Math.min(delay, maxMs);
}

function affectedLabel(services: ServiceHealthResult[]): string {
  return services.map((s) => (s.service === 'unknown' ? s.rawService : s.service)).join(', ');
}

/**
 * Aggregate a list of service signals into a single banner model.
 *
 * Severity precedence: outage → critical, degraded → warning, unknown-only →
 * hidden (we don't want to nag the user when there is simply no data yet).
 */
export function evaluateApiDegradation(
  statuses: ServiceStatusInput[] | null | undefined,
  options: { attempt?: number; now?: number } = {}
): DegradationBanner {
  const list = Array.isArray(statuses) ? statuses : [];
  const results = list.map((s) => classifyServiceHealth(s));

  const outages = results.filter((r) => r.health === 'outage');
  const degraded = results.filter((r) => r.health === 'degraded');
  const unknown = results.filter((r) => r.health === 'unknown');
  const affected = [...outages, ...degraded];

  if (affected.length === 0) {
    return {
      visible: false,
      severity: 'info',
      headline: 'All services operational',
      detail: 'Horizon and Soroban RPC are responding normally.',
      affected: [],
      unknown,
      retry: { retryable: false, suggestedDelayMs: 0, steps: [] },
    };
  }

  const attempt = options.attempt ?? 0;
  const delay = computeRetryDelayMs(attempt);

  if (outages.length > 0) {
    const names = affectedLabel(affected);
    return {
      visible: true,
      severity: 'critical',
      headline: `Network service outage${outages.length > 1 ? 's' : ''} detected`,
      detail: `${names} ${outages.length > 1 ? 'are' : 'is'} unreachable. Live balances, transactions, and contract calls may be unavailable until connectivity is restored.`,
      affected,
      unknown,
      retry: {
        retryable: true,
        suggestedDelayMs: delay,
        steps: [
          'Cached data is still shown where available.',
          `Automatic retry in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}).`,
          'Use the Retry button to probe immediately.',
        ],
      },
    };
  }

  const names = affectedLabel(affected);
  return {
    visible: true,
    severity: 'warning',
    headline: 'Degraded network performance',
    detail: `${names} ${degraded.length > 1 ? 'are' : 'is'} responding slowly. Data may load with a delay.`,
    affected,
    unknown,
    retry: {
      retryable: true,
      suggestedDelayMs: delay,
      steps: [
        'Requests are being retried with exponential backoff.',
        `Next automatic retry in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}).`,
      ],
    },
  };
}
