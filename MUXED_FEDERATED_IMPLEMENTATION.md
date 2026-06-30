# Issue #195: Muxed Addresses (M...) and Federated Address Resolution

## Implementation Summary

This implementation adds comprehensive support for Stellar muxed addresses (M...) and federated addresses (name*domain) across the dashboard.

### Changes Made

#### 1. **src/lib/stellar.ts** - Core Address Handling
Added new functions to handle multiple address formats:

**New Functions:**
- `isValidEd25519PublicKey(key)` - Validates G... Ed25519 keys
- `isValidMuxedAccount(key)` - Validates M... muxed accounts
- `isFederatedAddress(input)` - Validates name*domain federated addresses
- `parseMuxedAccount(muxedAddress)` - Extracts master account and muxed ID from M... addresses
- `resolveFederatedAddress(federatedAddress, network)` - Resolves federated addresses via Horizon federation endpoint
- `resolveAddress(input, network)` - Universal address resolver that:
  - Accepts G..., M..., or name*domain formats
  - Returns resolved account info with metadata
  - Returns `ResolvedAddress` interface containing:
    - `accountId`: The master account (always G...)
    - `muxedId`: Muxed ID if input was M...
    - `inputType`: 'ed25519' | 'muxed' | 'federated'
    - `federatedAddress`: Original federated address if applicable
    - `memoId`/`memoType`: From federation resolution

- `isValidPublicKey(key)` - Updated to accept all three formats (backward compatible)

**Exported Types:**
- `ResolvedAddress` interface for type-safe address resolution results

#### 2. **src/lib/validation.ts** - Input Validation
Enhanced `validateStellarAddress()` to support all three address formats:
- Added regex patterns for M... and name*domain validation
- Updated error message to reflect supported formats
- Maintains backward compatibility

#### 3. **src/components/dashboard/ConnectPanel.tsx** - UI Updates
- Imported `resolveAddress` function
- Added `AddressInfo` interface to track resolved address metadata
- Updated placeholder text to show all supported formats: "G... public key, M... muxed, or name*domain"
- Updated error messages to mention all supported formats
- Added address resolution step before fetching account data
- Displays master account, muxed ID, and federated address info when applicable
- Shows resolved address information below input field with cyan styling

**UI Enhancements:**
- Added visual display of muxed ID when applicable
- Added visual display of federated address when applicable
- Improved placeholder text: "G... public key, M... muxed, or name*domain"
- Descriptive subtitle: "Enter a Stellar address: G... • M... • name*domain"

#### 4. **src/components/preferences/AddressBook.jsx** - Address Book
- Updated placeholder text: "G... public key, M... muxed, or name*domain federated"
- Updated error message to reflect all supported formats
- Validation now uses enhanced `isValidPublicKey()` function

#### 5. **src/components/dashboard/AccountComparison.jsx** - Account Comparison
- Imported `resolveAddress` function
- Updated `handleFetch()` to:
  - Resolve addresses before fetching account data
  - Store muxed ID and federated address info with account data
  - Use master account for data fetching
  - Graceful error handling for unresolvable addresses

### Features

✅ **Muxed Account Support (M...)**
- Validates M... muxed addresses
- Extracts and displays muxed ID alongside master account
- Loads underlying account data for the master account
- Works with ConnectPanel, AddressBook, and AccountComparison

✅ **Federated Address Support (name*domain)**
- Validates federated address format
- Resolves via Horizon federation endpoint with fallback logic
- Caches federation lookup results
- Handles TOML-based federation server configuration
- Works across all address input components

✅ **Backward Compatibility**
- All existing code using `isValidPublicKey()` continues to work
- G... addresses work exactly as before
- No breaking changes to existing APIs

✅ **User Experience**
- Clear error messages explaining supported formats
- Visual display of resolved address components (master account, muxed ID, federated address)
- Consistent validation across all address input fields
- Improved placeholder text at all input points

### Technical Details

**Federation Resolution:**
1. Fetches stellar.toml from domain
2. Parses FEDERATION_SERVER URL from TOML
3. Falls back to Horizon federation endpoint if TOML lookup fails
4. Returns account ID and optional memo information

**Address Resolution Flow:**
1. Check if Ed25519 public key (G...)
2. Check if muxed account (M...)
3. Check if federated address (name*domain)
4. For muxed: Extract master account and muxed ID
5. For federated: Resolve via federation endpoint
6. Return normalized result with metadata

### Acceptance Criteria Met

✅ Valid M... or user*example.com connects and loads underlying account data
✅ UI shows both muxed ID and master G-address where applicable
✅ Federated resolution works via stellar.toml / Horizon federation endpoint
✅ All three address formats work across ConnectPanel, AddressBook, and AccountComparison

### Testing

Unit tests created in `tests/unit/stellar-addresses.test.js`:
- Ed25519 validation (G...)
- Muxed account validation (M...)
- Federated address validation
- Muxed account parsing
- Universal address validation
- Address resolution

### Files Modified

- `/src/lib/stellar.ts` - Added address resolution functions
- `/src/lib/validation.ts` - Enhanced address validation
- `/src/components/dashboard/ConnectPanel.tsx` - Added address resolution UI
- `/src/components/preferences/AddressBook.jsx` - Updated validation and placeholders
- `/src/components/dashboard/AccountComparison.jsx` - Added address resolution support
- `/tests/unit/stellar-addresses.test.js` - New test suite (created)
