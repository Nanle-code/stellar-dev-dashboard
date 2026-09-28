/**
 * React Hook for Form Validation - D-027
 * Integrates FormValidator with React components
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { FormValidator, Validator, AsyncValidator, FormState } from '../lib/validation/validators';

/**
 * Options accepted by the {@link useFormValidation} hook.
 */
export interface UseFormValidationOptions<T extends Record<string, unknown>> {
  onChange?: (state: FormState<T>) => void;
  onValidate?: (field: keyof T, error: string | null) => void;
  autoSave?: boolean;
  autoSaveKey?: string;
}

/**
 * Return value of the {@link useFormValidation} hook.
 */
export interface UseFormValidationReturn<T extends Record<string, unknown>> {
  state: FormState<T>;
  addValidator: (field: keyof T, validator: Validator) => void;
  addAsyncValidator: (field: keyof T, validator: AsyncValidator) => void;
  setFieldValue: (field: keyof T, value: unknown) => void;
  setFieldTouched: (field: keyof T, touched: boolean) => void;
  validateField: (field: keyof T) => Promise<void>;
  validateForm: () => Promise<boolean>;
  reset: () => void;
  setSubmitting: (isSubmitting: boolean) => void;
}

export function useFormValidation<T extends Record<string, unknown>>(
  initialValues: T,
  options?: UseFormValidationOptions<T>
): UseFormValidationReturn<T> {
  const [state, setState] = useState<FormState<T>>({
    values: { ...initialValues },
    errors: {} as Record<keyof T, string | null>,
    touched: {} as Record<keyof T, boolean>,
    dirty: {} as Record<keyof T, boolean>,
    valid: true,
    isSubmitting: false,
  });

  const validatorRef = useRef<FormValidator<T> | null>(null);

  useEffect(() => {
    validatorRef.current = new FormValidator<T>(
      initialValues,
      (newState) => {
        setState(newState);
        options?.onChange?.(newState);
      },
      options?.onValidate
    );

    // Load auto-saved data if enabled
    if (options?.autoSave && options?.autoSaveKey) {
      const saved = localStorage.getItem(options.autoSaveKey);
      if (saved) {
        try {
          const savedData = JSON.parse(saved);
          Object.entries(savedData).forEach(([key, value]) => {
            validatorRef.current?.setFieldValue(key as keyof T, value);
          });
        } catch (e) {
          console.error('Failed to load auto-saved form data:', e);
        }
      }
    }

    return () => {
      validatorRef.current = null;
    };
  }, [initialValues, options]);

  // Auto-save on change
  useEffect(() => {
    if (options?.autoSave && options?.autoSaveKey && state.dirty) {
      localStorage.setItem(options.autoSaveKey, JSON.stringify(state.values));
    }
  }, [state.values, state.dirty, options]);

  const addValidator = useCallback((field: keyof T, validator: Validator): void => {
    validatorRef.current?.addValidator(field, validator);
  }, []);

  const addAsyncValidator = useCallback((field: keyof T, validator: AsyncValidator): void => {
    validatorRef.current?.addAsyncValidator(field, validator);
  }, []);

  const setFieldValue = useCallback((field: keyof T, value: unknown): void => {
    validatorRef.current?.setFieldValue(field, value);
  }, []);

  const setFieldTouched = useCallback((field: keyof T, touched: boolean): void => {
    validatorRef.current?.setFieldTouched(field, touched);
  }, []);

  const validateField = useCallback(async (field: keyof T): Promise<void> => {
    await validatorRef.current?.validateField(field);
  }, []);

  const validateForm = useCallback(async (): Promise<boolean> => {
    return await validatorRef.current?.validateForm() ?? false;
  }, []);

  const reset = useCallback((): void => {
    validatorRef.current?.reset();
    if (options?.autoSave && options?.autoSaveKey) {
      localStorage.removeItem(options.autoSaveKey);
    }
  }, [options]);

  const setSubmitting = useCallback((isSubmitting: boolean): void => {
    setState(prev => ({ ...prev, isSubmitting }));
  }, []);

  return {
    state,
    addValidator,
    addAsyncValidator,
    setFieldValue,
    setFieldTouched,
    validateField,
    validateForm,
    reset,
    setSubmitting,
  };
}

// Hook for debounced validation
export function useDebouncedValidation<T extends Record<string, unknown>>(
  validate: (field: keyof T) => Promise<void>,
  delay: number = 300
): (field: keyof T) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedValidate = useCallback(
    (field: keyof T): void => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        validate(field);
      }, delay);
    },
    [validate, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedValidate;
}
