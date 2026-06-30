/**
 * Input validation schemas (#106)
 *
 * Lightweight runtime validators for all user-supplied inputs.
 * No external schema library required — pure TypeScript functions.
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

function ok(): ValidationResult { return { valid: true, errors: [] } }
function fail(...errors: string[]): ValidationResult { return { valid: false, errors } }

// ─── Stellar address ──────────────────────────────────────────────────────────

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/
const STELLAR_MUXED_RE = /^M[A-Z2-7]{55}$/
const FEDERATED_ADDRESS_RE = /^[a-zA-Z0-9._-]+\*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

/**
 * Validate a Stellar public key (G…), muxed account (M…), or federated address (name*domain).
 */
export function validateStellarAddress(value: unknown): ValidationResult {
  if (typeof value !== 'string' || value.trim() === '') {
    return fail('Stellar address is required.')
  }
  const trimmed = value.trim()
  
  // Check G... Ed25519
  if (STELLAR_ADDRESS_RE.test(trimmed)) {
    return ok()
  }
  
  // Check M... muxed account
  if (STELLAR_MUXED_RE.test(trimmed)) {
    return ok()
  }
  
  // Check name*domain federated address
  if (FEDERATED_ADDRESS_RE.test(trimmed)) {
    return ok()
  }
  
  return fail('Invalid Stellar address. Must be a G... address, M... muxed account, or name*domain federated address.')
}

// ─── Amount ───────────────────────────────────────────────────────────────────

/**
 * Validate a payment amount string.
 * @param min   Minimum allowed value (default 0.0000001 — one stroop)
 * @param max   Maximum allowed value (default unlimited)
 */
export function validateAmount(
  value: unknown,
  min = 0.0000001,
  max = Number.MAX_SAFE_INTEGER,
): ValidationResult {
  if (value === '' || value === null || value === undefined) {
    return fail('Amount is required.')
  }
  const n = Number(value)
  if (isNaN(n) || !isFinite(n)) return fail('Amount must be a valid number.')
  if (n <= 0) return fail('Amount must be greater than zero.')
  if (n < min) return fail(`Amount must be at least ${min}.`)
  if (n > max) return fail(`Amount must not exceed ${max}.`)
  // Max 7 decimal places (Stellar stroop precision)
  if (!/^\d+(\.\d{1,7})?$/.test(String(value))) {
    return fail('Amount must have at most 7 decimal places.')
  }
  return ok()
}

// ─── Transaction memo ─────────────────────────────────────────────────────────

/**
 * Validate a transaction memo (text type, max 28 bytes UTF-8).
 */
export function validateMemo(value: unknown): ValidationResult {
  if (value === '' || value === null || value === undefined) return ok() // memo is optional
  if (typeof value !== 'string') return fail('Memo must be a string.')
  const bytes = new TextEncoder().encode(value)
  if (bytes.length > 28) return fail('Memo text must be 28 bytes or fewer.')
  return ok()
}

// ─── Contract ID ──────────────────────────────────────────────────────────────

const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/

export function validateContractId(value: unknown): ValidationResult {
  if (typeof value !== 'string' || value.trim() === '') {
    return fail('Contract ID is required.')
  }
  if (!CONTRACT_ID_RE.test(value.trim())) {
    return fail('Invalid Contract ID. Must start with C and be 56 characters.')
  }
  return ok()
}

// ─── Network name ─────────────────────────────────────────────────────────────

const VALID_NETWORKS = ['testnet', 'mainnet'] as const
export type NetworkName = (typeof VALID_NETWORKS)[number]

export function validateNetwork(value: unknown): ValidationResult {
  if (!VALID_NETWORKS.includes(value as NetworkName)) {
    return fail(`Network must be one of: ${VALID_NETWORKS.join(', ')}.`)
  }
  return ok()
}

// ─── URL validation ───────────────────────────────────────────────────────────

/**
 * Validate a URL (HTTP/HTTPS only).
 * @param value The URL to validate
 * @param required Whether the URL is required (default true)
 */
export function validateUrl(value: unknown, required = true): ValidationResult {
  if (!value) {
    if (required) {
      return fail('URL is required.')
    }
    return ok()
  }
  
  if (typeof value !== 'string') {
    return fail('URL must be a string.')
  }
  
  const trimmed = value.trim()
  if (trimmed === '') {
    if (required) {
      return fail('URL is required.')
    }
    return ok()
  }
  
  try {
    const url = new URL(trimmed)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return fail('URL must use HTTP or HTTPS protocol.')
    }
    return ok()
  } catch {
    return fail('Invalid URL format.')
  }
}

/**
 * Validate a Horizon API URL.
 */
export function validateHorizonUrl(value: unknown): ValidationResult {
  const result = validateUrl(value, true)
  if (!result.valid) return result
  
  const trimmed = String(value).trim()
  if (!trimmed.includes('horizon')) {
    // Warn but don't fail—could be a custom endpoint
    // return fail('Horizon URL should contain "horizon" in the path.')
  }
  return ok()
}

/**
 * Validate a Soroban RPC URL.
 */
export function validateSorobanUrl(value: unknown, required = true): ValidationResult {
  const result = validateUrl(value, required)
  if (!result.valid) return result
  
  if (!value) return ok() // Optional if not required
  
  const trimmed = String(value).trim()
  if (!trimmed.includes('soroban') && !trimmed.includes('rpc')) {
    // Warn but don't fail—could be a custom endpoint
  }
  return ok()
}

/**
 * Validate a network passphrase.
 */
export function validateNetworkPassphrase(value: unknown, required = true): ValidationResult {
  if (!value) {
    if (required) {
      return fail('Network passphrase is required.')
    }
    return ok()
  }
  
  if (typeof value !== 'string') {
    return fail('Network passphrase must be a string.')
  }
  
  const trimmed = value.trim()
  if (trimmed === '') {
    if (required) {
      return fail('Network passphrase is required.')
    }
    return ok()
  }
  
  return ok()
}

// ─── Compose multiple validations ─────────────────────────────────────────────

/**
 * Run multiple validators and merge results.
 */
export function composeValidations(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors)
  return { valid: errors.length === 0, errors }
}
