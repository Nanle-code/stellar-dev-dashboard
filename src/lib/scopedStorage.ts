/**
 * Scoped Storage Utilities
 * 
 * Provides network and account-scoped storage for sensitive preference keys
 * to prevent cross-account leakage. This module isolates sensitive data by
 * network type and account identifier.
 * 
 * @module scopedStorage
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StorageScope {
  network: 'mainnet' | 'testnet' | 'futurenet' | 'local' | 'custom' | string
  accountId?: string
}

export interface ScopedStorageOptions {
  required?: boolean
  allowGlobalFallback?: boolean
}

// ─── Sensitive Key Classification ────────────────────────────────────────────────

/**
 * Keys that contain sensitive data and must be scoped by network/account
 * to prevent cross-account leakage.
 */
const SENSITIVE_KEYS = new Set([
  'transactionConfirmation.confirmationEmail',
  'transactionConfirmation.requireEmailConfirmation',
  'notificationPreferences.pushEnabled',
  'notificationPreferences.soundsEnabled',
  // Add other sensitive keys as needed
])

/**
 * Keys that are network-specific but not account-specific
 */
const NETWORK_SPECIFIC_KEYS = new Set([
  'defaultNetwork',
  'customNetworkProfiles',
  'activeCustomProfile',
])

/**
 * Check if a preference key is sensitive and requires scoping
 */
export function isSensitiveKey(key: string): boolean {
  // Check direct match
  if (SENSITIVE_KEYS.has(key)) return true
  
  // Check if key starts with any sensitive prefix
  for (const sensitiveKey of SENSITIVE_KEYS) {
    if (key.startsWith(sensitiveKey + '.')) return true
  }
  
  return false
}

/**
 * Check if a preference key is network-specific
 */
export function isNetworkSpecificKey(key: string): boolean {
  return NETWORK_SPECIFIC_KEYS.has(key)
}

// ─── Scope Validation ───────────────────────────────────────────────────────────

/**
 * Validate a storage scope object
 */
export function validateScope(scope: StorageScope): { valid: boolean; error?: string } {
  if (!scope || typeof scope !== 'object') {
    return { valid: false, error: 'Scope must be an object' }
  }
  
  if (!scope.network || typeof scope.network !== 'string') {
    return { valid: false, error: 'Scope must include a valid network identifier' }
  }
  
  // Validate network format - allow custom networks with any prefix
  const validNetworks = ['mainnet', 'testnet', 'futurenet', 'local', 'custom']
  const isValidNetwork = validNetworks.includes(scope.network) || 
                        scope.network.startsWith('custom-') ||
                        scope.network.startsWith('custom')
  
  if (!isValidNetwork) {
    return { valid: false, error: `Invalid network: ${scope.network}` }
  }
  
  // If accountId is provided, validate it
  if (scope.accountId !== undefined) {
    if (typeof scope.accountId !== 'string' || scope.accountId.length === 0) {
      return { valid: false, error: 'Account ID must be a non-empty string' }
    }
  }
  
  return { valid: true }
}

/**
 * Sanitize scope values for use in storage keys
 */
function sanitizeScopeValue(value: string): string {
  // Remove any characters that could cause issues in storage keys
  return value.replace(/[^a-zA-Z0-9-_]/g, '-')
}

// ─── Scoped Key Generation ──────────────────────────────────────────────────────

/**
 * Generate a scoped storage key for a preference
 * 
 * @param baseKey - The original preference key
 * @param scope - The network/account scope
 * @param options - Storage options
 * @returns A scoped key string
 */
export function generateScopedKey(
  baseKey: string,
  scope: StorageScope,
  options: ScopedStorageOptions = {}
): string {
  const validation = validateScope(scope)
  if (!validation.valid) {
    if (options.required) {
      throw new Error(`Invalid scope: ${validation.error}`)
    }
    // Fallback to global key if not required
    if (options.allowGlobalFallback) {
      return baseKey
    }
    throw new Error(`Invalid scope: ${validation.error}`)
  }
  
  const sanitizedNetwork = sanitizeScopeValue(scope.network)
  
  // Build scoped key
  let scopedKey = `scoped:${sanitizedNetwork}`
  
  if (scope.accountId) {
    const sanitizedAccountId = sanitizeScopeValue(scope.accountId)
    scopedKey += `:${sanitizedAccountId}`
  }
  
  scopedKey += `:${baseKey}`
  
  return scopedKey
}

