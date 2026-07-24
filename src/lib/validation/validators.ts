/**
 * Advanced Form Validation System - D-027
 * Composable validators, real-time validation, and accessibility
 */

export interface Validator<T = unknown> {
  (value: T): { valid: boolean; error?: string };
}

export interface FieldValidation<T = unknown> {
  value: T;
  error: string | null;
  touched: boolean;
  dirty: boolean;
  valid: boolean;
}

export interface FormState<T extends Record<string, unknown>> {
  values: T;
  errors: Record<keyof T, string | null>;
  touched: Record<keyof T, boolean>;
  dirty: Record<keyof T, boolean>;
  valid: boolean;
  isSubmitting: boolean;
}

// Basic validators
export const required: Validator = (value) => {
  const isValid = value !== null && value !== undefined && value !== '';
  return {
    valid: isValid,
    error: isValid ? undefined : 'This field is required',
  };
};

export const minLength = (min: number): Validator<string> => (value) => {
  const isValid = value.length >= min;
  return {
    valid: isValid,
    error: isValid ? undefined : `Must be at least ${min} characters`,
  };
};

export const maxLength = (max: number): Validator<string> => (value) => {
  const isValid = value.length <= max;
  return {
    valid: isValid,
    error: isValid ? undefined : `Must be at most ${max} characters`,
  };
};

export const pattern = (regex: RegExp, message: string): Validator<string> => (value) => {
  const isValid = regex.test(value);
  return {
    valid: isValid,
    error: isValid ? undefined : message,
  };
};

export const email: Validator<string> = (value) => {
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return {
    valid: isValid,
    error: isValid ? undefined : 'Invalid email address',
  };
};

export const url: Validator<string> = (value) => {
  const isValid = /^https?:\/\/.+\..+/.test(value);
  return {
    valid: isValid,
    error: isValid ? undefined : 'Invalid URL',
  };
};

export const stellarPublicKey: Validator<string> = (value) => {
  const isValid = /^G[A-Z0-9]{55}$/.test(value);
  return {
    valid: isValid,
    error: isValid ? undefined : 'Invalid Stellar public key',
  };
};

export const stellarSecretKey: Validator<string> = (value) => {
  const isValid = /^S[A-Z0-9]{55}$/.test(value);
  return {
    valid: isValid,
    error: isValid ? undefined : 'Invalid Stellar secret key',
  };
};

export const number: Validator = (value) => {
  const isValid = !isNaN(Number(value));
  return {
    valid: isValid,
    error: isValid ? undefined : 'Must be a number',
  };
};

export const min = (minValue: number): Validator<number | string> => (value) => {
  const num = Number(value);
  const isValid = !isNaN(num) && num >= minValue;
  return {
    valid: isValid,
    error: isValid ? undefined : `Must be at least ${minValue}`,
  };
};

export const max = (maxValue: number): Validator<number | string> => (value) => {
  const num = Number(value);
  const isValid = !isNaN(num) && num <= maxValue;
  return {
    valid: isValid,
    error: isValid ? undefined : `Must be at most ${maxValue}`,
  };
};

export const oneOf = <T extends unknown>(allowedValues: T[]): Validator<T> => (value) => {
  const isValid = allowedValues.includes(value);
  return {
    valid: isValid,
    error: isValid ? undefined : `Must be one of: ${allowedValues.join(', ')}`,
  };
};

// Compose multiple validators
export function compose<T>(...validators: Validator<T>[]): Validator<T> {
  return (value) => {
    for (const validator of validators) {
      const result = validator(value);
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  };
}

// Custom validator factory
export function createValidator<T>(
  validatorFn: (value: T) => boolean,
  errorMessage: string
): Validator<T> {
  return (value) => {
    const isValid = validatorFn(value);
    return {
      valid: isValid,
      error: isValid ? undefined : errorMessage,
    };
  };
}

// Async validator support
export interface AsyncValidator<T = unknown> {
  (value: T): Promise<{ valid: boolean; error?: string }>;
}

export function createAsyncValidator<T>(
  validatorFn: (value: T) => Promise<boolean>,
  errorMessage: string
): AsyncValidator<T> {
  return async (value) => {
    const isValid = await validatorFn(value);
    return {
      valid: isValid,
      error: isValid ? undefined : errorMessage,
    };
  };
}

// Debounce utility for async validation
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Form validation context
export class FormValidator<T extends Record<string, unknown>> {
  private validators: Record<keyof T, Validator[]> = {} as Record<keyof T, Validator[]>;
  private asyncValidators: Record<keyof T, AsyncValidator[]> = {} as Record<keyof T, AsyncValidator[]>;
  private state: FormState<T> = this.getInitialState();

  constructor(
    private initialValues: T,
    private onChange?: (state: FormState<T>) => void,
    private onValidate?: (field: keyof T, error: string | null) => void
  ) {
    this.state = this.getInitialState();
  }

  private getInitialState(): FormState<T> {
    return {
      values: { ...this.initialValues },
      errors: {} as Record<keyof T, string | null>,
      touched: {} as Record<keyof T, boolean>,
      dirty: {} as Record<keyof T, boolean>,
      valid: true,
      isSubmitting: false,
    };
  }

  addValidator(field: keyof T, validator: Validator) {
    if (!this.validators[field]) {
      this.validators[field] = [];
    }
    this.validators[field].push(validator);
  }

  addAsyncValidator(field: keyof T, validator: AsyncValidator) {
    if (!this.asyncValidators[field]) {
      this.asyncValidators[field] = [];
    }
    this.asyncValidators[field].push(validator);
  }

  setFieldValue(field: keyof T, value: unknown) {
    this.state.values[field] = value as T[keyof T];
    this.state.dirty[field] = true;
    this.validateField(field);
    this.notifyChange();
  }

  setFieldTouched(field: keyof T, touched: boolean) {
    this.state.touched[field] = touched;
    if (touched) {
      this.validateField(field);
    }
    this.notifyChange();
  }

  async validateField(field: keyof T): Promise<void> {
    const value = this.state.values[field];
    const validators = this.validators[field] || [];
    const asyncValidators = this.asyncValidators[field] || [];

    // Run sync validators
    for (const validator of validators) {
      const result = validator(value);
      if (!result.valid) {
        this.state.errors[field] = result.error || null;
        this.notifyValidation(field, this.state.errors[field]);
        return;
      }
    }

    // Run async validators
    if (asyncValidators.length > 0) {
      for (const validator of asyncValidators) {
        const result = await validator(value);
        if (!result.valid) {
          this.state.errors[field] = result.error || null;
          this.notifyValidation(field, this.state.errors[field]);
          return;
        }
      }
    }

    this.state.errors[field] = null;
    this.notifyValidation(field, null);
  }

  async validateForm(): Promise<boolean> {
    // Mark all fields as touched
    Object.keys(this.state.values).forEach(key => {
      this.state.touched[key as keyof T] = true;
    });

    // Validate all fields
    const validations = Object.keys(this.state.values).map(
      field => this.validateField(field as keyof T)
    );

    await Promise.all(validations);

    // Check if form is valid
    this.state.valid = Object.values(this.state.errors).every(error => error === null);
    this.notifyChange();

    return this.state.valid;
  }

  reset() {
    this.state = this.getInitialState();
    this.notifyChange();
  }

  getState(): FormState<T> {
    return { ...this.state };
  }

  private notifyChange() {
    this.state.valid = Object.values(this.state.errors).every(error => error === null);
    this.onChange?.(this.getState());
  }

  private notifyValidation(field: keyof T, error: string | null) {
    this.onValidate?.(field, error);
  }
}
