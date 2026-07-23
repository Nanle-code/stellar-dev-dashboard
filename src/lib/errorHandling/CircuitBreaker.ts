/**
 * CircuitBreaker.ts — Issue #144
 * Circuit breaker pattern to prevent cascading failures on API calls.
 *
 * States:
 *   CLOSED   — normal operation, requests pass through
 *   OPEN     — too many failures, requests are rejected immediately
 *   HALF_OPEN — testing if the service has recovered
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

// Per-service circuit breakers
const breakers = new Map<string, CircuitBreaker>()

export function getCircuitBreaker(service: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (!breakers.has(service)) {
    breakers.set(service, new CircuitBreaker({ ...options, name: service }))
  }
  return breakers.get(service)!
}
