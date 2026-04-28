/**
 * Centralized error types and handlers for production debugging
 */

import { createLogger } from '../utils/logger'

const logger = createLogger('ErrorHandling')

// ─── Error Types ──────────────────────────────────────────────────────────────

export enum ErrorCategory {
  Network = 'NETWORK',
  Validation = 'VALIDATION',
  Authentication = 'AUTHENTICATION',
  Authorization = 'AUTHORIZATION',
  NotFound = 'NOT_FOUND',
  Conflict = 'CONFLICT',
  RateLimit = 'RATE_LIMIT',
  ServerError = 'SERVER_ERROR',
  Timeout = 'TIMEOUT',
  Unknown = 'UNKNOWN',
}

export interface ErrorContext {
  code?: string
  category?: ErrorCategory
  statusCode?: number
  originalError?: Error
  context?: Record<string, any>
  retryable?: boolean
  userMessage?: string
}

export class AppError extends Error {
  category: ErrorCategory
  statusCode?: number
  context: Record<string, any>
  retryable: boolean
  userMessage: string
  originalError?: Error

  constructor(
    message: string,
    errorContext: ErrorContext = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.category = errorContext.category || ErrorCategory.Unknown
    this.statusCode = errorContext.statusCode
    this.context = errorContext.context || {}
    this.retryable = errorContext.retryable ?? true
    this.userMessage = errorContext.userMessage || 'An unexpected error occurred'
    this.originalError = errorContext.originalError

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

// ─── Error Classifiers ────────────────────────────────────────────────────────

export function classifyError(error: unknown): ErrorContext {
  if (error instanceof AppError) {
    return {
      category: error.category,
      statusCode: error.statusCode,
      context: error.context,
      retryable: error.retryable,
    }
  }

  if (error instanceof TypeError) {
    return {
      category: ErrorCategory.Validation,
      userMessage: 'Invalid operation',
      retryable: false,
    }
  }

  if (error instanceof RangeError) {
    return {
      category: ErrorCategory.Validation,
      userMessage: 'Invalid value range',
      retryable: false,
    }
  }

  if (error instanceof SyntaxError) {
    return {
      category: ErrorCategory.Validation,
      userMessage: 'Invalid syntax',
      retryable: false,
    }
  }

  // Check for fetch/network errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('fetch') || msg.includes('network')) {
      return {
        category: ErrorCategory.Network,
        userMessage: 'Network error. Please check your connection.',
        retryable: true,
      }
    }
    if (msg.includes('timeout')) {
      return {
        category: ErrorCategory.Timeout,
        userMessage: 'Request timed out. Please try again.',
        retryable: true,
      }
    }
  }

  return {
    category: ErrorCategory.Unknown,
    userMessage: 'An unexpected error occurred',
    retryable: true,
  }
}

// ─── HTTP Error Handler ────────────────────────────────────────────────────────

export function handleHttpError(status: number, data?: any): ErrorContext {
  const errorContextMap: Record<number, ErrorContext> = {
    400: {
      category: ErrorCategory.Validation,
      retryable: false,
      userMessage: 'Invalid request',
    },
    401: {
      category: ErrorCategory.Authentication,
      retryable: false,
      userMessage: 'Authentication required',
    },
    403: {
      category: ErrorCategory.Authorization,
      retryable: false,
      userMessage: 'Access denied',
    },
    404: {
      category: ErrorCategory.NotFound,
      retryable: false,
      userMessage: 'Not found',
    },
    409: {
      category: ErrorCategory.Conflict,
      retryable: false,
      userMessage: 'Resource conflict',
    },
    429: {
      category: ErrorCategory.RateLimit,
      retryable: true,
      userMessage: 'Too many requests. Please try again later.',
    },
    500: {
      category: ErrorCategory.ServerError,
      retryable: true,
      userMessage: 'Server error. Please try again.',
    },
    502: {
      category: ErrorCategory.ServerError,
      retryable: true,
      userMessage: 'Bad gateway. Please try again.',
    },
    503: {
      category: ErrorCategory.ServerError,
      retryable: true,
      userMessage: 'Service unavailable. Please try again.',
    },
    504: {
      category: ErrorCategory.Timeout,
      retryable: true,
      userMessage: 'Gateway timeout. Please try again.',
    },
  }

  return errorContextMap[status] || {
    category: ErrorCategory.ServerError,
    statusCode: status,
    context: data,
    retryable: status >= 500,
  }
}

// ─── Retry Logic ──────────────────────────────────────────────────────────────

export async function retryWithBackoff(
  fn: () => Promise<any>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<any> {
  let lastError: any

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const context = classifyError(err)

      if (!context.retryable || attempt === maxRetries - 1) {
        throw err
      }

      const delay = baseDelay * Math.pow(2, attempt)
      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
        error: err instanceof Error ? err.message : String(err),
      })

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// ─── Safe execution wrapper ───────────────────────────────────────────────────

export async function safeExecute(
  fn: () => Promise<any>,
  fallback: any = null,
  onError?: (error: unknown) => void
): Promise<any> {
  try {
    return await fn()
  } catch (error) {
    logger.error('Safe execution failed', { error }, error instanceof Error ? error : undefined)
    onError?.(error)
    return fallback
  }
}
