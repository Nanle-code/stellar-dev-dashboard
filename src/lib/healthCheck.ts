/**
 * Client-side Health Check
 *
 * Provides `getHealthStatus()` — a lightweight, dependency-aware health
 * snapshot analogous to a `/health` HTTP endpoint.  It is surfaced:
 *
 *  1. In the existing System Health dashboard tab (pass it to any component
 *     that renders operational metrics).
 *  2. Via the nginx `/health` location (already returns 200 'ok' at the
 *     network layer; this JS layer adds runtime depth on top).
 *  3. By the `alertDispatch` pipeline to decide whether to fire a critical
 *     alert when a dependency probe fails.
 *
 * No server-side code is needed — everything runs in the browser.
 */

import { createLogger } from '../utils/logger';
// collectHealthSnapshot / computeHealthScore live in the pre-existing JS module.
// We import them with the .js extension so bundler mode resolves without .ts
import {
  collectHealthSnapshot,
  computeHealthScore,
} from '../utils/monitoring.js';
import { addBreadcrumb } from './errorReporting';

const logger = createLogger('HealthCheck');

// ─── Types ────────────────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface DependencyProbe {
  name: string;
  status: HealthStatus;
  latencyMs: number | null;
  message?: string;
}

export interface HealthReport {
  status: HealthStatus;
  score: number;           // 0–100
  uptimeMs: number;
  memory: {
    usedMB: number | null;
    totalMB: number | null;
    heapLimitMB: number | null;
    pressureLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  };
  network: {
    online: boolean;
    effectiveType: string | null;
    rttMs: number | null;
    downlinkMbps: number | null;
  };
  dependencies: DependencyProbe[];
  webVitals: {
    lcp: number | null;
    fid: number | null;
    cls: number | null;
  };
  timestamp: string;
  version: string;
}

// ─── Internal state ───────────────────────────────────────────────────────────

const _appStart = Date.now();
const _vitals: { lcp: number | null; fid: number | null; cls: number | null } = {
  lcp: null,
  fid: null,
  cls: null,
};

// Passively capture web vitals as they arrive so `getHealthStatus()` can
// report them without blocking.
if (typeof PerformanceObserver !== 'undefined') {
  try {
    new PerformanceObserver(list => {
      const last = list.getEntries().at(-1) as PerformanceEntry | undefined;
      if (last) _vitals.lcp = Math.round(last.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* unsupported */ }

  try {
    let clsAcc = 0;
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        clsAcc += (e as unknown as { value: number }).value ?? 0;
      }
      _vitals.cls = Number(clsAcc.toFixed(3));
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* unsupported */ }

  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        const entry = e as unknown as { processingStart: number; startTime: number };
        _vitals.fid = Math.round(entry.processingStart - entry.startTime);
      }
    }).observe({ type: 'first-input', buffered: true });
  } catch { /* unsupported */ }
}

// ─── Dependency probes ────────────────────────────────────────────────────────

/**
 * Probe an external HTTP dependency.
 * Returns within `timeoutMs` even if the request hangs.
 */
async function probeHttpEndpoint(
  name: string,
  url: string,
  timeoutMs = 4000,
): Promise<DependencyProbe> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    const latencyMs = Math.round(performance.now() - start);
    return {
      name,
      status: res.ok ? 'healthy' : 'degraded',
      latencyMs,
      message: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name,
      status: 'unhealthy',
      latencyMs: null,
      message: err instanceof Error ? err.message : 'probe failed',
    };
  }
}

/**
 * Register custom dependency probes.  Out of the box we probe:
 *  - Stellar Horizon testnet (always available; a sensible live canary)
 *  - Stellar Horizon mainnet
 *
 * Add your own via `registerDependencyProbe()`.
 */
type ProbeFactory = () => Promise<DependencyProbe>;

const _probes: Map<string, ProbeFactory> = new Map([
  [
    'horizon.testnet',
    () =>
      probeHttpEndpoint(
        'Stellar Horizon (testnet)',
        'https://horizon-testnet.stellar.org',
      ),
  ],
  [
    'horizon.mainnet',
    () =>
      probeHttpEndpoint(
        'Stellar Horizon (mainnet)',
        'https://horizon.stellar.org',
      ),
  ],
]);

