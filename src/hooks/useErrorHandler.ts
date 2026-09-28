import { useState, useCallback } from 'react';
import { handleGlobalError, retryWithBackoff } from '../utils/errorHandler';
import type { ErrorDetails } from '../types/error';
import { addBreadcrumb } from '../lib/errorReporting';

/**
 * Context metadata attached to handled errors.
 */
export type ErrorContext = Record<string, unknown>;

/**
 * An async operation that can be retried or wrapped with error handling.
 */
export type RetryableOperation<T = unknown> = () => Promise<T>;

/**
 * Return value of the {@link useErrorHandler} hook.
 */
export interface UseErrorHandlerReturn {
  error: ErrorDetails | null;
  isRetrying: boolean;
  retryCount: number;
  handleError: (error: unknown, additionalContext?: ErrorContext) => ErrorDetails;
  clearError: () => void;
  retryOperation: <T>(operation: RetryableOperation<T> | null | undefined, maxAttempts?: number) => Promise<T | undefined>;
  withErrorHandling: <TArgs extends unknown[], T>(asyncOperation: (...args: TArgs) => Promise<T>) => (...args: TArgs) => Promise<T>;
  hasError: boolean;
}

/**
 * Custom hook for handling errors in components
 */
export function useErrorHandler(context = 'Component'): UseErrorHandlerReturn {
  const [error, setError] = useState<ErrorDetails | null>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  const handleError = useCallback((error: unknown, additionalContext: ErrorContext = {}): ErrorDetails => {
    const errorDetails = handleGlobalError(error, context, additionalContext);
    setError(errorDetails);
    return errorDetails;
  }, [context]);

  const clearError = useCallback((): void => {
    setError(null);
    setRetryCount(0);
  }, []);

  const retryOperation = useCallback(async <T>(operation: RetryableOperation<T> | null | undefined, maxAttempts = 3): Promise<T | undefined> => {
    if (!operation) return undefined;

    setIsRetrying(true);
    
    try {
      const result = await retryWithBackoff(operation, maxAttempts, context);
      clearError();
      addBreadcrumb(`Retry successful in ${context}`, 'success');
      return result;
    } catch (retryError) {
      const errorDetails = handleError(retryError, { 
        isRetry: true, 
        originalError: error?.originalError 
      });
      setRetryCount(prev => prev + 1);
      throw retryError;
    } finally {
      setIsRetrying(false);
    }
  }, [context, error, handleError, clearError]);

  const withErrorHandling = useCallback(<TArgs extends unknown[], T>(asyncOperation: (...args: TArgs) => Promise<T>) => {
    return async (...args: TArgs): Promise<T> => {
      try {
        clearError();
        const result = await asyncOperation(...args);
        addBreadcrumb(`Operation successful in ${context}`, 'info');
        return result;
      } catch (error) {
        handleError(error);
        throw error;
      }
    };
  }, [context, handleError, clearError]);

  return {
    error,
    isRetrying,
    retryCount,
    handleError,
    clearError,
    retryOperation,
    withErrorHandling,
    hasError: !!error
  };
}

/**
 * Hook for handling async operations with automatic error handling
 */
export interface UseAsyncOperationReturn<T = unknown> {
  data: T | null;
  loading: boolean;
  error: ErrorDetails | null;
  execute: (...args: unknown[]) => Promise<T>;
  retry: (...args: unknown[]) => Promise<T | undefined>;
  clearError: () => void;
}

export function useAsyncOperation<T = unknown>(
  operation: (...args: unknown[]) => Promise<T>,
  dependencies: unknown[] = []
): UseAsyncOperationReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { error, handleError, clearError, retryOperation } = useErrorHandler('AsyncOperation');

  const execute = useCallback(async (...args: unknown[]): Promise<T> => {
    setLoading(true);
    clearError();
    
    try {
      const result = await operation(...args);
      setData(result);
      return result;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [operation, handleError, clearError, ...dependencies]);

  const retry = useCallback(async (...args: unknown[]): Promise<T | undefined> => {
    return retryOperation(() => execute(...args));
  }, [retryOperation, execute]);

  return {
    data,
    loading,
    error,
    execute,
    retry,
    clearError
  };
}

/**
 * A single field validation rule.
 */
export interface ErrorHandlerValidationRule {
  required?: boolean | string;
  pattern?: RegExp;
  patternMessage?: string;
  minLength?: number;
  maxLength?: number;
  custom?: (value: unknown, values: Record<string, unknown>) => string | null | undefined;
}

/**
 * Validation rules keyed by field name.
 */
export type ErrorHandlerValidationRules = Record<string, ErrorHandlerValidationRule>;

/**
 * Return value of the {@link useFormValidation} hook.
 */
export interface UseErrorHandlerFormValidationReturn {
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  validate: (values: Record<string, unknown>) => boolean;
  setFieldTouched: (field: string, isTouched?: boolean) => void;
  setFieldError: (field: string, error: string) => void;
  clearFieldError: (field: string) => void;
  clearAllErrors: () => void;
  getFieldError: (field: string) => string | null;
  hasErrors: boolean;
  hasFieldError: (field: string) => boolean;
}

export function useFormValidation(validationRules: ErrorHandlerValidationRules = {}): UseErrorHandlerFormValidationReturn {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { handleError } = useErrorHandler('FormValidation');

  const validate = useCallback((values: Record<string, unknown>): boolean => {
    const newErrors: Record<string, string> = {};
    
    Object.keys(validationRules).forEach(field => {
      const rules = validationRules[field];
      const value = values[field];
      
      if (rules.required && (!value || value.toString().trim() === '')) {
        newErrors[field] = rules.required === true ? 'This field is required' : rules.required;
      } else if (value && rules.pattern && !rules.pattern.test(value)) {
        newErrors[field] = rules.patternMessage || 'Invalid format';
      } else if (value && rules.minLength && value.length < rules.minLength) {
        newErrors[field] = `Minimum length is ${rules.minLength}`;
      } else if (value && rules.maxLength && value.length > rules.maxLength) {
        newErrors[field] = `Maximum length is ${rules.maxLength}`;
      } else if (rules.custom) {
        try {
          const customError = rules.custom(value, values);
          if (customError) {
            newErrors[field] = customError;
          }
        } catch (error) {
          handleError(error, { field, value });
          newErrors[field] = 'Validation error occurred';
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [validationRules, handleError]);

  const setFieldTouched = useCallback((field: string, isTouched = true): void => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  const setFieldError = useCallback((field: string, error: string): void => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const clearFieldError = useCallback((field: string): void => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback((): void => {
    setErrors({});
    setTouched({});
  }, []);

  const getFieldError = useCallback((field: string): string | null => {
    return touched[field] ? errors[field] : null;
  }, [errors, touched]);

  return {
    errors,
    touched,
    validate,
    setFieldTouched,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    getFieldError,
    hasErrors: Object.keys(errors).length > 0,
    hasFieldError: (field: string): boolean => !!getFieldError(field)
  };
}