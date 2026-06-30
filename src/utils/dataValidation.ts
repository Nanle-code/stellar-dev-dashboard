/**
 * Advanced Data Validation & Sanitization (#462)
 *
 * Provides:
 *  - JSON Schema-style validator (type, required, properties, items, enum)
 *  - Input sanitization pipeline (trim, strip HTML, encode entities, length limit)
 *  - XSS prevention via DOMPurify-compatible allow-list approach
 *  - Security scoring for user-supplied payloads
 *  - Custom validator library with composition helpers
 *  - Structured validation errors with recovery suggestions
 */

// ─── Core types ───────────────────────────────────────────────────────────────

export type SchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'

export interface JsonSchema {
  type?: SchemaType | SchemaType[]
  required?: string[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  enum?: unknown[]
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  pattern?: string
  description?: string
  default?: unknown
}

export interface ValidationError {
  path: string
  message: string
  received?: unknown
  suggestion?: string
}

export interface ValidationReport {
  valid: boolean
  errors: ValidationError[]
  securityScore: number // 0-100, higher = safer
  sanitizedValue?: unknown
}

// ─── Type checker ─────────────────────────────────────────────────────────────

function getType(value: unknown): SchemaType | 'undefined' {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'array'
  return typeof value as SchemaType
}

// ─── Schema Validator ─────────────────────────────────────────────────────────

function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  path: string,
  errors: ValidationError[],
): void {
  // Type check
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type]
    const actual = getType(value)
    if (!allowed.includes(actual as SchemaType)) {
      errors.push({
        path,
        message: `Expected type ${allowed.join(' | ')}, got ${actual}`,
        received: value,
        suggestion: `Provide a value of type: ${allowed.join(' or ')}`,
      })
      return // cannot validate further
    }
  }

  // Enum check
  if (schema.enum !== undefined) {
    if (!schema.enum.some(e => JSON.stringify(e) === JSON.stringify(value))) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.map(e => JSON.stringify(e)).join(', ')}`,
        received: value,
      })
    }
  }

  // String constraints
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `String is too short (min ${schema.minLength} chars, got ${value.length})`,
        received: value.length,
        suggestion: `Provide at least ${schema.minLength} characters`,
      })
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `String is too long (max ${schema.maxLength} chars, got ${value.length})`,
        received: value.length,
        suggestion: `Truncate to ${schema.maxLength} characters`,
      })
    }
    if (schema.pattern) {
      const re = new RegExp(schema.pattern)
      if (!re.test(value)) {
        errors.push({
          path,
          message: `String does not match required pattern: ${schema.pattern}`,
          received: value,
        })
      }
    }
  }

  // Number constraints
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `Value ${value} is less than minimum ${schema.minimum}`, received: value })
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `Value ${value} exceeds maximum ${schema.maximum}`, received: value })
    }
  }

  // Object constraints
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    // Required fields
    for (const req of schema.required ?? []) {
      if (!(req in obj) || obj[req] === undefined || obj[req] === null) {
        errors.push({
          path: path ? `${path}.${req}` : req,
          message: `Required field "${req}" is missing`,
          suggestion: `Add the "${req}" field to your payload`,
        })
      }
    }
    // Properties
    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        validateAgainstSchema(obj[key], subSchema, path ? `${path}.${key}` : key, errors)
      }
    }
  }

  // Array constraints
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) =>
      validateAgainstSchema(item, schema.items!, `${path}[${i}]`, errors),
    )
  }
}

export function validateSchema(value: unknown, schema: JsonSchema): ValidationReport {
  const errors: ValidationError[] = []
  validateAgainstSchema(value, schema, '', errors)
  const securityScore = computeSecurityScore(value)
  return { valid: errors.length === 0, errors, securityScore }
}

// ─── Sanitization pipeline ────────────────────────────────────────────────────

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
}

const ALLOWED_TAGS = new Set(['b', 'i', 'em', 'strong', 'code', 'pre', 'br'])

export interface SanitizeOptions {
  maxLength?: number
  allowHtmlTags?: boolean
  stripNonPrintable?: boolean
  normalizeWhitespace?: boolean
}

export function sanitizeString(input: unknown, options: SanitizeOptions = {}): string {
  if (typeof input !== 'string') return ''
  let s = input

  // Strip non-printable control characters (except tab/newline)
  if (options.stripNonPrintable !== false) {
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  }

  // HTML handling
  if (!options.allowHtmlTags) {
    s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi, (match, tag: string) => {
      if (ALLOWED_TAGS.has(tag.toLowerCase())) return match
      return ''
    })
    // Encode remaining dangerous characters
    s = s.replace(/[&<>"'/]/g, ch => HTML_ENTITY_MAP[ch] ?? ch)
  }

  // Normalize whitespace
  if (options.normalizeWhitespace) {
    s = s.replace(/\s+/g, ' ').trim()
  }

  // Length cap
  if (options.maxLength !== undefined) {
    s = s.slice(0, options.maxLength)
  }

  return s.trim()
}

export function sanitizeObject(obj: unknown, options: SanitizeOptions = {}): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return sanitizeString(obj, options)
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item, options))
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const safeKey = sanitizeString(key, { maxLength: 128, allowHtmlTags: false })
      out[safeKey] = sanitizeObject(value, options)
    }
    return out
  }
  return obj
}

// ─── Security validation ──────────────────────────────────────────────────────

const SQL_INJECTION_PATTERN = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE|DECLARE|CAST|CONVERT|ALTER|CREATE|TRUNCATE)\b)/i
const XSS_PATTERN = /<script[\s\S]*?>[\s\S]*?<\/script>/i
const PATH_TRAVERSAL_PATTERN = /\.\.[/\\]/
const COMMAND_INJECTION_PATTERN = /[;&|`$(){}[\]\\]/
const SECRET_KEY_PATTERN = /\bS[A-Z2-7]{55}\b/

