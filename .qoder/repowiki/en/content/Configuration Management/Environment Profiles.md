# Environment Profiles: Testnet and Mainnet Configuration

## Overview

The Stellar Dev Dashboard supports named environment profiles that allow developers to switch between Testnet, Mainnet, and custom network configurations without manual edits. This feature simplifies development workflows and reduces configuration errors.

## Built-in Profiles

The dashboard comes with two pre-configured environment profiles:

### Testnet (Official)
- **ID**: `testnet-official`
- **Horizon URL**: `https://horizon-testnet.stellar.org`
- **Soroban RPC URL**: `https://soroban-testnet.stellar.org`
- **Passphrase**: `Test SDF Network ; September 2015`
- **Faucet**: `https://friendbot.stellar.org`
- **Use Case**: Development and testing

### Mainnet (Official)
- **ID**: `mainnet-official`
- **Horizon URL**: `https://horizon.stellar.org`
- **Soroban RPC URL**: `https://soroban-rpc.stellar.org`
- **Passphrase**: `Public Global Stellar Network ; September 2015`
- **Use Case**: Production deployments

## Switching Profiles

### Via Code

```typescript
import { switchEnvironmentProfile, getActiveEnvironmentProfile } from './lib/environmentProfiles';

// Switch to mainnet
switchEnvironmentProfile('mainnet-official');

// Get current active profile
const active = getActiveEnvironmentProfile();
console.log(active.horizonUrl); // https://horizon.stellar.org
```

### Via UI (Hook into useSettings)

```typescript
import { useSettings } from './hooks/useSettings';

function EnvironmentSwitcher() {
  const { saveProfile, activeProfileName } = useSettings();
  
  const handleSwitch = (profileId: string) => {
    switchEnvironmentProfile(profileId);
    // UI updates automatically
  };

  return (
    <select value={activeProfileName} onChange={(e) => handleSwitch(e.target.value)}>
      <option value="testnet-official">Testnet</option>
      <option value="mainnet-official">Mainnet</option>
    </select>
  );
}
```

## Creating Custom Profiles

Developers can create custom environment profiles for private networks, staging environments, or alternative RPC endpoints:

```typescript
import { createEnvironmentProfile } from './lib/environmentProfiles';

const customProfile = createEnvironmentProfile({
  name: 'My Staging Environment',
  type: 'testnet', // or 'mainnet'
  horizonUrl: 'https://horizon-staging.example.com',
  sorobanUrl: 'https://soroban-staging.example.com',
  passphrase: 'My Staging Network ; 2026',
  faucetUrl: 'https://faucet-staging.example.com', // optional
  description: 'Private staging network for pre-production testing'
});

console.log(customProfile.id); // custom-1234567890-abc123
```

## Validation & Error Handling

All profiles are validated for:
- **Required fields**: name, type, horizonUrl, sorobanUrl, passphrase
- **Valid URLs**: All endpoint URLs must be parseable by `URL()` constructor
- **Supported types**: Only `'testnet'` or `'mainnet'` are allowed
- **Unique names**: Profile names must be unique within the dashboard

### Common Validation Errors

```typescript
// Missing required field
validateEnvironmentProfile({ name: '', type: 'testnet', /* ... */ });
// Error: "Profile name is required and must be a non-empty string"

// Invalid URL format
validateEnvironmentProfile({
  name: 'Test',
  type: 'testnet',
  horizonUrl: 'not-a-valid-url', // ❌
  // ...
});
// Error: "Horizon URL must be a valid URL"

// Invalid environment type
validateEnvironmentProfile({
  name: 'Test',
  type: 'staging', // ❌ only 'testnet' or 'mainnet'
  // ...
});
// Error: 'Profile type must be either "testnet" or "mainnet"'
```

## API Reference

### Core Functions

#### `loadEnvironmentProfiles(): EnvironmentProfile[]`
Loads all environment profiles (built-in + custom). Built-in profiles are always available; custom profiles are loaded from localStorage.

#### `getActiveEnvironmentProfile(): EnvironmentProfile`
Returns the currently active environment profile. Defaults to `testnet-official` if not set.

#### `switchEnvironmentProfile(profileId: string): EnvironmentProfile`
Switches to the specified profile and updates global network configuration. Throws if profile not found.

#### `createEnvironmentProfile(profile: Omit<...>): EnvironmentProfile`
Creates a new custom environment profile. Throws if validation fails or name already exists.

