import { useState, useCallback } from 'react';
import { handleGlobalError, retryWithBackoff } from '../utils/errorHandler';
import { addBreadcrumb } from '../lib/errorReporting';

/**
 * Custom hook for handling errors in components
 */
export function useErrorHandler(context = 'Component') {
  const [error, setError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleError = useCallback((error, additionalContext = {}) => {
    const errorDetails = handleGlobalError(error, context, additionalContext);
    setError(errorDetails);
    return errorDetails;
  }, [context]);

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  const retryOperation = useCallback(async (operation, maxAttempts = 3) => {
    if (!operation) return;

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

  const withErrorHandling = useCallback((asyncOperation) => {
    return async (...args) => {
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
export function useAsyncOperation(operation, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { error, handleError, clearError, retryOperation } = useErrorHandler('AsyncOperation');

  const execute = useCallback(async (...args) => {
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

  const retry = useCallback(async (...args) => {
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
 * Hook for form validation with error handling
 */
export function useFormValidation(validationRules = {}) {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const { handleError } = useErrorHandler('FormValidation');

  const validate = useCallback((values) => {
    const newErrors = {};
    
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

  const setFieldTouched = useCallback((field, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  const setFieldError = useCallback((field, error) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const clearFieldError = useCallback((field) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const getFieldError = useCallback((field) => {
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
    hasFieldError: (field) => !!getFieldError(field)
  };
}