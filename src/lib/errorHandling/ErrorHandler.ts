/**
 * ErrorHandler.ts — Issue #144
 * Central error handler that integrates RetryManager, CircuitBreaker, and ErrorMessages.
 */

import { RetryManager, type RetryOptions } from './RetryManager'
import { getCircuitBreaker, type CircuitBreakerOptions } from './CircuitBreaker'
import { getErrorMessage, getStellarErrorMessage } from './ErrorMessages'
import { createLogger } from '../../utils/logger'
import { reportError } from '../errorReporting'

const logger = createLogger('ErrorHandler')

export interface ErrorHandlerOptions {
  service?: string
  retry?: RetryOptions
  circuitBreaker?: CircuitBreakerOptions
  context?: Record<string, unknown>
}

export interface HandledError {
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  userFriendlyMessage: { title: string; message: string; action: string }
  isRetryable: boolean
  originalError: unknown
  timestamp: string
}

export class ErrorHandler {
  private retryManager: RetryManager
  private options: ErrorHandlerOptions

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = options
    this.retryManager = new RetryManager(options.retry)
  }

  /**
   * Execute an operation with full error handling: circuit breaker + retry + reporting.
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName = 'operation'
  ): Promise<T> {
    const service = this.options.service ?? operationName
    const breaker = getCircuitBreaker(service, this.options.circuitBreaker)

    return breaker.execute(() =>
      this.retryManager.executeWithRetry(operation, {
        ...this.options.retry,
        onRetry: (attempt, error) => {
          logger.warn(`Retrying ${operationName} (attempt ${attempt})`, {
            error: error instanceof Error ? error.message : String(error),
          })
        },
      })
    )
  }

  /**
   * Classify and enrich an error with user-friendly details.
   */
  handle(error: unknown, context?: Record<string, unknown>): HandledError {
    const category = this.categorize(error)
    const severity = this.getSeverity(error, category)
    const message = this.extractMessage(error)
    const userFriendlyMessage = getErrorMessage(category)
    const isRetryable = this.isRetryable(error, category)

    const handled: HandledError = {
      category,
      severity,
      message,
      userFriendlyMessage,
      isRetryable,
      originalError: error,
      timestamp: new Date().toISOString(),
    }

    logger.error(`[${category}] ${message}`, { ...this.options.context, ...context }, error instanceof Error ? error : undefined)
    reportError(error instanceof Error ? error : new Error(message), handled as unknown as Record<string, unknown>)

    return handled
  }

  private categorize(error: unknown): string {
    if (!(error instanceof Error)) return 'unknown'
    const msg = error.message.toLowerCase()
    const status = (error as any)?.response?.status ?? (error as any)?.status

    if (status === 401) return 'authentication'
    if (status === 403) return 'permission'
    if (status === 429) return 'rate_limit'
    if (status >= 500) return 'network'
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('cors')) return 'network'
    if (msg.includes('timeout')) return 'timeout'
    if (msg.includes('invalid') || msg.includes('validation')) return 'validation'
    if (msg.includes('stellar') || msg.includes('horizon') || msg.includes('soroban')) return 'stellar'
    return 'unknown'
  }

  private getSeverity(error: unknown, category: string): HandledError['severity'] {
    const criticalCategories = ['authentication', 'permission']
    const highCategories = ['network', 'stellar']
    if (criticalCategories.includes(category)) return 'critical'
    if (highCategories.includes(category)) return 'high'
    if (category === 'rate_limit') return 'medium'
    return 'low'
  }

  private extractMessage(error: unknown): string {
    if (typeof error === 'string') return error
    if (error instanceof Error) {
      // Check for Stellar result codes
      const codes = (error as any)?.response?.data?.extras?.result_codes
      if (codes?.transaction) return getStellarErrorMessage(codes.transaction)
      return error.message
    }
    return 'An unexpected error occurred'
  }

  private isRetryable(error: unknown, category: string): boolean {
    const retryableCategories = ['network', 'rate_limit', 'timeout', 'unknown']
    return retryableCategories.includes(category)
  }
}

// Default singleton
export const errorHandler = new ErrorHandler()
