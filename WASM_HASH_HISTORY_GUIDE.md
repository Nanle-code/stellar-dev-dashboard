# WASM Hash History & Authorization Tracking Guide

## Overview

The Stellar Dev Dashboard now includes comprehensive visualization tools for tracking contract upgrades, WASM hashes, and authorization requirements. This guide explains how to use these features effectively.

## Features

### WASM Hash History

The WASM Hash History feature provides:

- **Historical Tracking**: Automatic tracking of all WASM hashes associated with contract upgrades
- **Advanced Filtering**: Search and filter by contract ID, WASM hash, or network
- **Data Export**: Export upgrade history as JSON for external analysis
- **Transaction Links**: Direct links to block explorers for verification
- **Local Storage**: All data stored locally in your browser for privacy

### Authorization Requirements Display

The Authorization Requirements component shows:

- **Current Status**: Real-time authorization status (public, admin, owner, multisig, custom)
- **Severity Indicators**: Color-coded severity levels (safe, low, medium, high, critical)
- **Change History**: Track authorization requirement changes across upgrades
- **Network Context**: Separate tracking per network (testnet, mainnet, public, custom)

## Accessing the Features

### Via Contracts Panel

1. Navigate to the **Contracts** panel in the dashboard
2. Click the **📜 WASM History** tab
3. View and manage your WASM hash history
4. When a contract is selected, authorization requirements are displayed below

### Via Contract History Panel

1. Navigate to the **Contract History** panel
2. Filter by a specific contract ID
3. Recent WASM hashes are displayed in a collapsible section
4. Click "Show" to view the latest upgrade history for that contract

## Usage Examples

### Tracking Contract Upgrades

When you perform a contract upgrade:

```typescript
import { trackWasmHash } from '@/lib/wasmTracker';

// After successful upgrade transaction
await trackWasmHash({
  contractId: 'CCY737I6XABK7KXYYJUZM7XKL7CMJ6DKFZDVUQJL5HJITILFIQ5B3Q',
  wasmHash: 'abc123def456789...',
  transactionHash: 'tx_hash_from_upgrade...',
  authorization: 'admin',
  network: 'testnet',
});
```

### Viewing Authorization Requirements

The authorization panel automatically displays when you:

1. Select a contract in the Contracts panel
2. View WASM history for a specific contract
3. Use the standalone AuthorizationRequirements component

### Filtering WASM History

1. Click "Show Filters" in the WASM Hash History panel
2. Enter contract ID or WASM hash to filter
3. Click "Clear Filters" to reset
4. Results update automatically

### Exporting History

1. Navigate to WASM Hash History
2. Click the "Export" button
3. JSON file downloads with current history
4. Use for backup, analysis, or sharing

## Security Considerations

### Authorization Severity Levels

- **Safe**: No authorization required (public access)
- **Low**: Custom authorization with minimal restrictions
- **Medium**: Multi-signature requirements
- **High**: Owner-level authorization required
- **Critical**: Admin-level authorization required

### Best Practices

1. **Review Before Upgrade**: Always check current authorization requirements before upgrading
2. **Monitor Changes**: Pay attention to authorization requirement changes during upgrades
3. **Validate Links**: Use transaction explorer links to verify upgrades on-chain
4. **Regular Cleanup**: Periodically clear old history to manage storage
5. **Export Backups**: Regularly export history for backup purposes

## Compatibility & Requirements

### Browser Requirements

- **IndexedDB Support**: Required for local history storage
- **Modern Browser**: Chrome, Firefox, Safari, Edge (latest versions)
- **JavaScript Enabled**: Required for all interactive features

### Fallback Behavior

If IndexedDB is not supported:

- WASM history displays in read-only mode
- No local storage of upgrade data
- Export functionality still works for current session data
- Authorization requirements display remains functional

### Network Support

- **Testnet**: Full support with automatic tracking
- **Mainnet**: Full support with enhanced security warnings
- **Public Network**: Full support with appropriate network context
- **Custom Networks**: Full support with user-defined configuration

## Migration Notes

### Existing Users

- **No Breaking Changes**: Existing contract interactions are not affected
- **Automatic Migration**: IndexedDB schema upgrades automatically
- **Data Preservation**: Existing contract history remains intact
- **New Features**: Available immediately after update

