# Environment Profiles Integration Guide

## Overview

Multi-environment configuration profiles enable developers to switch between Testnet, Mainnet, and custom network configurations without manual edits.

## Implementation Summary

### Core Module: `src/lib/environmentProfiles.ts`
- **Built-in profiles**: Testnet (Official) and Mainnet (Official)
- **Profile management**: Create, update, delete, switch profiles
- **Validation**: Validates all profiles for URL format, required fields, and environment type
- **Storage**: Persists custom profiles in localStorage; built-in profiles always available
- **Error handling**: Clear error messages for invalid input, unsupported environments, and deletion constraints

### React Hook: `src/hooks/useEnvironmentProfiles.ts`
- **State management**: Reactive loading and switching of profiles
- **Error handling**: Captures and reports errors to components
- **Filtering**: Methods to get profiles by type (testnet/mainnet)

### UI Component: `src/components/settings/EnvironmentProfileSwitcher.tsx`
- **Profile dropdown**: Switch between Testnet and Mainnet
- **Status indicator**: Shows current active profile with type badge
- **Styling**: Included CSS with light/dark mode support

## Key Features

### 1. Profile Switching
```typescript
import { switchEnvironmentProfile, getActiveEnvironmentProfile } from './lib/environmentProfiles';

// Switch to mainnet
switchEnvironmentProfile('mainnet-official');

// Get current profile
const profile = getActiveEnvironmentProfile();
console.log(profile.horizonUrl); // https://horizon.stellar.org
```

### 2. Custom Profiles
```typescript
import { createEnvironmentProfile } from './lib/environmentProfiles';

const staging = createEnvironmentProfile({
  name: 'Team Staging',
  type: 'testnet',
  horizonUrl: 'https://staging.example.com',
  sorobanUrl: 'https://staging-soroban.example.com',
  passphrase: 'Staging Network ; 2026'
});
```

### 3. Validation
```typescript
import { validateEnvironmentProfile } from './lib/environmentProfiles';

try {
  validateEnvironmentProfile(profileData);
  // Profile is valid
} catch (error) {
  // Profile validation failed
  console.error(error.message);
}
```

### 4. React Integration
```typescript
import { useEnvironmentProfiles } from './hooks/useEnvironmentProfiles';

function MyComponent() {
  const { activeProfile, switchProfile, testnetProfiles, mainnetProfiles } = useEnvironmentProfiles();

  return (
    <>
      <p>Active: {activeProfile?.name}</p>
      <button onClick={() => switchProfile('mainnet-official')}>
        Switch to Mainnet
      </button>
    </>
  );
}
```

## Test Coverage

**File**: `src/lib/tests/environmentProfiles.test.ts`

### Primary Flow
- ✅ Load default profiles
- ✅ Set active profile (testnet/mainnet)
- ✅ Switch between profiles
- ✅ Persist active profile across sessions
- ✅ Create and switch to custom profiles

### Boundary Cases
- ✅ Handle profile not found
- ✅ Fallback when active profile is deleted
- ✅ Merge user and built-in profiles
- ✅ Filter profiles by type
- ✅ Get default profile for type

### Failure Cases
- ✅ Reject invalid profile name, type, URLs
- ✅ Reject duplicate profile names
- ✅ Reject switching to non-existent profile
- ✅ Prevent deletion of built-in profiles
- ✅ Prevent deletion of active profile
- ✅ Collect multiple validation errors

## API Reference

### Core Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `loadEnvironmentProfiles()` | Load all profiles (built-in + custom) | `EnvironmentProfile[]` |
| `getActiveEnvironmentProfile()` | Get currently active profile | `EnvironmentProfile` |
| `switchEnvironmentProfile(id)` | Switch to a profile | `EnvironmentProfile` |
| `createEnvironmentProfile(profile)` | Create new profile | `EnvironmentProfile` |
| `updateEnvironmentProfile(id, updates)` | Update existing profile | `EnvironmentProfile` |
| `deleteEnvironmentProfile(id)` | Delete custom profile | `void` |
| `getEnvironmentProfile(id)` | Get profile by ID | `EnvironmentProfile \| null` |
| `getProfilesByType(type)` | Get profiles by type | `EnvironmentProfile[]` |
| `validateEnvironmentProfile(profile)` | Validate profile | `void` (throws on error) |

