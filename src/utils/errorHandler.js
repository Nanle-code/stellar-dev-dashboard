import { reportError } from '../lib/errorReporting';

/**
 * Handle API or generic errors, format them, and send to the reporting service.
 */
export const handleGlobalError = (error, context = 'Global Handler') => {
  const errorMessage = formatErrorMessage(error);
  
  console.error(`[${context}] ${errorMessage}`, error);
  
  // Send to our mock reporting service
  reportError(error, { context });
  
  return errorMessage;
};

/**
 * Normalizes different Types of errors (Axios, Fetch, native Error, strings)
 * into a single user-friendly string.
 */
export const formatErrorMessage = (error) => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.response?.data?.message) {
    // Typical API Error format
    return error.response.data.message;
  }
  
  if (error?.message) {
    // Native JS error
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again later.';
};