/**
 * Parse a scoped key to extract its components
 * 
 * @param scopedKey - A scoped storage key
 * @returns The parsed scope and base key, or null if not a scoped key
 */
export function parseScopedKey(scopedKey: string): { scope: StorageScope; baseKey: string } | null {
  if (!scopedKey.startsWith('scoped:')) {
    return null
  }
  
  const parts = scopedKey.split(':')
  if (parts.length < 3) {
    return null
  }
  
  // Format: scoped:network[:accountId]:baseKey
  const network = parts[1]
  let accountId: string | undefined
  let baseKey: string
  
  if (parts.length === 3) {
    // scoped:network:baseKey
    baseKey = parts[2]
  } else if (parts.length === 4) {
    // scoped:network:accountId:baseKey
    accountId = parts[2]
    baseKey = parts[3]
  } else {
    // Handle base keys that contain colons
    accountId = parts[2]
    baseKey = parts.slice(3).join(':')
  }
  
  return {
    scope: { network, accountId },
    baseKey,
  }
}

// ─── Scoped Storage Operations ──────────────────────────────────────────────────

/**
 * Get a stored value with automatic scoping for sensitive keys
 * 
 * @param key - The preference key
 * @param scope - The storage scope
 * @param getFn - The underlying get function (e.g., getStoredValue)
 * @param options - Storage options
 */
export async function getScopedValue<T>(
  key: string,
  scope: StorageScope,
  getFn: (key: string) => Promise<T | null>,
  options: ScopedStorageOptions = {}
): Promise<T | null> {
  if (!isSensitiveKey(key)) {
    // Non-sensitive keys use global storage
    return getFn(key)
  }
  
  const scopedKey = generateScopedKey(key, scope, options)
  return getFn(scopedKey)
}

/**
 * Set a stored value with automatic scoping for sensitive keys
 * 
 * @param key - The preference key
 * @param value - The value to store
 * @param scope - The storage scope
 * @param setFn - The underlying set function (e.g., setStoredValue)
 * @param options - Storage options
 */
export async function setScopedValue<T>(
  key: string,
  value: T,
  scope: StorageScope,
  setFn: (key: string, value: T) => Promise<void>,
  options: ScopedStorageOptions = {}
): Promise<void> {
  if (!isSensitiveKey(key)) {
    // Non-sensitive keys use global storage
    return setFn(key, value)
  }
  
  const scopedKey = generateScopedKey(key, scope, options)
  return setFn(scopedKey, value)
}

/**
 * Remove a stored value with automatic scoping for sensitive keys
 * 
 * @param key - The preference key
 * @param scope - The storage scope
 * @param removeFn - The underlying remove function (e.g., removeStoredValue)
 * @param options - Storage options
 */
export async function removeScopedValue(
  key: string,
  scope: StorageScope,
  removeFn: (key: string) => Promise<void>,
  options: ScopedStorageOptions = {}
): Promise<void> {
  if (!isSensitiveKey(key)) {
    // Non-sensitive keys use global storage
    return removeFn(key)
  }
  
  const scopedKey = generateScopedKey(key, scope, options)
  return removeFn(scopedKey)
}

// ─── Migration Helpers ──────────────────────────────────────────────────────────

/**
 * Migrate existing global preferences to scoped storage
 * 
 * @param keys - Keys to migrate
 * @param scope - The target scope
 * @param getFn - The underlying get function
 * @param setFn - The underlying set function
 * @param removeFn - The underlying remove function
 * @returns Number of keys migrated
 */
export async function migrateToScopedStorage<T>(
  keys: string[],
  scope: StorageScope,
  getFn: (key: string) => Promise<T | null>,
  setFn: (key: string, value: T) => Promise<void>,
  removeFn: (key: string) => Promise<void>
): Promise<number> {
  let migrated = 0
  
  for (const key of keys) {
    if (!isSensitiveKey(key)) continue
    
    try {
      const value = await getFn(key)
      if (value !== null) {
        await setScopedValue(key, value, scope, setFn, { required: true })
        await removeFn(key)
        migrated++
      }
    } catch (error) {
      // Log error but continue with other keys
      console.warn(`Failed to migrate key ${key}:`, error)
    }
  }
  
  return migrated
}

