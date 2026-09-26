# Scoped Storage Documentation

## Overview

The scoped storage system provides network and account-scoped isolation for sensitive preference keys to prevent cross-account leakage. This ensures that sensitive data (such as email addresses, authentication settings, and notification preferences) are properly isolated by network type and account identifier.

## Security Benefits

### Prevents Cross-Account Leakage
- Sensitive preference keys are now stored with network and account scope
- Data from one account cannot be accessed from another account
- Network-specific isolation prevents testnet data from leaking to mainnet

### Isolation Mechanism
- **Network-level isolation**: Data is separated by network (mainnet, testnet, futurenet, local, custom)
- **Account-level isolation**: Within each network, data is further separated by account ID
- **Global fallback**: Non-sensitive data continues to use global storage for efficiency

## Sensitive Keys

The following preference keys are classified as sensitive and automatically scoped:

### Transaction Confirmation
- `transactionConfirmation.confirmationEmail` - Email address for transaction confirmations
- `transactionConfirmation.requireEmailConfirmation` - Whether email confirmation is required

### Notification Preferences
- `notificationPreferences.pushEnabled` - Browser push notification settings per category
- `notificationPreferences.soundsEnabled` - Sound notification settings per category

## Usage

### Basic Usage

```typescript
import { createScope, loadScopedPreferences, saveScopedPreferences } from './lib/userPreferences'

// Create a scope for a specific network and account
const scope = createScope('mainnet', 'GABC123...')

// Load preferences with scope
const prefs = await loadScopedPreferences(scope)

// Save preferences with scope
await saveScopedPreferences({
  transactionConfirmation: {
    confirmationEmail: 'user@example.com',
    requireEmailConfirmation: true,
  },
}, scope)
```

### Network-Only Scope

```typescript
// Scope by network only (no account-specific isolation)
const networkScope = createScope('testnet')

await saveScopedPreferences({
  transactionConfirmation: {
    confirmationEmail: 'testnet@example.com',
  },
}, networkScope)
```

### Migration from Global Storage

```typescript
import { migrateToScopedStorage, createScope } from './lib/scopedStorage'
import { getStoredValue, setStoredValue, removeStoredValue } from './lib/storage'

const scope = createScope('mainnet', 'GABC123...')
const sensitiveKeys = [
  'transactionConfirmation.confirmationEmail',
  'transactionConfirmation.requireEmailConfirmation',
]

const migrated = await migrateToScopedStorage(
  sensitiveKeys,
  scope,
  getStoredValue,
  setStoredValue,
  removeStoredValue
)

console.log(`Migrated ${migrated} keys to scoped storage`)
```

## API Reference

### Scoped Storage Utilities

#### `createScope(network: string, accountId?: string): StorageScope`
Creates a storage scope object.

**Parameters:**
- `network`: Network identifier ('mainnet', 'testnet', 'futurenet', 'local', 'custom', or custom prefixed string)
- `accountId`: Optional account identifier for account-level isolation

**Returns:** `StorageScope` object

#### `validateScope(scope: StorageScope): { valid: boolean; error?: string }`
Validates a storage scope object.

**Returns:** Validation result with validity status and optional error message

#### `isSensitiveKey(key: string): boolean`
Checks if a preference key is sensitive and requires scoping.

**Returns:** `true` if the key is sensitive, `false` otherwise

#### `generateScopedKey(baseKey: string, scope: StorageScope, options?: ScopedStorageOptions): string`
Generates a scoped storage key for a preference.

**Parameters:**
- `baseKey`: The original preference key
- `scope`: The storage scope
- `options`: Optional configuration (required, allowGlobalFallback)

**Returns:** A scoped key string

### Preference Functions

#### `loadScopedPreferences(scope: StorageScope): Promise<UserPreferences>`
Loads user preferences with network/account scope for sensitive keys.

**Parameters:**
- `scope`: The storage scope

**Returns:** User preferences with sensitive keys scoped

#### `saveScopedPreferences(prefs: Partial<UserPreferences>, scope: StorageScope): Promise<UserPreferences>`
Saves preferences with network/account scope for sensitive keys.

**Parameters:**
- `prefs`: Preferences to save
- `scope`: The storage scope

**Returns:** User preferences with sensitive keys scoped

### Notification Preference Functions

#### `loadScopedNotificationPreferences(scope: StorageScope): Promise<NotificationPreferences>`
Loads notification preferences with network/account scope for sensitive keys.

**Parameters:**
- `scope`: The storage scope

**Returns:** Notification preferences with sensitive keys scoped

#### `saveScopedNotificationPreferences(prefs: Partial<NotificationPreferences>, scope: StorageScope): Promise<NotificationPreferences>`
Saves notification preferences with network/account scope for sensitive keys.

**Parameters:**
- `prefs`: Preferences to save
- `scope`: The storage scope

**Returns:** Notification preferences with sensitive keys scoped

## Error Handling

### ScopedStorageError

Custom error class for scoped storage operations with specific error codes:

- `INVALID_SCOPE`: The provided scope is invalid
- `UNSUPPORTED_ENVIRONMENT`: The current environment doesn't support scoped storage
- `STORAGE_FAILURE`: Storage operation failed
- `VALIDATION_ERROR`: Preference value validation failed

### Validation

The system includes comprehensive validation:

1. **Scope Validation**: Ensures network and account ID are valid
2. **Value Validation**: Validates email format, boolean types, etc.
3. **Environment Support**: Checks for IndexedDB availability
4. **Fallback Mechanism**: Gracefully falls back to global storage on errors

### Example Error Handling

