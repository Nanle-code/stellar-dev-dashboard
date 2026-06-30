import { reportError } from '../lib/errorReporting';
import { ErrorDetails } from '../types/error';

/**
 * Error categories for better error handling and user experience
 */
export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  STELLAR: 'stellar',
  AUTHENTICATION: 'authentication',
  PERMISSION: 'permission',
  RATE_LIMIT: 'rate_limit',
  UNKNOWN: 'unknown'
} as const;

export type ErrorCategory = typeof ERROR_CATEGORIES[keyof typeof ERROR_CATEGORIES];

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export type ErrorSeverity = typeof ERROR_SEVERITY[keyof typeof ERROR_SEVERITY];

interface StellarErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
}

/**
 * Stellar-specific error patterns
 */
const STELLAR_ERROR_PATTERNS: Record<string, StellarErrorClassification> = {
  'account not found': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
  'invalid public key': { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.LOW },
  'insufficient balance': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
  'transaction failed': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.HIGH },
  'horizon server': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.HIGH },
  'soroban rpc': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.HIGH },
  'rate limit': { category: ERROR_CATEGORIES.RATE_LIMIT, severity: ERROR_SEVERITY.MEDIUM },
  'unauthorized': { category: ERROR_CATEGORIES.AUTHENTICATION, severity: ERROR_SEVERITY.HIGH },
  'forbidden': { category: ERROR_CATEGORIES.PERMISSION, severity: ERROR_SEVERITY.HIGH },
};

/**
 * Network error patterns
 */
const NETWORK_ERROR_PATTERNS: Record<string, StellarErrorClassification> = {
  'network error': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.HIGH },
  'timeout': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.MEDIUM },
  'connection refused': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.HIGH },
  'dns': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.HIGH },
  'cors': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.HIGH },
};

interface ResponseError extends Error {
  code?: string | number;
  response?: {
    status?: number;
    data?: {
      message?: string;
      detail?: string;
      extras?: {
        result_codes?: {
          transaction?: string;
          operations?: string[];
        };
      };
    };
  };
}

/**
 * Enhanced error categorization and analysis
 */
export const categorizeError = (error: unknown): StellarErrorClassification => {
  const errorMessage = formatErrorMessage(error).toLowerCase();
  const err = error as ResponseError | null | undefined;
  const errorCode = err?.code || err?.response?.status;
  
  // Check HTTP status codes first
  if (typeof errorCode === 'number') {
    if (errorCode >= 400 && errorCode < 500) {
      if (errorCode === 401) return { category: ERROR_CATEGORIES.AUTHENTICATION, severity: ERROR_SEVERITY.HIGH };
      if (errorCode === 403) return { category: ERROR_CATEGORIES.PERMISSION, severity: ERROR_SEVERITY.HIGH };
      if (errorCode === 404) return { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM };
      if (errorCode === 429) return { category: ERROR_CATEGORIES.RATE_LIMIT, severity: ERROR_SEVERITY.MEDIUM };
      return { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.LOW };
    }
    if (errorCode >= 500) {
      return { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.HIGH };
    }
  }

  // Check Stellar-specific patterns
  for (const [pattern, classification] of Object.entries(STELLAR_ERROR_PATTERNS)) {
    if (errorMessage.includes(pattern)) {
      return classification;
    }
  }

  // Check network patterns
  for (const [pattern, classification] of Object.entries(NETWORK_ERROR_PATTERNS)) {
    if (errorMessage.includes(pattern)) {
      return classification;
    }
  }

  // Default classification
  return { category: ERROR_CATEGORIES.UNKNOWN, severity: ERROR_SEVERITY.MEDIUM };
};

export interface UserFriendlyErrorMessage {
  title: string;
  message: string;
  action: string;
}

/**
 * Get user-friendly error messages based on category
 */
export const getUserFriendlyMessage = (error: unknown, category: ErrorCategory): UserFriendlyErrorMessage => {
  const messages: Record<ErrorCategory, UserFriendlyErrorMessage> = {
    [ERROR_CATEGORIES.NETWORK]: {
      title: 'Connection Problem',
      message: 'Unable to connect to Stellar network. Please check your internet connection and try again.',
      action: 'Retry Connection'
    },
    [ERROR_CATEGORIES.VALIDATION]: {
      title: 'Invalid Input',
      message: 'The information you entered is not valid. Please check and try again.',
      action: 'Fix Input'
    },
    [ERROR_CATEGORIES.STELLAR]: {
      title: 'Stellar Network Error',
      message: 'There was an issue with the Stellar network operation. This might be temporary.',
      action: 'Try Again'
    },
    [ERROR_CATEGORIES.AUTHENTICATION]: {
      title: 'Authentication Required',
      message: 'You need to authenticate to perform this action.',
      action: 'Sign In'
    },
    [ERROR_CATEGORIES.PERMISSION]: {
      title: 'Permission Denied',
      message: "You don't have permission to perform this action.",
      action: 'Contact Support'
    },
    [ERROR_CATEGORIES.RATE_LIMIT]: {
      title: 'Too Many Requests',
      message: "You're making requests too quickly. Please wait a moment and try again.",
      action: 'Wait and Retry'
    },
    [ERROR_CATEGORIES.UNKNOWN]: {
      title: 'Unexpected Error',
      message: 'Something unexpected happened. Our team has been notified.',
      action: 'Try Again'
    }
  };

  return messages[category] || messages[ERROR_CATEGORIES.UNKNOWN];
};

