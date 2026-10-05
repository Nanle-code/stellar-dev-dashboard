import {
  type ValidationResult,
  type MemoType,
  validateStellarAddress as coreValidateStellarAddress,
  validateAmount as coreValidateAmount,
  validateMemo as coreValidateMemo,
  validateContractId as coreValidateContractId,
  validateNetwork as coreValidateNetwork,
  composeValidations as coreComposeValidations,
} from '@stellar-dev-dashboard/core';

export { type ValidationResult, type MemoType };

export function validateStellarAddress(value: unknown): ValidationResult {
  return coreValidateStellarAddress(value);
}

export function validateAmount(
  value: unknown,
  min = 0.0000001,
  max = Number.MAX_SAFE_INTEGER
): ValidationResult {
  return coreValidateAmount(value, min, max);
}

export function validateMemo(value: unknown, type: MemoType = 'text'): ValidationResult {
  return coreValidateMemo(value, type);
}

export function validateContractId(value: unknown): ValidationResult {
  return coreValidateContractId(value);
}

export function validateNetwork(value: unknown): ValidationResult {
  return coreValidateNetwork(value);
}

export function validateUrl(value: unknown, required = true): ValidationResult {
  if (!value) {
    if (required) {
      return { valid: false, errors: ['URL is required.'] };
    }
    return { valid: true, errors: [] };
  }

  if (typeof value !== 'string') {
    return { valid: false, errors: ['URL must be a string.'] };
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    if (required) {
      return { valid: false, errors: ['URL is required.'] };
    }
    return { valid: true, errors: [] };
  }

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, errors: ['URL must use HTTP or HTTPS protocol.'] };
    }
    return { valid: true, errors: [] };
  } catch {
    return { valid: false, errors: ['Invalid URL format.'] };
  }
}

export function validateHorizonUrl(value: unknown): ValidationResult {
  const result = validateUrl(value, true);
  if (!result.valid) return result;
  return { valid: true, errors: [] };
}

export function validateSorobanUrl(value: unknown, required = true): ValidationResult {
  const result = validateUrl(value, required);
  if (!result.valid) return result;
  if (!value) return { valid: true, errors: [] };
  return { valid: true, errors: [] };
}

export function validateNetworkPassphrase(value: unknown, required = true): ValidationResult {
  if (!value) {
    if (required) {
      return { valid: false, errors: ['Network passphrase is required.'] };
    }
    return { valid: true, errors: [] };
  }

  if (typeof value !== 'string') {
    return { valid: false, errors: ['Network passphrase must be a string.'] };
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    if (required) {
      return { valid: false, errors: ['Network passphrase is required.'] };
    }
    return { valid: true, errors: [] };
  }

  return { valid: true, errors: [] };
}

export function composeValidations(...results: ValidationResult[]): ValidationResult {
  return coreComposeValidations(...results);
}