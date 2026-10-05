/**
 * providerCircuitBreaker.ts — Issue #828
 *
 * Circuit-breaker protection for external analytics / monitoring providers.
 *
 * The dashboard ships telemetry to several third-party providers (Sentry,
 * the analytics collector, the RUM endpoint, the error-reporting endpoint).
 * When one of those providers is slow, rate-limiting, or hard-down, telemetry
 * must not take the product down with it.
 *
 * This module wraps the generic {@link CircuitBreaker} from
 * `src/lib/errorHandling/CircuitBreaker.ts` and adds a *failure policy* that
 * decides what happens when a provider is unavailable:
 *
 *   - `fail-open`  — best-effort telemetry. The send is dropped and the caller
 *                    continues normally. Use for analytics / RUM, where losing
 *                    a sample is preferable to breaking a user flow.
 *   - `fail-closed` — delivery matters. The error is re-thrown so the caller can
 *                    retain and retry the payload (e.g. the error-reporting queue).
 *
 * States (delegated to {@link CircuitBreaker}):
 *   CLOSED    → requests pass through. Consecutive failures trip the breaker.
 *   OPEN      → requests are skipped immediately (no network) until `timeout`.
 *   HALF_OPEN → a single probe request is allowed; success closes the circuit.
 *
 * @see docs/MONITORING_CIRCUIT_BREAKER.md
 * @see src/lib/errorHandling/CircuitBreaker.ts
 */

import {
  CircuitBreaker,
  type CircuitBreakerOptions,
  type CircuitState,
} from '../lib/errorHandling/CircuitBreaker';
import { createLogger } from './logger';

const logger = createLogger('ProviderCircuitBreaker');

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderFailurePolicy = 'fail-open' | 'fail-closed';

export interface ProviderProtectionOptions extends CircuitBreakerOptions {
  /**
   * What to do when the provider is unavailable.
   * Defaults to the provider policy (see {@link setProviderPolicy}) which
   * itself defaults to `fail-open`.
   */
  policy?: ProviderFailurePolicy;
}

export interface ProviderSendResult<T> {
  /** `true` when the provider accepted the payload. */
  delivered: boolean;
  /** `true` when the payload was not delivered (skipped or errored). */
  dropped: boolean;
  /**
   * `true` when the circuit was OPEN and the operation was never invoked,
   * so no network request was made.
   */
  skipped: boolean;
  /** The value returned by a successful operation. */
  value?: T;
  /** The error raised by a failed operation (fail-open only). */
  error?: unknown;
}

export interface ProviderStats {
  provider: string;
  policy: ProviderFailurePolicy;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
}

// ─── Policy registry ──────────────────────────────────────────────────────────

/**
 * Sensible defaults per built-in provider. Analytics and RUM are best-effort
 * (fail-open); the error-reporting queue is delivery-oriented (fail-closed).
 */
const DEFAULT_PROVIDER_POLICIES: Readonly<Record<string, ProviderFailurePolicy>> = {
  analytics: 'fail-open',
  rum: 'fail-open',
  errorReporting: 'fail-closed',
  sentry: 'fail-open',
};

export const DEFAULT_PROVIDER_POLICY: ProviderFailurePolicy = 'fail-open';

const providerPolicies = new Map<string, ProviderFailurePolicy>();

/**
 * Per-provider breakers, owned by this module so tuning passed to the first
 * `guardProviderSend` call is honoured and can be re-armed on reset.
 */
const breakers = new Map<string, CircuitBreaker>();

function getBreaker(provider: string, options: CircuitBreakerOptions = {}): CircuitBreaker {
  let breaker = breakers.get(provider);
  if (!breaker) {
    breaker = new CircuitBreaker({ ...options, name: provider });
    breakers.set(provider, breaker);
  }
  return breaker;
}

function assertProviderName(provider: unknown): asserts provider is string {
  if (typeof provider !== 'string' || provider.trim() === '') {
    throw new TypeError('Provider name must be a non-empty string');
  }
}

/**
 * Override the failure policy for a single provider at runtime.
 */