### New Users

- **Default Behavior**: WASM tracking enabled by default
- **Storage**: Uses browser IndexedDB automatically
- **Privacy**: All data stored locally, no external transmission
- **Configuration**: No additional setup required

## Troubleshooting

### Common Issues

#### WASM History Not Showing

**Possible Causes:**
- IndexedDB not supported in browser
- Storage quota exceeded
- Privacy settings blocking storage

**Solutions:**
- Check browser compatibility
- Clear old history to free space
- Review browser privacy settings

#### Authorization Not Displaying

**Possible Causes:**
- Invalid network specified
- Missing contract ID
- Component not properly integrated

**Solutions:**
- Verify network parameter (testnet, mainnet, public, custom)
- Ensure contract ID is provided
- Check component integration

#### Export Failing

**Possible Causes:**
- No history to export
- Browser security restrictions
- Corrupted data

**Solutions:**
- Ensure history exists before exporting
- Check browser download permissions
- Clear and rebuild history if corrupted

### Error Messages

#### "IndexedDB not supported in this environment"

**Meaning:** Your browser doesn't support IndexedDB
**Impact:** Read-only mode, no local storage
**Solution:** Use a modern browser with IndexedDB support

#### "Invalid network specified"

**Meaning:** Network parameter is not valid
**Impact:** Authorization display won't render
**Solution:** Use valid network: testnet, mainnet, public, or custom

#### "Storage quota exceeded"

**Meaning:** Browser storage limit reached
**Impact:** Cannot store new WASM records
**Solution:** Clear old history or increase browser storage quota

## API Reference

### Storage Functions

```typescript
// Add a WASM hash record
await addWasmHashRecord({
  id: string,
  contractId: string,
  wasmHash: string,
  transactionHash: string,
  authorization: string,
  timestamp: number,
  network: string,
});

// Get WASM hash history
const history = await getWasmHashHistory({
  contractId?: string,
  wasmHash?: string,
  network?: string,
});

// Clear all history
await clearWasmHashHistory();
```

### Tracker Functions

```typescript
// Track a WASM hash (with validation)
await trackWasmHash({
  contractId: string,
  wasmHash: string,
  transactionHash: string,
  authorization?: string,
  network?: string,
});

// Extract WASM from transaction
const wasmInfo = extractWasmFromUpgradeTransaction(transaction);

// Check if transaction is an upgrade
const isUpgrade = isContractUpgradeTransaction(transaction);
```

### Component Props

#### WasmHashHistory

```typescript
<WasmHashHistory />
// No props required - uses global store for network
```

#### AuthorizationRequirements

```typescript
<AuthorizationRequirements
  contractId?: string
  wasmHash?: string
  upgradeAuth?: string
  network?: string
  historicalData?: Array<{
    wasmHash: string
    authorization: string
    timestamp: number
  }>
/>
```

## Performance Considerations

### Storage Management

- **Record Size**: Each WASM record is approximately 200-500 bytes
- **Capacity**: Browser IndexedDB typically allows 50MB-5GB depending on browser
- **Cleanup**: Implement periodic cleanup for long-running applications
- **Pagination**: History display uses pagination for large datasets

### Memory Usage

- **Component Memory**: Minimal (~2-5MB for typical usage)
- **Filtering Performance**: O(n) complexity, handles thousands of records efficiently
- **Export Memory**: Temporary memory usage during JSON generation

## Future Enhancements

Planned improvements include:

- **Cloud Sync**: Optional cloud backup for WASM history
- **Multi-device Support**: Sync history across devices
- **Advanced Analytics**: Upgrade pattern analysis and insights
- **Collaboration Features**: Share upgrade histories with teams
- **Integration**: Enhanced integration with contract deployment tools

## Support & Feedback

For issues, questions, or feedback:

1. Check this guide for common solutions
2. Review the troubleshooting section
3. Check browser compatibility requirements
4. Report bugs via the project's issue tracker
5. Request features via the project's feature request process

## Changelog

### Version 1.0.0 (Current)

- Initial WASM hash history tracking
- Authorization requirements visualization
- IndexedDB storage implementation
- Filter and export functionality
- Comprehensive error handling
- Full test coverage
- Documentation and guides