```typescript
import { ScopedStorageError, saveScopedPreferences } from './lib/userPreferences'

try {
  await saveScopedPreferences(prefs, scope)
} catch (error) {
  if (error instanceof ScopedStorageError) {
    switch (error.code) {
      case 'INVALID_SCOPE':
        console.error('Invalid scope provided:', error.message)
        break
      case 'VALIDATION_ERROR':
        console.error('Invalid preference value:', error.message)
        break
      case 'UNSUPPORTED_ENVIRONMENT':
        console.error('Scoped storage not supported')
        break
      default:
        console.error('Storage error:', error.message)
    }
  }
}
```

## Compatibility

### Environment Requirements

- **Browser**: Modern browsers with IndexedDB support
- **Node.js**: Not supported (requires browser environment)
- **React Native**: May require polyfills for IndexedDB

### Fallback Behavior

When scoped storage is not available or fails:
- The system automatically falls back to global storage
- A warning is logged to the console
- Applications continue to function with reduced security isolation

### Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- IE11: Not supported (no IndexedDB)

## Migration Guide

### For Existing Applications

1. **Identify Sensitive Data**: Review your current preference keys
2. **Update Code**: Replace `loadPreferences`/`savePreferences` with scoped versions
3. **Migrate Existing Data**: Use the migration helper to move existing data
4. **Test**: Verify isolation between accounts and networks

### Migration Steps

```typescript
// 1. Identify current scope
const currentNetwork = getCurrentNetwork() // 'mainnet', 'testnet', etc.
const currentAccount = getCurrentAccount() // Account public key

// 2. Create scope
const scope = createScope(currentNetwork, currentAccount)

// 3. Migrate existing data
await migrateToScopedStorage(
  ['transactionConfirmation.confirmationEmail'],
  scope,
  getStoredValue,
  setStoredValue,
  removeStoredValue
)

// 4. Update application code to use scoped functions
const prefs = await loadScopedPreferences(scope)
```

### Backward Compatibility

The scoped storage system is designed to be backward compatible:

- Existing `loadPreferences` and `savePreferences` functions continue to work
- New scoped functions can be adopted incrementally
- Global storage is still used for non-sensitive preferences
- Applications can mix scoped and non-scoped operations during migration

## Security Considerations

### Data Isolation

- **Network Isolation**: Data is completely separated between networks
- **Account Isolation**: Data is separated between accounts within the same network
- **No Cross-Leakage**: Scoped keys cannot be accessed from different scopes

### Storage Key Format

Scoped keys use the format: `scoped:{network}[:{accountId}]:{baseKey}`

Examples:
- `scoped:mainnet:transactionConfirmation.confirmationEmail` (network-only)
- `scoped:mainnet:GABC123:transactionConfirmation.confirmationEmail` (network + account)

### Encryption

For additional security, consider combining scoped storage with the existing encrypted storage utilities:

```typescript
import { setEncryptedValue, getEncryptedValue } from './lib/storage'
import { generateScopedKey, createScope } from './lib/scopedStorage'

const scope = createScope('mainnet', 'GABC123')
const scopedKey = generateScopedKey('sensitive-data', scope)

// Store encrypted value with scope
await setEncryptedValue(scopedKey, plaintext, passphrase)

// Retrieve encrypted value with scope
const decrypted = await getEncryptedValue(scopedKey, passphrase)
```

## Performance Considerations

### Storage Overhead

- Scoped keys are slightly longer than global keys
- Additional storage lookups for sensitive keys
- Minimal performance impact for typical usage

### Optimization Recommendations

1. **Cache Scope**: Create scope objects once and reuse
2. **Batch Operations**: Group multiple preference updates
3. **Lazy Loading**: Load scoped preferences only when needed
4. **Non-Sensitive Data**: Use global storage for non-sensitive preferences

## Testing

### Unit Tests

Comprehensive unit tests are provided in:
- `src/lib/__tests__/scopedStorage.test.ts` - Core scoped storage utilities
- `src/lib/__tests__/userPreferencesScoped.test.ts` - Scoped user preferences

### Test Coverage

- Primary flow: Save, load, and remove scoped preferences
- Boundary cases: Empty values, concurrent operations, special characters
- Failure cases: Invalid scope, storage errors, validation failures

### Running Tests

```bash
# Run all scoped storage tests
npm test -- scopedStorage

# Run scoped user preferences tests
npm test -- userPreferencesScoped
```

## Troubleshooting

### Common Issues

**Issue**: Scoped preferences not loading
- **Solution**: Verify scope is valid and network/account ID are correct

**Issue**: Fallback to global storage occurring
- **Solution**: Check IndexedDB availability and browser support

**Issue**: Validation errors on save
- **Solution**: Ensure email format is valid and boolean values are correct type

**Issue**: Data not isolated between accounts
- **Solution**: Ensure account IDs are unique and properly provided in scope

### Debug Logging

Enable debug logging to troubleshoot scoped storage operations:

```typescript
// In development, scoped storage operations log warnings on fallback
// Check browser console for detailed error messages
```

## Future Enhancements

### Planned Features

1. **Additional Sensitive Keys**: Expand the set of automatically scoped keys
2. **Scope Inheritance**: Support for hierarchical scope inheritance
3. **Batch Migration**: Improved migration utilities for large datasets
4. **Metrics**: Storage usage metrics per scope
5. **Cleanup**: Automatic cleanup of orphaned scoped data

### Contributing

When adding new sensitive keys:

1. Update the `SENSITIVE_KEYS` set in `scopedStorage.ts`
2. Add corresponding tests
3. Update this documentation
4. Consider migration path for existing data

## License

This scoped storage system is part of the Stellar Dev Dashboard project and follows the same license terms.
