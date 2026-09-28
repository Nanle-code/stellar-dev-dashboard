/**
 * Horizon API Retry, Timeout, and Backoff Policy (#746)
 *
 * Centralized retry logic, timeouts, and error handling for Horizon API calls.
 * Provides consistent behavior across the codebase with configurable policies.
 *
 * Features:
 * - Bounded retry mechanisms with exponential backoff
 * - Explicit timeout configurations
 * - Actionable error messages
 * - Graceful handling of invalid inputs
 * - Multi-environment support with fallbacks
 */

import * as StellarSdk from '@stellar/stellar-sdk';

// ─── Configuration ────────────────────────────────────────────────────────────

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter: boolean;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs: number;
}

export interface HorizonConfig {
  /** Primary Horizon server URL */
  primaryUrl: string;
  /** Fallback Horizon server URLs */
  fallbackUrls: string[];
  /** Network passphrase */
  networkPassphrase: string;
  /** Retry configuration */
  retry: RetryConfig;
}

// Default configurations for different environments
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  timeoutMs: 30000,
};

const ENVIRONMENT_CONFIGS: Record<string, HorizonConfig> = {
  mainnet: {
    primaryUrl: 'https://horizon.stellar.org',
    fallbackUrls: [
      'https://horizon.stellar.lobstr.co',
      'https://horizon.stellar.coinqvest.com',
    ],
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    retry: { ...DEFAULT_RETRY_CONFIG },
  },
  testnet: {
    primaryUrl: 'https://horizon-testnet.stellar.org',
    fallbackUrls: [],
    networkPassphrase: StellarSdk.Networks.TESTNET,
    retry: { ...DEFAULT_RETRY_CONFIG, maxRetries: 5 },
  },
  futurenet: {
    primaryUrl: 'https://horizon-futurenet.stellar.org',
    fallbackUrls: [],
    networkPassphrase: StellarSdk.Networks.FUTURENET,
    retry: { ...DEFAULT_RETRY_CONFIG, maxRetries: 5 },
  },
};

// ─── Error Types ──────────────────────────────────────────────────────────────

export class HorizonError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'HorizonError';
  }
}

export class HorizonTimeoutError extends HorizonError {
  constructor(timeoutMs: number, originalError?: Error) {
    super(
      `Horizon request timed out after ${timeoutMs}ms. The Stellar network may be experiencing high load. Please try again.`,
      'TIMEOUT',
      undefined,
      true,
      originalError
    );
    this.name = 'HorizonTimeoutError';
  }
}

export class HorizonNetworkError extends HorizonError {
  constructor(message: string, originalError?: Error) {
    super(
      `Network error connecting to Horizon: ${message}. Check your internet connection and try again.`,
      'NETWORK_ERROR',
      undefined,
      true,
      originalError
    );
    this.name = 'HorizonNetworkError';
  }
}

export class HorizonRateLimitError extends HorizonError {
  constructor(retryAfterMs?: number, originalError?: Error) {
    const retryMsg = retryAfterMs
      ? ` Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before retrying.`
      : ' Please wait a moment before retrying.';
    super(
      `Horizon rate limit exceeded.${retryMsg}`,
      'RATE_LIMITED',
      429,
      true,
      originalError
    );
    this.name = 'HorizonRateLimitError';
  }
}

export class HorizonNotFoundError extends HorizonError {
  constructor(resource: string, identifier: string, originalError?: Error) {
    super(
      `${resource} not found: ${identifier}. Verify the ${resource.toLowerCase()} exists and the identifier is correct.`,
      'NOT_FOUND',
      404,
      false,
      originalError
    );
    this.name = 'HorizonNotFoundError';
  }
}

export class HorizonValidationError extends HorizonError {
  constructor(message: string, originalError?: Error) {
    super(
      `Invalid request: ${message}`,
      'VALIDATION_ERROR',
      400,
      false,
      originalError
    );
    this.name = 'HorizonValidationError';
  }
}

