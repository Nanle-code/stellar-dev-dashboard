/**
 * Diagnostics redaction (#774)
 * ============================
 * Secret keys, signed transaction envelopes (XDR), bearer tokens, JWTs and
 * recovery phrases must never reach telemetry, console logs, error reports or
 * `localStorage`. This module is the single choke point used by the logger and
 * the error-reporting service.
 *
 * Design goals:
 *  - pure, dependency-free and safe in browser / node / worker environments;
 *  - never throws: malformed input degrades to a placeholder instead of
 *    breaking the diagnostics pipeline;
 *  - bounded: recursion depth, cycle detection and string truncation.
 */

export const REDACTED = '[REDACTED]';
export const CIRCULAR = '[Circular]';
export const TRUNCATED = '[Truncated]';
export const UNREPRESENTABLE = '[Unrepresentable]';

export interface RedactionOptions {
  /** Replacement written in place of sensitive values. */
  placeholder?: string;
  /** Maximum object/array recursion depth before truncating. Default 8. */
  maxDepth?: number;
  /** Maximum string length before truncation. Default 10_000. */
  maxStringLength?: number;
  /** Extra key names treated as sensitive (case-insensitive segment match). */
  extraSensitiveKeys?: string[];
}

interface ResolvedOptions {
  placeholder: string;
  maxDepth: number;
  maxStringLength: number;
  extraSensitiveKeys: string[];
}

function resolveOptions(options: RedactionOptions = {}): ResolvedOptions {
  return {
    placeholder: options.placeholder || REDACTED,
    maxDepth: Number.isFinite(options.maxDepth) ? Math.max(0, options.maxDepth as number) : 8,
    maxStringLength: Number.isFinite(options.maxStringLength)
      ? Math.max(0, options.maxStringLength as number)
      : 10_000,
    extraSensitiveKeys: Array.isArray(options.extraSensitiveKeys) ? options.extraSensitiveKeys : [],
  };
}

// ---------------------------------------------------------------------------
// Value-shape detectors
// ---------------------------------------------------------------------------

/** Stellar ed25519 secret seed: `S` + 55 base32 characters. */
export function isStellarSecretKey(value: string): boolean {
  return typeof value === 'string' && /^S[A-Z2-7]{55}$/.test(value);
}

/**
 * Signed transaction / Soroban envelope encoded as base64 XDR. Envelopes are
 * always longer than 100 base64 characters and the first four bytes encode the
 * envelope type, which serialises to an `AAAA` prefix.
 */
export function isSignedXdr(value: string): boolean {
  return typeof value === 'string' && value.length >= 100 && /^AAAA[A-Za-z0-9+/]{90,}={0,2}$/.test(value);
}

/** Compact JWS/JWT: three base64url segments. */
export function isJwt(value: string): boolean {
  return (
    typeof value === 'string' &&
    /^eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}$/.test(value)
  );
}

/** PEM-encoded private key block. */
export function isPemPrivateKey(value: string): boolean {
  return typeof value === 'string' && /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value);
}

/** BIP-39 recovery phrase: 12/15/18/21/24 lowercase words. */
export function isMnemonic(value: string): boolean {
  if (typeof value !== 'string') return false;
  const words = value.trim().split(/\s+/);
  if (![12, 15, 18, 21, 24].includes(words.length)) return false;
  return words.every((word) => /^[a-z]{3,8}$/.test(word));
}

/** Provider-issued API keys and bot tokens. */
export function isProviderApiKey(value: string): boolean {
  if (typeof value !== 'string') return false;
  return (
    /^(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}$/.test(value) ||
    /^gh[pousr]_[A-Za-z0-9]{20,}$/.test(value) ||
    /^github_pat_[A-Za-z0-9_]{20,}$/.test(value) ||
    /^xox[abprs]-[A-Za-z0-9-]{10,}$/.test(value) ||
    /^AIza[0-9A-Za-z_-]{35}$/.test(value)
  );
}

/** `Authorization` header values. */
export function isAuthHeaderValue(value: string): boolean {
  return typeof value === 'string' && /^(?:Bearer|Basic)\s+\S{10,}$/i.test(value);
}

/** True when the whole string is one of the recognised secret shapes. */
export function isSensitiveString(value: string): boolean {
  return (
    isStellarSecretKey(value) ||
    isSignedXdr(value) ||
    isJwt(value) ||
    isPemPrivateKey(value) ||
    isMnemonic(value) ||
    isProviderApiKey(value) ||
    isAuthHeaderValue(value)
  );
}

// ---------------------------------------------------------------------------
// Substring scrubbing (for free-form messages, stacks and URLs)
// ---------------------------------------------------------------------------