export interface HelpLink {
  label: string;
  url: string;
}

/**
 * Get contextual help links based on error category
 */
export const getHelpLinks = (category: ErrorCategory): HelpLink[] => {
  const helpLinks: Record<ErrorCategory, HelpLink[]> = {
    [ERROR_CATEGORIES.NETWORK]: [
      { label: 'Network Status', url: 'https://status.stellar.org/' },
      { label: 'Connection Troubleshooting', url: 'https://developers.stellar.org/docs/troubleshooting' }
    ],
    [ERROR_CATEGORIES.VALIDATION]: [
      { label: 'Public Key Format', url: 'https://developers.stellar.org/docs/encyclopedia/public-key-cryptography' },
      { label: 'Input Validation Guide', url: 'https://developers.stellar.org/docs/building-apps/basic-wallet' }
    ],
    [ERROR_CATEGORIES.STELLAR]: [
      { label: 'Stellar Documentation', url: 'https://developers.stellar.org/docs/' },
      { label: 'Common Issues', url: 'https://developers.stellar.org/docs/troubleshooting' },
      { label: 'Network Status', url: 'https://status.stellar.org/' }
    ],
    [ERROR_CATEGORIES.AUTHENTICATION]: [
      { label: 'Wallet Connection Guide', url: 'https://developers.stellar.org/docs/building-apps/wallet-integration' }
    ],
    [ERROR_CATEGORIES.PERMISSION]: [
      { label: 'Account Permissions', url: 'https://developers.stellar.org/docs/encyclopedia/signatures-multisig' }
    ],
    [ERROR_CATEGORIES.RATE_LIMIT]: [
      { label: 'Rate Limiting Info', url: 'https://developers.stellar.org/docs/data/horizon/api-reference/rate-limiting' }
    ],
    [ERROR_CATEGORIES.UNKNOWN]: [
      { label: 'Get Help', url: 'https://developers.stellar.org/docs/support' },
      { label: 'Community Forum', url: 'https://stellar.stackexchange.com/' }
    ]
  };

  return helpLinks[category] || helpLinks[ERROR_CATEGORIES.UNKNOWN];
};

/**
 * Determine if an error is retryable
 */
export const isRetryableError = (error: unknown, category: ErrorCategory): boolean => {
  const retryableCategories = [
    ERROR_CATEGORIES.NETWORK,
    ERROR_CATEGORIES.RATE_LIMIT,
    ERROR_CATEGORIES.UNKNOWN
  ];

  if (retryableCategories.includes(category)) {
    return true;
  }

  const err = error as ResponseError | null | undefined;
  const errorCode = err?.code || err?.response?.status;
  if (typeof errorCode === 'number' && [408, 429, 500, 502, 503, 504].includes(errorCode)) {
    return true;
  }

  return false;
};

/**
 * Get retry delay based on attempt number and error type
 */
export const getRetryDelay = (attemptNumber: number, category: ErrorCategory): number => {
  const baseDelays: Record<string, number> = {
    [ERROR_CATEGORIES.NETWORK]: 1000,
    [ERROR_CATEGORIES.RATE_LIMIT]: 5000,
    [ERROR_CATEGORIES.UNKNOWN]: 2000
  };

  const baseDelay = baseDelays[category] || 1000;
  const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay;
  
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
};

/**
 * Enhanced error handler with categorization and retry logic
 */
export const handleGlobalError = (
  error: unknown,
  context = 'Global Handler',
  options: Record<string, unknown> = {}
): ErrorDetails => {
  const errorMessage = formatErrorMessage(error);
  const { category, severity } = categorizeError(error);
  const userFriendlyMessage = getUserFriendlyMessage(error, category);
  const helpLinks = getHelpLinks(category);
  const isRetryable = isRetryableError(error, category);
  
  const errorDetails: ErrorDetails = {
    originalError: error,
    message: errorMessage,
    category,
    severity,
    userFriendlyMessage,
    helpLinks,
    isRetryable,
    context,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    ...options
  };

  console.error(`[${context}] ${errorMessage}`, errorDetails);
  reportError(error, errorDetails as Record<string, unknown>);
  
  return errorDetails;
};

/**
 * Retry mechanism with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  context = 'Retry'
): Promise<T> => {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const { category } = categorizeError(error);
      
      if (attempt === maxAttempts || !isRetryableError(error, category)) {
        throw error;
      }
      
      const delay = getRetryDelay(attempt, category);
      console.warn(`[${context}] Attempt ${attempt} failed, retrying in ${delay}ms...`, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Normalizes different types of errors into a single user-friendly string.
 */
export const formatErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  const err = error as ResponseError | null | undefined;
  
  // Stellar SDK specific errors
  if (err?.response?.data?.extras?.result_codes) {
    const codes = err.response.data.extras.result_codes;
    return `Transaction failed: ${codes.transaction || codes.operations?.join(', ') || 'Unknown error'}`;
  }
  
  // Horizon API errors
  if (err?.response?.data?.detail) {
    return err.response.data.detail;
  }
  
  // Standard API errors
  if (err?.response?.data?.message) {
    return err.response.data.message;
  }
  
  // Network errors
  if (err?.code === 'NETWORK_ERROR' || err?.message?.includes('Network Error')) {
    return 'Network connection failed. Please check your internet connection.';
  }
  
  // Timeout errors
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  
  // Native JS error
  if (err?.message) {
    return err.message;
  }
  
  return 'An unexpected error occurred. Please try again later.';
};
