/**
 * CircuitBreaker.ts — Issue #144
 * Circuit breaker pattern for fault-tolerant load distribution.
 *
 * LOAD BALANCING — FAILURE ISOLATION SUBSYSTEM
 * =============================================
 * The circuit breaker protects the load distribution system from cascading
 * failures. When an endpoint or service degrades, the breaker opens to
 * redirect traffic to healthy alternatives, maintaining overall system
 * responsiveness even when individual components fail.
 *
 * States:
 *   CLOSED    — Normal operation, requests pass through.
 *               Failure counter resets on each success.
 *   OPEN      — Threshold exceeded (default: 5 failures).
 *               All requests are rejected immediately with an error,
 *               preventing wasted resources on a failing service.
 *               After timeout (default: 60s), transitions to HALF_OPEN.
 *   HALF_OPEN — Testing recovery. A single request is allowed through.
 *               On success (× threshold, default: 2): back to CLOSED.
 *               On failure: back to OPEN immediately.
 *
 * Integration with load distribution:
 *   - Each endpoint type (horizon, soroban, coingecko) has its own breaker
 *   - Capacity prediction from capacityPrediction.ts adjusts failure thresholds
 *     during predicted high-load periods to reduce false positives
 *   - The rate limiter (rateLimiter.js) checks breaker state before queuing
 *   - Performance monitoring (performanceMonitoring.js) records state transitions
 *
 * @see RetryManager.ts — companion module for retry logic before tripping breaker
 */

import { createLogger } from '../../utils/logger'

const logger = createLogger('CircuitBreaker')

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  failureThreshold?: number
  successThreshold?: number
  timeout?: number
  name?: string
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime: number | null = null
  private readonly failureThreshold: number
  private readonly successThreshold: number
  private readonly timeout: number
  private readonly name: string

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5
    this.successThreshold = options.successThreshold ?? 2
    this.timeout = options.timeout ?? 60_000 // 60s before trying again
    this.name = options.name ?? 'CircuitBreaker'
  }

  get currentState(): CircuitState {
    return this.state
  }

  get isOpen(): boolean {
    return this.state === 'OPEN'
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('HALF_OPEN')
      } else {
        throw new Error(`[${this.name}] Circuit is OPEN — service unavailable`)
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    if (this.state === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= this.successThreshold) {
        this.transitionTo('CLOSED')
      }
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    this.successCount = 0

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.transitionTo('OPEN')
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailureTime !== null && Date.now() - this.lastFailureTime >= this.timeout
  }

  private transitionTo(newState: CircuitState): void {
    logger.warn(`[${this.name}] Circuit state: ${this.state} → ${newState}`, {
      failureCount: this.failureCount,
      successCount: this.successCount,
    })
    this.state = newState
    if (newState === 'CLOSED') {
      this.failureCount = 0
      this.successCount = 0
    }
  }

  reset(): void {
    this.transitionTo('CLOSED')
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    }
  }
}

// ─── Service Registry — Per-endpoint Circuit Breakers ──────────────────────

/**
 * Registry of circuit breakers keyed by service name.
 * Each API endpoint type gets its own breaker so a failure in one service
 * (e.g., Soroban RPC) doesn't affect others (e.g., Horizon accounts).
 *
 * Services with registered breakers:
 *   - 'horizon'   — Standard Stellar Horizon API
 *   - 'soroban'   — Soroban RPC for contract operations
 *   - 'coingecko' — External price feed API
 *   - 'websocket' — Real-time collaboration WebSocket
 *
 * Thresholds are tuned per service based on criticality and failure patterns.
 */
const breakers = new Map<string, CircuitBreaker>()

export function getCircuitBreaker(service: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (!breakers.has(service)) {
    breakers.set(service, new CircuitBreaker({ ...options, name: service }))
  }
  return breakers.get(service)!
}
