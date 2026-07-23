/**
 * SelfHealingManager — monitors service health and attempts automatic recovery.
 *
 * Provides:
 *  - Service registration with custom health-check and heal functions
 *  - Periodic background polling
 *  - Subscribe/notify for reactive UI updates
 *  - Manual heal, reset, and mark-healthy helpers
 */

export type ServiceHealth = 'healthy' | 'degraded' | 'recovering' | 'down' | 'unknown';

export type OverallHealth = 'healthy' | 'degraded' | 'recovering' | 'down' | 'unknown';

export interface ServiceStatus {
  id: string;
  name: string;
  health: ServiceHealth;
  lastChecked: number;
  lastHealAttempt: number | null;
  /** Timestamp of the last successful health check */
  lastSuccess: string | null;
  /** Timestamp of the last failed health check */
  lastFailure: string | null;
  /** Cumulative count of consecutive failures */
  failureCount: number;
  /** Cumulative count of recovery attempts */
  recoveryAttempts: number;
  /** Optional human-readable description of the current recovery action */
  recoveryAction: string | null;
}

type HealthChecker = () => Promise<ServiceHealth>;
type StatusMapListener = (map: Map<string, ServiceStatus>) => void;

interface ServiceRegistration {
  status: ServiceStatus;
  checker: HealthChecker;
  healFn: (() => Promise<void>) | null;
}

class SelfHealingManagerImpl {
  private services: Map<string, ServiceRegistration> = new Map();
  private listeners: Set<StatusMapListener> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private intervalMs = 30_000;

  // ─── Registration ─────────────────────────────────────────────────────────

  /** Register a service for health monitoring. */
  register(
    id: string,
    name: string,
    checker: HealthChecker,
    healFn?: () => Promise<void>
  ): void {
    this.services.set(id, {
      status: {
        id,
        name,
        health: 'unknown',
        lastChecked: Date.now(),
        lastHealAttempt: null,
        lastSuccess: null,
        lastFailure: null,
        failureCount: 0,
        recoveryAttempts: 0,
        recoveryAction: null,
      },
      checker,
      healFn: healFn ?? null,
    });
    this.notify();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /** Start the background health-check loop. */
  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => void this.checkAll(), this.intervalMs);
    // Run an initial check immediately
    void this.checkAll();
  }

  /** Stop the background loop. */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // ─── Reactive subscription ────────────────────────────────────────────────

  /**
   * Subscribe to status map updates.
   * Returns an unsubscribe function.
   */
  subscribe(listener: StatusMapListener): () => void {
    this.listeners.add(listener);
    // Deliver current state immediately
    listener(this.getStatuses());
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ─── Status queries ───────────────────────────────────────────────────────

  /**
   * Return a snapshot of all current service statuses.
   * Returns a Map<string, ServiceStatus> so callers can iterate values().
   */
  getStatuses(): Map<string, ServiceStatus> {
    const out = new Map<string, ServiceStatus>();
    for (const [id, reg] of this.services) {
      out.set(id, { ...reg.status });
    }
    return out;
  }

  // ─── Manual actions ───────────────────────────────────────────────────────

  /** Immediately attempt to heal the service with the given id. */
  async healNow(id: string): Promise<void> {
    const reg = this.services.get(id);
    if (!reg) return;
    reg.status.health = 'recovering';
    reg.status.lastHealAttempt = Date.now();
    reg.status.recoveryAttempts += 1;
    reg.status.recoveryAction = reg.healFn ? 'Running heal function…' : 'Re-probing service…';
    this.notify();
    if (reg.healFn) {
      try {
        await reg.healFn();
        reg.status.health = 'healthy';
        reg.status.lastSuccess = new Date().toISOString();
        reg.status.failureCount = 0;
        reg.status.recoveryAction = null;
      } catch {
        reg.status.health = 'down';
        reg.status.lastFailure = new Date().toISOString();
        reg.status.failureCount += 1;
        reg.status.recoveryAction = null;
      }
    } else {
      try {
        reg.status.health = await reg.checker();
        if (reg.status.health === 'healthy') {
          reg.status.lastSuccess = new Date().toISOString();
          reg.status.failureCount = 0;
        } else {
          reg.status.lastFailure = new Date().toISOString();
          reg.status.failureCount += 1;
        }
        reg.status.recoveryAction = null;
      } catch {
        reg.status.health = 'down';
        reg.status.lastFailure = new Date().toISOString();
        reg.status.failureCount += 1;
        reg.status.recoveryAction = null;
      }
    }
    reg.status.lastChecked = Date.now();
    this.notify();
  }

  /** Reset a service to 'unknown' state and re-probe it. */
  resetService(id: string): void {
    const reg = this.services.get(id);
    if (!reg) return;
    reg.status.health = 'unknown';
    reg.status.lastHealAttempt = null;
    reg.status.failureCount = 0;
    reg.status.recoveryAttempts = 0;
    reg.status.recoveryAction = null;
    this.notify();
    void this.checkOne(id);
  }

  /** Manually mark a service as healthy (e.g. after an external fix). */
  markHealthy(id: string): void {
    const reg = this.services.get(id);
    if (!reg) return;
    reg.status.health = 'healthy';
    reg.status.lastChecked = Date.now();
    this.notify();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async checkAll(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.services.keys()).map((id) => this.checkOne(id))
    );
  }

  private async checkOne(id: string): Promise<void> {
    const reg = this.services.get(id);
    if (!reg) return;
    try {
      reg.status.health = await reg.checker();
      if (reg.status.health === 'healthy') {
        reg.status.lastSuccess = new Date().toISOString();
        reg.status.failureCount = 0;
      } else {
        reg.status.lastFailure = new Date().toISOString();
        reg.status.failureCount += 1;
      }
    } catch {
      reg.status.health = 'down';
      reg.status.lastFailure = new Date().toISOString();
      reg.status.failureCount += 1;
    }
    reg.status.lastChecked = Date.now();
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getStatuses();
    this.listeners.forEach((l) => l(snapshot));
  }
}

export const selfHealingManager = new SelfHealingManagerImpl();