### Interfaces

```typescript
interface EnvironmentProfile {
  id: string;
  name: string;
  type: 'testnet' | 'mainnet';
  horizonUrl: string;
  sorobanUrl: string;
  passphrase: string;
  faucetUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Storage & Persistence

- **Storage Key**: `env-profiles` (localStorage) - stores only custom profiles
- **Active Profile Key**: `active-env-profile` (localStorage)
- **Built-in profiles**: Hardcoded, never stored
- **Data persists**: Across browser sessions automatically

## Validation Rules

All profiles must have:
- ✅ Non-empty name (string)
- ✅ Type: `'testnet'` or `'mainnet'`
- ✅ Valid URLs for Horizon and Soroban endpoints
- ✅ Non-empty passphrase
- ✅ Optional: faucetUrl (if provided, must be valid URL)
- ✅ Unique names (no duplicates)

## Error Handling

### Common Errors

```
"Profile name is required and must be a non-empty string"
"Profile type must be either 'testnet' or 'mainnet'"
"Horizon URL must be a valid URL"
"Soroban URL must be a valid URL"
"Profile with name 'X' already exists"
"Environment profile not found: X"
"Cannot delete built-in environment profile"
"Cannot delete the active environment profile"
```

## Security Notes

1. **Production Networks**: Display warnings when switching to Mainnet
2. **Custom Networks**: Validate RPC endpoints before creating profiles
3. **No Credentials**: Don't store sensitive API keys in profile data
4. **Headers Management**: Use separate auth header system if needed

## File Structure

```
src/
├── lib/
│   ├── environmentProfiles.ts          # Core module (main implementation)
│   └── tests/
│       └── environmentProfiles.test.ts # Test suite (95+ tests)
├── hooks/
│   └── useEnvironmentProfiles.ts       # React hook for state management
└── components/
    └── settings/
        ├── EnvironmentProfileSwitcher.tsx  # UI component
        └── EnvironmentProfileSwitcher.css  # Styles
```

## Documentation

Full developer guide: `.qoder/repowiki/en/content/Configuration Management/Environment Profiles.md`

## Running Tests

```bash
# Run tests
pnpm test src/lib/tests/environmentProfiles.test.ts

# Run tests in watch mode
pnpm test:watch src/lib/tests/environmentProfiles.test.ts

# Run tests with coverage
pnpm test:coverage src/lib/tests/environmentProfiles.test.ts
```

## Migration Path

### From Manual Configuration
```typescript
// Old: Manual endpoint updates
NETWORKS.testnet.horizonUrl = 'custom-url';

// New: Use profiles
createEnvironmentProfile({
  name: 'Custom Testnet',
  type: 'testnet',
  horizonUrl: 'custom-url',
  sorobanUrl: 'custom-soroban-url',
  passphrase: 'My Network'
});
```

## Acceptance Criteria Checklist

- ✅ Named environment profiles for Testnet and Mainnet switching
- ✅ Developers can switch profiles without manual edits
- ✅ Invalid input handling with clear error messages
- ✅ Unsupported environment rejection
- ✅ Failure paths covered (deletion, switching, validation)
- ✅ Automated tests: primary flow, boundary cases, failure cases
- ✅ Developer documentation with examples and migration notes
- ✅ Compatibility matrix (what can be created, modified, deleted)
- ✅ Security considerations documented

## Next Steps

1. Integrate `EnvironmentProfileSwitcher` component into settings UI
2. Wire up with existing settings/preferences system
3. Add mainnet warning modal integration
4. Deploy and monitor usage patterns