export function setProviderPolicy(provider: string, policy: ProviderFailurePolicy): void {
  assertProviderName(provider);
  if (policy !== 'fail-open' && policy !== 'fail-closed') {
    throw new TypeError(`Unsupported provider policy: ${String(policy)}`);
  }
  providerPolicies.set(provider, policy);
}

/**
 * Resolve the effective failure policy for a provider.
 */
export function getProviderPolicy(provider: string): ProviderFailurePolicy {
  assertProviderName(provider);
  return providerPolicies.get(provider) ?? DEFAULT_PROVIDER_POLICIES[provider] ?? DEFAULT_PROVIDER_POLICY;
}

/**
 * Reset the policy override for a provider back to its built-in default.
 */
export function clearProviderPolicy(provider: string): void {
  assertProviderName(provider);
  providerPolicies.delete(provider);
}

// ─── Environment guard ────────────────────────────────────────────────────────

/**
 * Whether the current runtime can actually deliver telemetry over the network.
 * Guarded so server-side rendering / non-browser environments fail predictably
 * instead of throwing a ReferenceError.
 */
export function isTransportSupported(): boolean {
  if (typeof fetch === 'function') return true;
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') return true;
  return false;
}

// ─── Core guard ───────────────────────────────────────────────────────────────

/**
 * Execute an external analytics / monitoring operation under circuit-breaker
 * protection.
 *
 * @param provider   Stable provider key, e.g. `'analytics'`, `'rum'`.
 * @param operation  The network operation to run.
 * @param options    Breaker tuning + optional policy override.
 *
 * @throws {TypeError} If `provider` is not a non-empty string or `operation`
 *   is not a function — malformed input is a programmer error, never telemetry.
 * @throws The original error when the effective policy is `fail-closed`.
 */
export async function guardProviderSend<T>(
  provider: string,
  operation: () => T | Promise<T>,
  options: ProviderProtectionOptions = {},
): Promise<ProviderSendResult<T>> {
  assertProviderName(provider);
  if (typeof operation !== 'function') {
    throw new TypeError('Provider operation must be a function');
  }

  const policy = options.policy ?? getProviderPolicy(provider);
  const breaker = getBreaker(provider, options);

  // No usable transport: never trip the breaker, honour the policy instead.
  if (!isTransportSupported()) {
    const error = new Error(`[${provider}] No network transport available`);
    if (policy === 'fail-closed') throw error;
    logger.warn('Telemetry dropped: no network transport available', { provider });
    return { delivered: false, dropped: true, skipped: true, error };
  }

  let invoked = false;
  try {
    const value = await breaker.execute(async () => {
      invoked = true;
      return operation();
    });
    return { delivered: true, dropped: false, skipped: false, value };
  } catch (error) {
    if (policy === 'fail-closed') throw error;

    // The breaker rejected the call before we touched the network.
    if (!invoked) {
      logger.warn('Telemetry dropped: provider circuit is OPEN', {
        provider,
        state: breaker.currentState,
      });
      return { delivered: false, dropped: true, skipped: true, error };
    }

    logger.warn('Telemetry dropped: provider send failed', {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return { delivered: false, dropped: true, skipped: false, error };
  }
}

// ─── Introspection helpers ────────────────────────────────────────────────────

/**
 * Current circuit + policy snapshot for a provider. Useful for health UI and
 * diagnostics.
 */
export function getProviderStats(provider: string): ProviderStats {
  assertProviderName(provider);
  const breaker = getBreaker(provider);
  return { provider, policy: getProviderPolicy(provider), ...breaker.getStats() };
}

/**
 * Reset a provider's circuit to CLOSED. Intended for tests and for the
 * "retry now" affordance after a manual recovery.
 *
 * Pass `options` to re-arm the breaker with new tuning; omit them to keep the
 * existing thresholds and simply close the circuit.
 */
export function resetProviderCircuitBreaker(
  provider: string,
  options?: CircuitBreakerOptions,
): void {
  assertProviderName(provider);
  if (options) {
    breakers.set(provider, new CircuitBreaker({ ...options, name: provider }));
    return;
  }
  breakers.get(provider)?.reset();
}