interface SecurityCheckResult {
  passed: boolean
  issues: string[]
  score: number
}

export function runSecurityChecks(value: unknown): SecurityCheckResult {
  const issues: string[] = []
  const str = typeof value === 'string' ? value : JSON.stringify(value)

  if (SQL_INJECTION_PATTERN.test(str)) {
    issues.push('Possible SQL injection pattern detected')
  }
  if (XSS_PATTERN.test(str)) {
    issues.push('Possible XSS script tag detected')
  }
  if (PATH_TRAVERSAL_PATTERN.test(str)) {
    issues.push('Path traversal pattern detected')
  }
  if (COMMAND_INJECTION_PATTERN.test(str) && typeof value === 'string') {
    issues.push('Possible command injection characters')
  }
  if (SECRET_KEY_PATTERN.test(str)) {
    issues.push('Stellar secret key detected in payload — remove before submission')
  }

  const score = Math.max(0, 100 - issues.length * 20)
  return { passed: issues.length === 0, issues, score }
}

function computeSecurityScore(value: unknown): number {
  return runSecurityChecks(value).score
}

// ─── Custom Validator library ─────────────────────────────────────────────────

export type Validator<T = unknown> = (value: T) => ValidationError[]

export function required<T>(path: string): Validator<T> {
  return (value: T) =>
    value === null || value === undefined || value === ''
      ? [{ path, message: 'This field is required', suggestion: 'Provide a non-empty value' }]
      : []
}

export function minLen(path: string, min: number): Validator<string> {
  return (value: string) =>
    typeof value === 'string' && value.length < min
      ? [{ path, message: `Minimum length is ${min}`, received: value.length }]
      : []
}

export function maxLen(path: string, max: number): Validator<string> {
  return (value: string) =>
    typeof value === 'string' && value.length > max
      ? [{ path, message: `Maximum length is ${max}`, received: value.length }]
      : []
}

export function matches(path: string, pattern: RegExp, hint: string): Validator<string> {
  return (value: string) =>
    typeof value === 'string' && !pattern.test(value)
      ? [{ path, message: `Does not match expected format: ${hint}`, received: value }]
      : []
}

export function range(path: string, min: number, max: number): Validator<number> {
  return (value: number) => {
    const errors: ValidationError[] = []
    if (typeof value === 'number' && value < min) errors.push({ path, message: `Minimum value is ${min}` })
    if (typeof value === 'number' && value > max) errors.push({ path, message: `Maximum value is ${max}` })
    return errors
  }
}

/** Compose validators — all run, errors are merged */
export function compose<T>(...validators: Validator<T>[]): Validator<T> {
  return (value: T) => validators.flatMap(v => v(value))
}

/** Short-circuit — stop on first failing validator */
export function pipeline<T>(...validators: Validator<T>[]): Validator<T> {
  return (value: T) => {
    for (const v of validators) {
      const errors = v(value)
      if (errors.length) return errors
    }
    return []
  }
}

/** Run validators and build a full report including security score */
export function runValidators<T>(
  value: T,
  ...validators: Validator<T>[]
): ValidationReport {
  const errors = validators.flatMap(v => v(value))
  const securityScore = computeSecurityScore(value)
  return { valid: errors.length === 0, errors, securityScore }
}

// ─── Error recovery suggestions ───────────────────────────────────────────────

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map(e => {
      const location = e.path ? `[${e.path}] ` : ''
      const suggestion = e.suggestion ? ` → ${e.suggestion}` : ''
      return `${location}${e.message}${suggestion}`
    })
    .join('\n')
}
