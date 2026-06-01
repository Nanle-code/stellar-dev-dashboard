import { useState, useCallback } from 'react';
import { handleGlobalError, retryWithBackoff } from '../utils/errorHandler';
import { addBreadcrumb } from '../lib/errorReporting';

export interface ErrorDetails {
  originalError: unknown;
  message: string;
  category: string;
  severity: string;
  isRetryable: boolean;
  context: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface UseErrorHandlerReturn {
  error: ErrorDetails | null;
  isRetrying: boolean;
  retryCount: number;
  hasError: boolean;
  handleError: (error: unknown, additionalContext?: Record<string, unknown>) => ErrorDetails;
  clearError: () => void;
  retryOperation: <T>(operation: () => Promise<T>, maxAttempts?: number) => Promise<T>;
  withErrorHandling: <T extends unknown[]>(fn: (...args: T) => Promise<unknown>) => (...args: T) => Promise<unknown>;
}

export function useErrorHandler(context = 'Component'): UseErrorHandlerReturn {
  const [error, setError] = useState<ErrorDetails | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleError = useCallback(
    (err: unknown, additionalContext: Record<string, unknown> = {}) => {
      const errorDetails = handleGlobalError(err, context, additionalContext);
      setError(errorDetails);
      return errorDetails;
    },
    [context],
  );

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  const retryOperation = useCallback(
    async <T,>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> => {
      setIsRetrying(true);
      try {
        const result = await retryWithBackoff(operation, maxAttempts, context);
        clearError();
        addBreadcrumb(`Retry successful in ${context}`, 'success');
        return result;
      } catch (retryError) {
        handleError(retryError, { isRetry: true, originalError: error?.originalError });
        setRetryCount((prev) => prev + 1);
        throw retryError;
      } finally {
        setIsRetrying(false);
      }
    },
    [context, error, handleError, clearError],
  );

  const withErrorHandling = useCallback(
    <T extends unknown[]>(asyncOperation: (...args: T) => Promise<unknown>) =>
      async (...args: T) => {
        try {
          clearError();
          const result = await asyncOperation(...args);
          addBreadcrumb(`Operation successful in ${context}`, 'info');
          return result;
        } catch (err) {
          handleError(err);
          throw err;
        }
      },
    [context, handleError, clearError],
  );

  return { error, isRetrying, retryCount, handleError, clearError, retryOperation, withErrorHandling, hasError: !!error };
}

export interface UseAsyncOperationReturn<T> {
  data: T | null;
  loading: boolean;
  error: ErrorDetails | null;
  execute: (...args: unknown[]) => Promise<T>;
  retry: (...args: unknown[]) => Promise<unknown>;
  clearError: () => void;
}

export function useAsyncOperation<T>(
  operation: (...args: unknown[]) => Promise<T>,
  dependencies: unknown[] = [],
): UseAsyncOperationReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const { error, handleError, clearError, retryOperation } = useErrorHandler('AsyncOperation');

  const execute = useCallback(
    async (...args: unknown[]) => {
      setLoading(true);
      clearError();
      try {
        const result = await operation(...args);
        setData(result);
        return result;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [operation, handleError, clearError, ...dependencies], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const retry = useCallback(
    async (...args: unknown[]) => retryOperation(() => execute(...args)),
    [retryOperation, execute],
  );

  return { data, loading, error, execute, retry, clearError };
}

export interface ValidationRule {
  required?: boolean | string;
  pattern?: RegExp;
  patternMessage?: string;
  minLength?: number;
  maxLength?: number;
  custom?: (value: unknown, values: Record<string, unknown>) => string | null | undefined;
}

export interface UseFormValidationReturn {
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  hasErrors: boolean;
  validate: (values: Record<string, unknown>) => boolean;
  setFieldTouched: (field: string, isTouched?: boolean) => void;
  setFieldError: (field: string, error: string) => void;
  clearFieldError: (field: string) => void;
  clearAllErrors: () => void;
  getFieldError: (field: string) => string | undefined;
  hasFieldError: (field: string) => boolean;
}

export function useFormValidation(
  validationRules: Record<string, ValidationRule> = {},
): UseFormValidationReturn {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { handleError } = useErrorHandler('FormValidation');

  const validate = useCallback(
    (values: Record<string, unknown>) => {
      const newErrors: Record<string, string> = {};

      Object.keys(validationRules).forEach((field) => {
        const rules = validationRules[field];
        const value = values[field];

        if (rules.required && (!value || String(value).trim() === '')) {
          newErrors[field] = rules.required === true ? 'This field is required' : (rules.required as string);
        } else if (value && rules.pattern && !rules.pattern.test(String(value))) {
          newErrors[field] = rules.patternMessage ?? 'Invalid format';
        } else if (value && rules.minLength && String(value).length < rules.minLength) {
          newErrors[field] = `Minimum length is ${rules.minLength}`;
        } else if (value && rules.maxLength && String(value).length > rules.maxLength) {
          newErrors[field] = `Maximum length is ${rules.maxLength}`;
        } else if (rules.custom) {
          try {
            const customError = rules.custom(value, values);
            if (customError) newErrors[field] = customError;
          } catch (err) {
            handleError(err, { field, value });
            newErrors[field] = 'Validation error occurred';
          }
        }
      });

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [validationRules, handleError],
  );

  const setFieldTouched = useCallback((field: string, isTouched = true) => {
    setTouched((prev) => ({ ...prev, [field]: isTouched }));
  }, []);

  const setFieldError = useCallback((field: string, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const getFieldError = useCallback(
    (field: string) => (touched[field] ? errors[field] : undefined),
    [errors, touched],
  );

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
    hasFieldError: (field) => !!getFieldError(field),
  };
}