const VALUE_PATTERNS: RegExp[] = [
  /\bS[A-Z2-7]{55}\b/g, // Stellar secret key
  /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g, // JWT
  /AAAA[A-Za-z0-9+/]{90,}={0,2}(?![A-Za-z0-9+/=])/g, // signed XDR envelope
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{10,}/gi,
];

const plainPatterns = new Map<string, RegExp>();

function matchesAnyPattern(value: string): boolean {
  return VALUE_PATTERNS.some((pattern) => {
    let plain = plainPatterns.get(pattern.source);
    if (!plain) {
      plain = new RegExp(pattern.source, pattern.flags.replace(/g/g, ''));
      plainPatterns.set(pattern.source, plain);
    }
    return plain.test(value);
  });
}

/**
 * Strip every recognised secret from a free-form string. Also removes
 * credential-looking query parameters from absolute URLs.
 */
export function redactString(value: string, placeholder: string = REDACTED): string {
  if (typeof value !== 'string' || value.length === 0) return value;
  let output = value;
  for (const pattern of VALUE_PATTERNS) {
    output = output.replace(pattern, placeholder);
  }
  return output;
}

const SENSITIVE_QUERY_PARAMS = [
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'key',
  'api_key',
  'apikey',
  'secret',
  'secret_key',
  'password',
  'passwd',
  'signature',
  'sig',
  'xdr',
  'envelope',
  'auth',
  'code',
  'session',
  'seed',
  'mnemonic',
];

/** Remove/short-circuit credential-bearing query params from a URL string. */
export function redactUrl(url: string, placeholder: string = REDACTED): string {
  if (typeof url !== 'string' || url.length === 0) return url;
  try {
    const parsed = new URL(url);
    let changed = false;
    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, placeholder);
        changed = true;
      }
    }
    return changed ? parsed.toString() : url;
  } catch {
    // Relative or malformed URL — fall back to substring scrubbing.
    return redactString(url, placeholder);
  }
}

// ---------------------------------------------------------------------------
// Key-name heuristics
// ---------------------------------------------------------------------------

const SENSITIVE_SEGMENTS = new Set([
  'secret',
  'token',
  'password',
  'passwd',
  'passphrase',
  'authorization',
  'auth',
  'cookie',
  'session',
  'sessionid',
  'privatekey',
  'secretkey',
  'mnemonic',
  'seed',
  'recovery',
  'apikey',
  'accesskey',
  'signingkey',
  'encryptionkey',
  'credential',
  'credentials',
  'signature',
  'xdr',
  'envelope',
  'bearer',
  'otp',
  'pin',
  'keystore',
]);

const KEY_QUALIFIERS = ['api', 'secret', 'private', 'signing', 'signer', 'encryption', 'access', 'refresh', 'recovery'];

function keySegments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
}

