import type { ValidationResult, MemoType, NetworkName } from './types/index.js';

export function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

export function fail(...errors: string[]): ValidationResult {
  return { valid: false, errors };
}

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const STELLAR_MUXED_RE = /^M[A-Z2-7]{55}$/;
const FEDERATED_ADDRESS_RE = /^[a-zA-Z0-9._-]+\*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateStellarAddress(value: unknown): ValidationResult {
  if (typeof value !== 'string' || value.trim() === '') {
    return fail('Stellar address is required.');
  }
  const trimmed = value.trim();

  if (STELLAR_ADDRESS_RE.test(trimmed)) {
    return ok();
  }

  if (STELLAR_MUXED_RE.test(trimmed)) {
    return ok();
  }

  if (FEDERATED_ADDRESS_RE.test(trimmed)) {
    return ok();
  }

  return fail('Invalid Stellar address. Must be a G... address, M... muxed account, or name*domain federated address.');
}

export function validateAmount(
  value: unknown,
  min = 0.0000001,
  max = Number.MAX_SAFE_INTEGER
): ValidationResult {
  if (value === '' || value === null || value === undefined) {
    return fail('Amount is required.');
  }
  const n = Number(value);
  if (isNaN(n) || !isFinite(n)) return fail('Amount must be a valid number.');
  if (n <= 0) return fail('Amount must be greater than zero.');
  if (n < min) return fail(`Amount must be at least ${min}.`);
  if (n > max) return fail(`Amount must not exceed ${max}.`);
  if (!/^\d+(\.\d{1,7})?$/.test(String(value))) {
    return fail('Amount must have at most 7 decimal places.');
  }
  return ok();
}

export function validateMemo(value: unknown, type: MemoType = 'text'): ValidationResult {
  if (type === 'none') return ok();
  if (value === '' || value === null || value === undefined) return ok();
  if (typeof value !== 'string') return fail('Memo must be a string.');

  switch (type) {
    case 'text': {
      const bytes = new TextEncoder().encode(value);
      if (bytes.length > 28) return fail('Memo text must be 28 bytes or fewer.');
      return ok();
    }
    case 'id': {
      const trimmed = value.trim();
      if (!/^\d+$/.test(trimmed)) return fail('Memo ID must be a non-negative integer.');
      let n: bigint;
      try {
        n = BigInt(trimmed);
      } catch {
        return fail('Memo ID must be a valid unsigned 64-bit integer.');
      }
      if (n > 18446744073709551615n) {
        return fail('Memo ID must not exceed 18446744073709551615 (2^64 - 1).');
      }
      return ok();
    }
    case 'hash':
    case 'return': {
      const trimmed = value.trim();
      const label = type === 'hash' ? 'Memo hash' : 'Memo return hash';
      if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        return fail(`${label} must be a 32-byte value encoded as 64 hex characters.`);
      }
      return ok();
    }
    default:
      return fail(`Unsupported memo type: ${String(type)}.`);
  }
}

const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

export function validateContractId(value: unknown): ValidationResult {
  if (typeof value !== 'string' || value.trim() === '') {
    return fail('Contract ID is required.');
  }
  if (!CONTRACT_ID_RE.test(value.trim())) {
    return fail('Invalid Contract ID. Must start with C and be 56 characters.');
  }
  return ok();
}

const VALID_NETWORKS = ['testnet', 'mainnet', 'futurenet', 'local', 'custom'] as const;
export type ValidNetworkName = (typeof VALID_NETWORKS)[number];

export function validateNetwork(value: unknown): ValidationResult {
  if (!VALID_NETWORKS.includes(value as ValidNetworkName)) {
    return fail(`Network must be one of: ${VALID_NETWORKS.join(', ')}.`);
  }
  return ok();
}

export function validateUrl(value: unknown, required = true): ValidationResult {
  if (!value) {
    if (required) {
      return fail('URL is required.');
    }
    return ok();
  }

  if (typeof value !== 'string') {
    return fail('URL must be a string.');
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    if (required) {
      return fail('URL is required.');
    }
    return ok();
  }

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return fail('URL must use HTTP or HTTPS protocol.');
    }
    return ok();
  } catch {
    return fail('Invalid URL format.');
  }
}

export function validateHorizonUrl(value: unknown): ValidationResult {
  const result = validateUrl(value, true);
  if (!result.valid) return result;
  return ok();
}

export function validateSorobanUrl(value: unknown, required = true): ValidationResult {
  const result = validateUrl(value, required);
  if (!result.valid) return result;
  if (!value) return ok();
  return ok();
}

export function validateNetworkPassphrase(value: unknown, required = true): ValidationResult {
  if (!value) {
    if (required) {
      return fail('Network passphrase is required.');
    }
    return ok();
  }

  if (typeof value !== 'string') {
    return fail('Network passphrase must be a string.');
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    if (required) {
      return fail('Network passphrase is required.');
    }
    return ok();
  }

  return ok();
}

export function composeValidations(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return { valid: errors.length === 0, errors };
}