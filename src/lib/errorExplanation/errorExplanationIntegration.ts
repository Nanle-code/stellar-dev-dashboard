/**
 * Error Explanation Integration Layer
 * Integrates the AI-powered error explanation system with existing error handling
 */

import React from 'react';
import { categorizeError, formatErrorMessage, type ErrorCategory } from '../../utils/errorHandler';
import { getErrorExplanation, searchErrorExplanations, ErrorExplanation, getAllErrorCodes as getAllErrorCodesFromDB } from './errorDatabase';
import { getSuggestionEngine, explainError, ErrorContext, SuggestionResult, UserFeedback } from './mlSuggestionEngine';

interface ResponseError {
  response?: {
    status?: number;
    data?: {
      extras?: {
        result_codes?: {
          transaction?: string;
          operations?: string[];
        };
      };
    };
  };
  code?: string | number;
}

export interface EnhancedErrorDetails {
  originalError: unknown;
  errorMessage: string;
  category: ErrorCategory;
  explanation: ErrorExplanation | null;
  suggestionResult: SuggestionResult | null;
  context: ErrorContext;
  timestamp: string;
}

export interface ErrorExplanationOptions {
  component?: string;
  operation?: string;
  userAction?: string;
  accountState?: {
    balance: number;
    sequenceNumber: number;
    subentries: number;
  };
  networkState?: {
    isOnline: boolean;
    latency: number;
  };
  previousErrors?: string[];
}

/**
 * Enhanced error handler with AI-powered explanations
 */
export async function explainErrorWithAI(
  error: unknown,
  options: ErrorExplanationOptions = {}
): Promise<EnhancedErrorDetails> {
  const errorMessage = formatErrorMessage(error);
  const { category } = categorizeError(error);
  
  // Extract error code from error
  const errorCode = extractErrorCode(error, errorMessage);
  
  // Build error context
  const context: ErrorContext = {
    errorCode,
    operation: options.operation || 'unknown',
    component: options.component || 'global',
    userAction: options.userAction || 'unknown',
    timestamp: Date.now(),
    previousErrors: options.previousErrors || [],
    accountState: options.accountState,
    networkState: options.networkState || {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      latency: 0
    }
  };
  
  // Get base explanation from database
  const explanation = getErrorExplanation(errorCode) || 
    getErrorExplanation(errorMessage.toLowerCase()) ||
    getErrorExplanation(category);
  
  // Get ML-enhanced suggestions
  let suggestionResult: SuggestionResult | null = null;
  try {
    suggestionResult = await explainError(context);
  } catch (mlError) {
    console.warn('ML suggestion engine failed, using fallback:', mlError);
  }
  
  return {
    originalError: error,
    errorMessage,
    category,
    explanation,
    suggestionResult,
    context,
    timestamp: new Date().toISOString()
  };
}

/**
 * Extract error code from various error formats
 */
function extractErrorCode(error: unknown, errorMessage: string): string {
  const err = error as ResponseError | null | undefined;
  
  // Check for Stellar result codes
  if (err?.response?.data?.extras?.result_codes?.transaction) {
    return String(err.response.data.extras.result_codes.transaction);
  }
  
  if (err?.response?.data?.extras?.result_codes?.operations) {
    const ops = err.response.data.extras.result_codes.operations as string[];
    return ops[0] || 'unknown';
  }
  
  // Check for HTTP status code
  if (err?.response?.status) {
    return String(err.response.status);
  }
  
  if (err?.code) {
    return String(err.code);
  }
  
  // Check for known error patterns in message
  const patterns = [
    'tx_success', 'tx_failed', 'tx_too_early', 'tx_too_late', 'tx_bad_seq',
    'tx_bad_auth', 'tx_insufficient_balance', 'tx_insufficient_fee', 'tx_no_account',
    'op_success', 'op_no_destination', 'op_no_trust', 'op_underfunded',
    'op_low_reserve', 'op_src_not_authorized', 'op_line_full', 'op_no_issuer',
    'account not found', 'invalid public key', 'insufficient balance',
    'network error', 'timeout', 'rate limit', 'unauthorized', 'forbidden'
  ];
  
  const lowerMessage = errorMessage.toLowerCase();
  for (const pattern of patterns) {
    if (lowerMessage.includes(pattern)) {
      return pattern;
    }
  }
  
  return 'unknown';
}

/**
 * Get quick error explanation (without ML)
 */
