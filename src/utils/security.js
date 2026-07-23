/**
 * Security utilities (#106)
 *
 * Covers:
 * - Content Security Policy (CSP) nonce generation
 * - XSS sanitisation for user-supplied strings
 * - Stellar address / memo format validation
 * - Secure clipboard write helper (no visible secret)
 * - Rate-limiter for sensitive actions (login, tx submit)
 */

// ─── CSP helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random nonce for inline script/style CSP.
 * @returns {string} Base64-encoded 16-byte nonce
 */
export function generateCspNonce() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return btoa(String.fromCharCode(...bytes))
  }
  // Fallback (non-browser environments)
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

/**
 * Build the Content-Security-Policy header value for the dashboard.
 * Pass a nonce to allow specific inline scripts without `unsafe-inline`.
 *
 * @param {string} [nonce]
 * @returns {string}
 */
export function buildCspHeader(nonce) {
  const nonceAttr = nonce ? ` 'nonce-${nonce}'` : ''
  return [
    `default-src 'self'`,
    `script-src 'self'${nonceAttr}`,
    `style-src 'self'${nonceAttr}`,
    `img-src 'self' data: https:`,
    `connect-src 'self' https://*.stellar.org https://api.coingecko.com`,
    `font-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ')
}

// ─── XSS sanitisation ────────────────────────────────────────────────────────

const DANGEROUS_HTML_CHARS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
}

const SECRET_KEY_PATTERN = /\bS[A-Z2-7]{55}\b/g
const SENSITIVE_FIELD_REGEX = /(secret|secretkey|privatekey|seed|mnemonic|password|passphrase|token|apikey|authorization|headers)/i
const AUTH_TOKEN_PATTERN = /\b(Bearer|Token)\s+[A-Za-z0-9\-._~+/]+=*\b/gi

export function redactSensitive(value, key) {
  if (value == null) return value

  if (typeof value === 'string') {
    let redacted = value.replace(SECRET_KEY_PATTERN, '[REDACTED_SECRET_KEY]')
    redacted = redacted.replace(AUTH_TOKEN_PATTERN, '$1 [REDACTED]')
    if (key && SENSITIVE_FIELD_REGEX.test(key)) {
      return '[REDACTED]'
    }
    return redacted
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item))
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [childKey, childValue]) => {
      if (SENSITIVE_FIELD_REGEX.test(childKey)) {
        acc[childKey] = '[REDACTED]'
      } else {
        acc[childKey] = redactSensitive(childValue, childKey)
      }
      return acc
    }, {})
  }

  return value
}

/**
 * Escape a string for safe insertion into HTML.
 * Use this on any user-supplied value rendered via dangerouslySetInnerHTML.
 *
 * @param {string} input
 * @returns {string}
 */
export function escapeHtml(input) {
  if (typeof input !== 'string') return ''
  return input.replace(/[&<>"'/]/g, (ch) => DANGEROUS_HTML_CHARS[ch])
}

/**
 * Strip all HTML tags from a string (for display in plain-text contexts).
 * @param {string} input
 * @returns {string}
 */
export function stripHtml(input) {
  if (typeof input !== 'string') return ''
  return input.replace(/<[^>]*>/g, '')
}

// ─── Input sanitisation ───────────────────────────────────────────────────────

/**
 * Sanitise a Stellar address input: trim whitespace, reject non-ASCII.
 * @param {string} value
 * @returns {string}
 */
export function sanitizeStellarAddress(value) {
  if (typeof value !== 'string') return ''
  // Remove non-base32 characters (Stellar uses A-Z 2-7 in StrKey)
  return value.trim().replace(/[^A-Z2-7]/gi, '').toUpperCase()
}

/**
 * Sanitise a transaction memo: trim, restrict to 28 ASCII bytes.
 * @param {string} value
 * @returns {string}
 */
export function sanitizeMemo(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[^\x20-\x7E]/g, '') // keep printable ASCII only
    .slice(0, 28)
}

// ─── Secure clipboard ────────────────────────────────────────────────────────

/**
 * Write text to the clipboard without logging the value.
 * Clears the clipboard after `clearAfterMs` milliseconds (default 30 s).
 *
 * @param {string} text
 * @param {number} [clearAfterMs=30000]
 * @returns {Promise<boolean>}
 */
export async function secureCopy(text, clearAfterMs = 30_000) {
  try {
    await navigator.clipboard.writeText(text)
    if (clearAfterMs > 0) {
      setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), clearAfterMs)
    }
    return true
  } catch {
    return false
  }
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const _rateLimitMap = new Map()

/**
 * Simple in-memory token-bucket rate limiter for sensitive actions.
 *
 * @param {string} action       Unique action identifier
 * @param {number} maxCalls     Maximum number of calls allowed
 * @param {number} windowMs     Time window in milliseconds
 * @returns {boolean}  true if the action is allowed, false if rate-limited
 */
export function checkRateLimit(action, maxCalls = 5, windowMs = 60_000) {
  const now = Date.now()
  const record = _rateLimitMap.get(action) ?? { calls: [], blocked: false }

  // Prune calls outside the current window
  record.calls = record.calls.filter((t) => now - t < windowMs)

  if (record.calls.length >= maxCalls) {
    _rateLimitMap.set(action, record)
    return false
  }

  record.calls.push(now)
  _rateLimitMap.set(action, record)
  return true
}

/**
 * Reset the rate limit for a given action (e.g. on successful auth).
 * @param {string} action
 */
export function resetRateLimit(action) {
  _rateLimitMap.delete(action)
}