export function registerDependencyProbe(key: string, factory: ProbeFactory): void {
  _probes.set(key, factory);
}

export function unregisterDependencyProbe(key: string): void {
  _probes.delete(key);
}

// ─── Memory helpers ───────────────────────────────────────────────────────────

type MemoryInfo = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

function readMemory() {
  const mem = (performance as unknown as { memory?: MemoryInfo }).memory;
  if (!mem) {
    return { usedMB: null, totalMB: null, heapLimitMB: null, pressureLevel: 'unknown' as const };
  }
  const usedMB = Math.round(mem.usedJSHeapSize / 1_048_576);
  const totalMB = Math.round(mem.totalJSHeapSize / 1_048_576);
  const heapLimitMB = Math.round(mem.jsHeapSizeLimit / 1_048_576);
  const ratio = mem.usedJSHeapSize / mem.jsHeapSizeLimit;

  const pressureLevel =
    ratio > 0.9 ? 'critical' :
    ratio > 0.8 ? 'high' :
    ratio > 0.7 ? 'medium' : 'low';

  return { usedMB, totalMB, heapLimitMB, pressureLevel } as const;
}

function readNetwork() {
  type NetInfo = { effectiveType?: string; rtt?: number; downlink?: number };
  const conn = (navigator as unknown as { connection?: NetInfo }).connection;
  return {
    online: navigator.onLine,
    effectiveType: conn?.effectiveType ?? null,
    rttMs: conn?.rtt ?? null,
    downlinkMbps: conn?.downlink ?? null,
  };
}

// ─── Aggregate status ─────────────────────────────────────────────────────────

function aggregateStatus(score: number, deps: DependencyProbe[]): HealthStatus {
  const anyUnhealthy = deps.some(d => d.status === 'unhealthy');
  const anyDegraded  = deps.some(d => d.status === 'degraded');

  if (!navigator.onLine || score < 30 || anyUnhealthy) return 'unhealthy';
  if (score < 70 || anyDegraded) return 'degraded';
  return 'healthy';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Perform a full health check and return a structured report.
 *
 * `runProbes` defaults to `true` in production so callers get real dependency
 * latency data; set it to `false` for a cheaper synchronous-ish snapshot.
 */
export async function getHealthStatus(runProbes = true): Promise<HealthReport> {
  const snapshot = collectHealthSnapshot();
  const score    = computeHealthScore(snapshot);
  const memory   = readMemory();
  const network  = readNetwork();

  let dependencies: DependencyProbe[] = [];
  if (runProbes) {
    const probeResults = await Promise.allSettled(
      Array.from(_probes.values()).map(factory => factory()),
    );
    dependencies = probeResults.map(r =>
      r.status === 'fulfilled'
        ? r.value
        : { name: 'unknown', status: 'unhealthy' as HealthStatus, latencyMs: null, message: 'probe threw' },
    );
  }

  const status = aggregateStatus(score, dependencies);

  const report: HealthReport = {
    status,
    score,
    uptimeMs: Date.now() - _appStart,
    memory,
    network,
    dependencies,
    webVitals: { ..._vitals },
    timestamp: new Date().toISOString(),
    version: (import.meta.env.VITE_SENTRY_RELEASE as string | undefined) ?? 'unknown',
  };

  addBreadcrumb(`Health check: ${status} (score ${score})`, 'health', { score, status });

  if (status !== 'healthy') {
    logger.warn('Health check degraded', { status, score, dependencies });
  } else {
    logger.debug('Health check passed', { score });
  }

  return report;
}

/**
 * Simplified probe suitable for a status badge or polling hook.
 * Returns within `timeoutMs` even if dependency probes are slow.
 */
export async function quickHealthCheck(timeoutMs = 5000): Promise<HealthStatus> {
  try {
    const result = await Promise.race([
      getHealthStatus(true),
      new Promise<HealthReport>((_, reject) =>
        setTimeout(() => reject(new Error('health check timed out')), timeoutMs),
      ),
    ]);
    return result.status;
  } catch (err) {
    logger.warn('Quick health check timed out or failed', {}, err instanceof Error ? err : undefined);
    return 'degraded';
  }
}