// ─── Retry Logic ──────────────────────────────────────────────────────────────

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  if (config.jitter) {
    // Add random jitter between 0.5x and 1.5x the delay
    const jitterMultiplier = 0.5 + Math.random();
    return Math.floor(cappedDelay * jitterMultiplier);
  }

  return cappedDelay;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof HorizonError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network-related errors are generally retryable
    if (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('socket hang up') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('504')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Parse Horizon API error response
 */
function parseHorizonError(error: unknown): HorizonError {
  if (error instanceof HorizonError) {
    return error;
  }

  if (error instanceof Error) {
    const anyError = error as { response?: { status?: number; data?: { detail?: string; extras?: { result_codes?: unknown } } } };

    if (anyError.response) {
      const { status, data } = anyError.response;

      if (status === 404) {
        return new HorizonNotFoundError('Resource', 'unknown', error);
      }

      if (status === 429) {
        return new HorizonRateLimitError(undefined, error);
      }

      if (status === 400) {
        const detail = data?.detail || error.message;
        return new HorizonValidationError(detail, error);
      }

      if (status && status >= 500) {
        return new HorizonNetworkError(`Server error (${status})`, error);
      }
    }

    if (error.message.includes('timeout')) {
      return new HorizonTimeoutError(30000, error);
    }

    return new HorizonNetworkError(error.message, error);
  }

  return new HorizonError(
    'An unexpected error occurred while communicating with Horizon.',
    'UNKNOWN_ERROR',
    undefined,
    false
  );
}

// ─── Main Retry Function ──────────────────────────────────────────────────────

export interface RetryOptions {
  /** Custom retry configuration (uses defaults if not provided) */
  config?: Partial<RetryConfig>;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: HorizonError, delayMs: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Execute a Horizon API call with retry logic, timeout, and error handling
 *
 * @param operation - Async function that makes the Horizon API call
 * @param options - Retry options
 * @returns Result of the operation
 * @throws HorizonError with actionable message on failure
 *
 * @example
 * ```typescript
 * const account = await withHorizonRetry(
 *   () => server.loadAccount(publicKey),
 *   { onRetry: (attempt, err) => console.log(`Retry ${attempt}: ${err.message}`) }
 * );
 * ```
 */
export async function withHorizonRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...options.config,
  };

  let lastError: HorizonError | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    // Check for abort signal
    if (options.signal?.aborted) {
      throw new HorizonError(
        'Operation was cancelled.',
        'CANCELLED',
        undefined,
        false
      );
    }

    try {
      // Wrap operation with timeout
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new HorizonTimeoutError(config.timeoutMs)),
            config.timeoutMs
          )
        ),
      ]);

      return result;
    } catch (error) {
      lastError = parseHorizonError(error);

      // Don't retry non-retryable errors
      if (!isRetryableError(lastError)) {
        throw lastError;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= config.maxRetries) {
        break;
      }

      // Calculate delay and wait
      const delayMs = calculateDelay(attempt, config);

      if (options.onRetry) {
        options.onRetry(attempt + 1, lastError, delayMs);
      }

      await sleep(delayMs);
    }
  }

  // All retries exhausted
  throw new HorizonError(
    `Failed after ${config.maxRetries} retries. Last error: ${lastError?.message || 'Unknown error'}`,
    'MAX_RETRIES_EXCEEDED',
    undefined,
    false,
    lastError
  );
}

// ─── Horizon Client Factory ───────────────────────────────────────────────────

/**
 * Create a Horizon server client with retry capabilities
 */
export function createHorizonClient(
  environment: 'mainnet' | 'testnet' | 'futurenet' = 'mainnet',
  customConfig?: Partial<HorizonConfig>
): {
  server: StellarSdk.Horizon.Server;
  config: HorizonConfig;
  withRetry: <T>(operation: () => Promise<T>, options?: RetryOptions) => Promise<T>;
} {
  const envConfig = ENVIRONMENT_CONFIGS[environment];
  const config: HorizonConfig = {
    ...envConfig,
    ...customConfig,
    retry: {
      ...envConfig.retry,
      ...customConfig?.retry,
    },
  };

  const server = new StellarSdk.Horizon.Server(config.primaryUrl);

  return {
    server,
    config,
    withRetry: <T>(operation: () => Promise<T>, options?: RetryOptions) =>
      withHorizonRetry(operation, {
        ...options,
        config: { ...config.retry, ...options?.config },
      }),
  };
}

// ─── Convenience Functions ────────────────────────────────────────────────────

/**
 * Load an account with retry logic
 */
export async function loadAccountWithRetry(
  server: StellarSdk.Horizon.Server,
  accountId: string,
  options?: RetryOptions
): Promise<StellarSdk.Horizon.AccountResponse> {
  // Validate input
  if (!accountId || typeof accountId !== 'string') {
    throw new HorizonValidationError('Account ID is required and must be a string.');
  }

  if (!accountId.startsWith('G') || accountId.length !== 56) {
    throw new HorizonValidationError(
      'Invalid Stellar account ID format. Account IDs should start with "G" and be 56 characters long.'
    );
  }

  try {
    return await withHorizonRetry(() => server.loadAccount(accountId), options);
  } catch (error) {
    if (error instanceof HorizonError && error.code === 'NOT_FOUND') {
      throw new HorizonNotFoundError('Account', accountId, error.originalError);
    }
    throw error;
  }
}

/**
 * Submit a transaction with retry logic
 */
export async function submitTransactionWithRetry(
  server: StellarSdk.Horizon.Server,
  transaction: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction,
  options?: RetryOptions
): Promise<StellarSdk.Horizon.HorizonApi.SubmitTransactionResponse> {
  if (!transaction) {
    throw new HorizonValidationError('Transaction is required.');
  }

  // Use shorter timeout for submissions but allow retries for network issues
  const submitOptions: RetryOptions = {
    ...options,
    config: {
      ...options?.config,
      timeoutMs: options?.config?.timeoutMs ?? 60000, // 60s timeout for submissions
      maxRetries: options?.config?.maxRetries ?? 2, // Fewer retries for submissions
    },
  };

  return withHorizonRetry(() => server.submitTransaction(transaction), submitOptions);
}

/**
 * Get current configuration for an environment
 */
export function getEnvironmentConfig(
  environment: 'mainnet' | 'testnet' | 'futurenet'
): HorizonConfig {
  return { ...ENVIRONMENT_CONFIGS[environment] };
}

/**
 * Update default retry configuration
 */
export function updateDefaultRetryConfig(
  updates: Partial<RetryConfig>
): RetryConfig {
  Object.assign(DEFAULT_RETRY_CONFIG, updates);
  return { ...DEFAULT_RETRY_CONFIG };
}

export { DEFAULT_RETRY_CONFIG, ENVIRONMENT_CONFIGS };