export function getQuickExplanation(error: unknown): {
  title: string;
  message: string;
  suggestions: string[];
  severity: string;
} {
  const errorMessage = formatErrorMessage(error);
  const { category } = categorizeError(error);
  const errorCode = extractErrorCode(error, errorMessage);
  
  const explanation = getErrorExplanation(errorCode) || 
    getErrorExplanation(errorMessage.toLowerCase());
  
  if (explanation) {
    return {
      title: explanation.title,
      message: explanation.plainExplanation,
      suggestions: explanation.suggestedSolutions.slice(0, 3), // Top 3 suggestions
      severity: explanation.severity
    };
  }
  
  // Fallback to category-based messages
  const categoryMessages: Record<ErrorCategory, { title: string; message: string; suggestions: string[] }> = {
    network: {
      title: 'Connection Problem',
      message: 'Unable to connect to the Stellar network.',
      suggestions: ['Check your internet connection', 'Try again in a moment', 'Check Stellar network status']
    },
    validation: {
      title: 'Invalid Input',
      message: 'The information provided is not valid.',
      suggestions: ['Check your input for errors', 'Verify the format', 'Try again with corrected data']
    },
    stellar: {
      title: 'Stellar Network Error',
      message: 'An error occurred with the Stellar network operation.',
      suggestions: ['Check the error details for specific information', 'Try again', 'Contact support if issue persists']
    },
    authentication: {
      title: 'Authentication Required',
      message: 'You need to authenticate to perform this action.',
      suggestions: ['Connect your wallet', 'Sign in to your account', 'Refresh your session']
    },
    permission: {
      title: 'Permission Denied',
      message: 'You do not have permission to perform this action.',
      suggestions: ['Check your account permissions', 'Contact support', 'Verify your authorizations']
    },
    rate_limit: {
      title: 'Too Many Requests',
      message: 'You are making requests too quickly.',
      suggestions: ['Wait a moment and try again', 'Reduce request frequency', 'Implement rate limiting']
    },
    unknown: {
      title: 'Unexpected Error',
      message: 'An unexpected error occurred.',
      suggestions: ['Try refreshing the page', 'Check your connection', 'Contact support if issue persists']
    }
  };
  
  const fallback = categoryMessages[category] || categoryMessages.unknown;
  
  return {
    title: fallback.title,
    message: fallback.message,
    suggestions: fallback.suggestions,
    severity: 'medium'
  };
}

/**
 * Record user feedback for error explanation
 */
export function recordErrorFeedback(
  errorId: string,
  helpful: boolean,
  rating: number,
  suggestionUsed: string
): void {
  const engine = getSuggestionEngine();
  
  const feedback: UserFeedback = {
    errorId,
    helpful,
    rating,
    suggestionUsed,
    timestamp: Date.now()
  };
  
  engine.recordFeedback(feedback);
}

/**
 * Search for error explanations by keyword
 */
export function searchErrors(keyword: string): ErrorExplanation[] {
  return searchErrorExplanations(keyword);
}

/**
 * Get all error codes in the database
 */
export function getAllErrorCodes(): string[] {
  return getAllErrorCodesFromDB();
}

/**
 * Get error explanation by code (convenience function)
 */
export function getExplanationByCode(code: string): ErrorExplanation | null {
  return getErrorExplanation(code);
}

/**
 * Initialize the error explanation system
 */
export async function initializeErrorExplanation(): Promise<void> {
  const engine = getSuggestionEngine();
  await engine.initialize();
}

/**
 * Get error explanation system statistics
 */
export function getErrorExplanationStats(): {
  isInitialized: boolean;
  feedbackCount: number;
  trackedErrors: number;
  recentSuccessRate: number;
} {
  const engine = getSuggestionEngine();
  return engine.getStats();
}

/**
 * React hook for error explanations (to be used in components)
 */
export interface UseErrorExplanationReturn {
  explainError: (error: unknown, options?: ErrorExplanationOptions) => Promise<EnhancedErrorDetails>;
  getQuickExplanation: (error: unknown) => { title: string; message: string; suggestions: string[]; severity: string };
  recordFeedback: (errorId: string, helpful: boolean, rating: number, suggestionUsed: string) => void;
  searchErrors: (keyword: string) => ErrorExplanation[];
  stats: ReturnType<typeof getErrorExplanationStats>;
  isInitialized: boolean;
}

export function useErrorExplanation(): UseErrorExplanationReturn {
  const [isInitialized, setIsInitialized] = React.useState(false);
  
  React.useEffect(() => {
    initializeErrorExplanation().then(() => {
      setIsInitialized(true);
    });
  }, []);
  
  return {
    explainError: explainErrorWithAI,
    getQuickExplanation,
    recordFeedback: recordErrorFeedback,
    searchErrors,
    stats: getErrorExplanationStats(),
    isInitialized
  };
}