/**
 * Clear all scoped data for a specific scope
 * 
 * @param scope - The scope to clear
 * @param getAllFn - Function to get all stored keys
 * @param removeFn - The underlying remove function
 * @returns Number of keys removed
 */
export async function clearScopedData(
  scope: StorageScope,
  getAllFn: () => Promise<string[]>,
  removeFn: (key: string) => Promise<void>
): Promise<number> {
  const validation = validateScope(scope)
  if (!validation.valid) {
    throw new Error(`Invalid scope: ${validation.error}`)
  }
  
  const allKeys = await getAllFn()
  const sanitizedNetwork = sanitizeScopeValue(scope.network)
  const prefix = `scoped:${sanitizedNetwork}`
  
  let removed = 0
  for (const key of allKeys) {
    if (key.startsWith(prefix)) {
      // Check if account-specific or network-specific
      if (scope.accountId) {
        const sanitizedAccountId = sanitizeScopeValue(scope.accountId)
        const accountPrefix = `${prefix}:${sanitizedAccountId}`
        if (key.startsWith(accountPrefix)) {
          await removeFn(key)
          removed++
        }
      } else {
        // Remove all keys for this network (no account specified)
        await removeFn(key)
        removed++
      }
    }
  }
  
  return removed
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Get the current scope from application state
 * This is a placeholder - should be implemented based on app context
 */
export function getCurrentScope(): StorageScope {
  // This should be implemented to get the current network and account
  // from the application state/context
  return {
    network: 'testnet', // Default fallback
    accountId: undefined,
  }
}

/**
 * Create a scope object from network and optional account ID
 */
export function createScope(network: string, accountId?: string): StorageScope {
  return { network, accountId }
}

// ─── Error Handling ─────────────────────────────────────────────────────────────

/**
 * Error types for scoped storage operations
 */
export class ScopedStorageError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_SCOPE' | 'UNSUPPORTED_ENVIRONMENT' | 'STORAGE_FAILURE' | 'VALIDATION_ERROR',
    public originalError?: Error
  ) {
    super(message)
    this.name = 'ScopedStorageError'
  }
}

/**
 * Check if the current environment supports scoped storage
 */
export function isScopedStorageSupported(): boolean {
  // Check if IndexedDB is available
  if (typeof indexedDB === 'undefined') {
    return false
  }
  
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return false
  }
  
  return true
}

/**
 * Safe wrapper for scoped storage operations with comprehensive error handling
 */
export async function safeScopedOperation<T>(
  operation: () => Promise<T>,
  fallback: () => Promise<T>,
  context: string
): Promise<T> {
  // Check environment support
  if (!isScopedStorageSupported()) {
    console.warn(`Scoped storage not supported in current environment for ${context}, using fallback`)
    return fallback()
  }
  
  try {
    return await operation()
  } catch (error) {
    const err = error as Error
    
    // Handle specific error types
    if (err.message?.includes('Invalid scope')) {
      throw new ScopedStorageError(
        `Invalid scope in ${context}: ${err.message}`,
        'INVALID_SCOPE',
        err
      )
    }
    
    if (err.message?.includes('IndexedDB') || err.name === 'QuotaExceededError') {
      console.warn(`Storage failure in ${context}, using fallback:`, err)
      return fallback()
    }
    
    // For unknown errors, try fallback
    console.warn(`Unexpected error in ${context}, attempting fallback:`, err)
    try {
      return await fallback()
    } catch (fallbackError) {
      throw new ScopedStorageError(
        `Both scoped and fallback operations failed for ${context}`,
        'STORAGE_FAILURE',
        fallbackError as Error
      )
    }
  }
}

/**
 * Validate preference value before storage
 */
export function validatePreferenceValue(key: string, value: unknown): { valid: boolean; error?: string } {
  if (value === undefined || value === null) {
    return { valid: false, error: 'Value cannot be null or undefined' }
  }
  
  // Specific validation for sensitive keys
  if (key.includes('confirmationEmail')) {
    if (typeof value !== 'string') {
      return { valid: false, error: 'Email must be a string' }
    }
    // Allow empty strings (no email set)
    if (value.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { valid: false, error: 'Invalid email format' }
    }
  }
  
  if (key.includes('requireEmailConfirmation')) {
    if (typeof value !== 'boolean') {
      return { valid: false, error: 'requireEmailConfirmation must be a boolean' }
    }
  }
  
  return { valid: true }
}