#### `updateEnvironmentProfile(profileId: string, updates: Partial<...>): EnvironmentProfile`
Updates an existing profile's properties. Throws if profile not found or validation fails.

#### `deleteEnvironmentProfile(profileId: string): void`
Deletes a custom profile. Throws if:
- Profile is a built-in profile
- Profile is currently active
- Profile doesn't exist

#### `getEnvironmentProfile(profileId: string): EnvironmentProfile | null`
Returns a profile by ID or null if not found.

#### `getProfilesByType(type: EnvironmentType): EnvironmentProfile[]`
Returns all profiles of a specified type ('testnet' or 'mainnet').

### Validation Functions

#### `validateEnvironmentProfile(profile: Partial<EnvironmentProfile>): void`
Validates profile structure. Throws with detailed error messages if invalid.

#### `isSupportedEnvironment(type: EnvironmentType): boolean`
Checks if an environment type is supported.

## Migration Notes

### From Manual Configuration
If you were previously manually updating network endpoints in code:

**Before:**
```typescript
// Old way - direct modification
NETWORKS.testnet.horizonUrl = 'custom-horizon';
NETWORKS.mainnet.horizonUrl = 'another-custom';
```

**After:**
```typescript
// New way - use profiles
const profile = createEnvironmentProfile({
  name: 'My Custom Testnet',
  type: 'testnet',
  horizonUrl: 'custom-horizon',
  sorobanUrl: 'custom-soroban',
  passphrase: 'My Network',
});
switchEnvironmentProfile(profile.id);
```

### Storage & Persistence
- Built-in profiles are not stored (always available)
- Custom profiles are stored in localStorage under key `env-profiles`
- Active profile ID is stored under key `active-env-profile`
- Data persists across browser sessions automatically

## Security Considerations

### Production Networks
- When switching to **Mainnet**, the dashboard should display prominent warnings
- Consider integrating with `MainnetReviewModal` component for transaction confirmation
- Never hardcode Mainnet credentials in custom profiles

### Custom Networks
- Validate that RPC endpoints are trusted before creating profiles
- Don't store sensitive API keys in profile descriptions
- Use environment headers separately if authentication is required

## Compatibility

| Feature | Testnet | Mainnet | Custom |
|---------|---------|---------|--------|
| Built-in | ✅ | ✅ | ❌ |
| User-creatable | ❌ | ❌ | ✅ |
| Deletable | ❌ | ❌ | ✅ |
| Editable | ❌ | ❌ | ✅ |
| Switchable | ✅ | ✅ | ✅ |

## Troubleshooting

### Profile Not Persisting
- Check browser localStorage is enabled
- Clear localStorage and recreate the profile
- Check browser DevTools > Application > Storage > Local Storage

### Profile Not Found Error
- Verify the profile ID is correct: `getEnvironmentProfile(id)`
- Check active profiles: `loadEnvironmentProfiles()`
- Built-in profiles have IDs: `testnet-official` and `mainnet-official`

### Switching Fails
- Ensure profile exists before switching
- Built-in profiles cannot be deleted; custom profiles must be switched before deletion
- Check console for validation errors

## Examples

### Development Workflow
```typescript
// Start with testnet for development
switchEnvironmentProfile('testnet-official');

// Create a staging profile for team testing
const staging = createEnvironmentProfile({
  name: 'Team Staging',
  type: 'testnet',
  horizonUrl: 'https://staging.example.com',
  sorobanUrl: 'https://staging-soroban.example.com',
  passphrase: 'Staging Network ; 2026'
});

// Switch between profiles as needed
switchEnvironmentProfile(staging.id);
switchEnvironmentProfile('testnet-official');

// Update profile when endpoints change
updateEnvironmentProfile(staging.id, {
  horizonUrl: 'https://new-staging.example.com'
});
```

### Filtering by Type
```typescript
// Get all testnet profiles (built-in + custom)
const testnetProfiles = getProfilesByType('testnet');
testnetProfiles.forEach(p => console.log(p.name));
// Output: "Testnet (Official)", "My Custom Testnet", etc.

// Get default profile for type
const defaultTestnet = getDefaultProfileForType('testnet');
```

## Related Features

- [User Preferences](./Internationalization%20&%20Localization/Internationalization%20&%20Localization.md) - Store profile preferences
- [Network Configuration](../Core%20Features/Core%20Features.md) - Network settings overview
- [Custom Networks (Issue #188)](../Core%20Features/Core%20Features.md) - Advanced network profile management