/** True when a property name looks like it holds a credential. */
export function isSensitiveKey(key: string, extraSensitiveKeys: string[] = []): boolean {
  if (typeof key !== 'string' || key.length === 0) return false;
  const segments = keySegments(key);
  if (segments.some((segment) => SENSITIVE_SEGMENTS.has(segment))) return true;
  if (segments.includes('key') && segments.some((segment) => KEY_QUALIFIERS.includes(segment))) return true;
  if (extraSensitiveKeys.some((extra) => segments.includes(String(extra).toLowerCase()))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Deep redaction
// ---------------------------------------------------------------------------

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}${TRUNCATED}` : value;
}

export function redactError(
  error: unknown,
  options: RedactionOptions = {}
): { name: string; message: string; stack: string | null; code: string | number | null } {
  const opts = resolveOptions(options);
  const source = error as Record<string, unknown> | null | undefined;
  const name = typeof source?.name === 'string' ? source.name : typeof error === 'string' ? 'Error' : 'Unknown';
  const rawMessage =
    typeof source?.message === 'string' ? source.message : typeof error === 'string' ? error : String(error ?? 'Unknown error');
  const message = truncate(redactString(rawMessage, opts.placeholder), opts.maxStringLength);
  const rawStack = typeof source?.stack === 'string' ? source.stack : null;
  const stack = rawStack ? truncate(redactString(rawStack, opts.placeholder), opts.maxStringLength) : null;
  const code =
    typeof source?.code === 'string' || typeof source?.code === 'number' ? (source!.code as string | number) : null;
  return { name, message, stack, code };
}

/**
 * Recursively redact a JSON-like value for telemetry.
 *
 * - sensitive keys are replaced wholesale (values are never inspected);
 * - strings are scrubbed for embedded secret shapes and credential URLs;
 * - `Error` instances become `{ name, message, stack, code }`;
 * - circular references, depth overflow and unrepresentable values degrade to
 *   markers instead of throwing.
 */
export function redactValue<T = unknown>(value: unknown, options: RedactionOptions = {}): T {
  const opts = resolveOptions(options);
  return redactInner(value, opts, 0, new WeakSet<object>()) as T;
}

function redactInner(value: unknown, opts: ResolvedOptions, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  const type = typeof value;
  if (type === 'number' || type === 'boolean') return value;
  if (type === 'bigint') return String(value);
  if (type === 'function' || type === 'symbol') return UNREPRESENTABLE;
  if (type === 'string') {
    const str = value as string;
    if (isSensitiveString(str)) return opts.placeholder;
    return truncate(redactString(str, opts.placeholder), opts.maxStringLength);
  }

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return redactError(value, opts);
  if (value instanceof RegExp) return value.toString();

  if (depth >= opts.maxDepth) return TRUNCATED;

  if (value instanceof Map) {
    if (seen.has(value)) return CIRCULAR;
    seen.add(value);
    try {
      const out: Record<string, unknown> = {};
      value.forEach((mapValue, mapKey) => {
        const key = String(mapKey);
        out[key] = isSensitiveKey(key, opts.extraSensitiveKeys)
          ? opts.placeholder
          : redactInner(mapValue, opts, depth + 1, seen);
      });
      return out;
    } finally {
      seen.delete(value);
    }
  }

  if (value instanceof Set) {
    if (seen.has(value)) return CIRCULAR;
    seen.add(value);
    try {
      return [...value].map((item) => redactInner(item, opts, depth + 1, seen));
    } finally {
      seen.delete(value);
    }
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return CIRCULAR;
    seen.add(value);
    try {
      return value.map((item) => redactInner(item, opts, depth + 1, seen));
    } finally {
      seen.delete(value);
    }
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return CIRCULAR;
    seen.add(obj);
    try {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(obj)) {
        if (isSensitiveKey(key, opts.extraSensitiveKeys)) {
          out[key] = opts.placeholder;
        } else {
          out[key] = redactInner(obj[key], opts, depth + 1, seen);
        }
      }
      return out;
    } catch {
      return UNREPRESENTABLE;
    } finally {
      seen.delete(obj);
    }
  }

  return UNREPRESENTABLE;
}

/** Alias used at telemetry boundaries. */
export function redactForTelemetry<T = unknown>(value: unknown, options: RedactionOptions = {}): T {
  return redactValue<T>(value, options);
}

/** True when a value contains any recognised secret (used for assertions). */
export function containsSensitiveValue(value: unknown): boolean {
  if (typeof value === 'string') return isSensitiveString(value) || matchesAnyPattern(value);
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(containsSensitiveValue);
  if (typeof value === 'object') {
    if (value instanceof Error) return containsSensitiveValue(value.message) || containsSensitiveValue(value.stack);
    return Object.values(value as Record<string, unknown>).some(containsSensitiveValue);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Logger wrapper
// ---------------------------------------------------------------------------

export interface RedactableLogger {
  debug: (msg: string, ctx?: Record<string, unknown>) => void;
  info: (msg: string, ctx?: Record<string, unknown>) => void;
  warn: (msg: string, ctx?: Record<string, unknown>, err?: Error | null) => void;
  error: (msg: string, ctx?: Record<string, unknown>, err?: Error | null) => void;
  fatal?: (msg: string, ctx?: Record<string, unknown>, err?: Error | null) => void;
}

/**
 * Wrap a logger so every message, context object and error is redacted before
 * it reaches console/handlers.
 */
export function withRedaction<T extends RedactableLogger>(logger: T, options: RedactionOptions = {}): T {
  const clean = <R>(fn: (...args: unknown[]) => R, ...args: unknown[]): R => {
    const redacted = args.map((arg) => {
      if (typeof arg === 'string') return redactValue<string>(arg, options);
      if (arg instanceof Error) {
        const info = redactError(arg, options);
        const copy = new Error(info.message);
        copy.name = info.name;
        if (info.stack) copy.stack = info.stack;
        return copy;
      }
      return redactValue(arg, options);
    });
    return fn(...redacted);
  };

  const wrapped = {
    ...logger,
    debug: (msg: string, ctx: Record<string, unknown> = {}) => clean(logger.debug as (...a: unknown[]) => void, msg, ctx),
    info: (msg: string, ctx: Record<string, unknown> = {}) => clean(logger.info as (...a: unknown[]) => void, msg, ctx),
    warn: (msg: string, ctx: Record<string, unknown> = {}, err: Error | null = null) =>
      clean(logger.warn as (...a: unknown[]) => void, msg, ctx, err),
    error: (msg: string, ctx: Record<string, unknown> = {}, err: Error | null = null) =>
      clean(logger.error as (...a: unknown[]) => void, msg, ctx, err),
  } as T;

  if (typeof logger.fatal === 'function') {
    wrapped.fatal = ((msg: string, ctx: Record<string, unknown> = {}, err: Error | null = null) =>
      clean(logger.fatal as (...a: unknown[]) => void, msg, ctx, err)) as T['fatal'];
  }

  return wrapped;
}
