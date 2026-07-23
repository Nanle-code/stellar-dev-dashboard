# Developer Tools Implementation Guide

This document describes the four major developer tools implemented in this update:

## Implemented Features

### 1. Advanced Keyboard Shortcuts & Command Palette (#426 - D-023)

**Location:** `src/lib/keyboard/shortcuts.ts`, `src/components/keyboard/`

**Features:**
- **Command Palette**: Open with `Cmd/Ctrl+K` for fuzzy search across all commands
- **50+ Default Shortcuts**: Navigation, actions, view controls, utilities
- **Context-Aware Shortcuts**: Shortcuts that only work in specific contexts
- **Conflict Detection**: Automatic detection of shortcut conflicts (browser and OS)
- **Customization**: Import/export shortcut configurations
- **Shortcut Cheat Sheet**: Press `?` to view all available shortcuts
- **Progressive Disclosure**: Show shortcuts on hover for learning mode

**Usage:**
- `Cmd/Ctrl+K` - Open command palette
- `?` - Show keyboard shortcuts cheat sheet
- `g + o` - Go to Overview
- `g + a` - Go to Account
- `g + t` - Go to Transactions
- `Ctrl+Shift+L` - Toggle Log Monitor
- `Ctrl+Shift+T` - Toggle Time Travel Debugger
- `Ctrl+Shift+/` - Show Keyboard Shortcuts

### 2. Advanced State Management with Time Travel Debugging (#428 - D-025)

**Location:** `src/lib/state/timeTravel.ts`, `src/components/state/TimeTravelDebugger.tsx`

**Features:**
- **State History Recording**: Automatic recording of all state changes
- **Time Travel Controls**: Undo/redo navigation through state history
- **State Diff Visualization**: Visual diff between any two state snapshots
- **Analytics Dashboard**: State change frequency, size tracking, performance metrics
- **Persistence**: Save state snapshots and restore from snapshots
- **Export/Import**: Export entire state history as JSON for analysis
- **Rollback**: Rollback to any previous state with validation

**Usage:**
- Open Time Travel Debugger with `Ctrl+Shift+T`
- Navigate history timeline with arrow keys or click
- View state diffs between any two snapshots
- Export state history for offline analysis
- Rollback to previous states when debugging

### 3. Comprehensive Logging and Monitoring System (#429 - D-026)

**Location:** `src/lib/logging/logger.ts`, `src/lib/logging/logMonitor.tsx`

**Features:**
- **Structured Logging**: Multiple log levels (DEBUG, INFO, WARN, ERROR, CRITICAL)
- **Correlation IDs**: Track related operations across logs
- **Central Log Storage**: In-memory log storage with configurable max size
- **Log Filtering**: Filter by level, correlation ID, user, session, tags, time range
- **Real-time Log Viewer**: Live log monitoring with auto-scroll
- **Log Analytics**: Log frequency, tag distribution, time range analysis
- **Export Capabilities**: Export logs as JSON for external analysis
- **Error Tracking**: Integrated error tracking with context preservation

**Usage:**
```typescript
import { logger } from './lib/logging/logger';

// Basic logging
logger.info('User connected', { userId: '123' });
logger.error('Transaction failed', { txId: 'abc' }, ['transaction'], error);

// With correlation ID
logger.setCorrelationId('req-123');
logger.debug('Processing request');

// Filter logs
const logs = logger.getLogs({ level: LogLevel.ERROR, search: 'failed' });

// Export logs
const data = logger.exportLogs();
```

### 4. Advanced Form Validation and Error Handling (#430 - D-027)

**Location:** `src/lib/validation/validators.ts`, `src/hooks/useFormValidation.ts`, `src/components/validation/`

**Features:**
- **Composable Validators**: Chain multiple validators together
- **Real-time Validation**: Debounced validation as user types
- **Inline Error Display**: Show errors inline with ARIA attributes
- **Form State Management**: Track dirty/touched fields, form validity
- **Auto-save**: Automatically save form data to localStorage
- **Accessibility**: Full ARIA support, error announcements, keyboard navigation
- **Custom Validators**: Create custom validators for specific use cases
- **Async Validation**: Support for asynchronous validation (e.g., API checks)

**Built-in Validators:**
- `required` - Field must have a value
- `minLength(min)` - Minimum length check
- `maxLength(max)` - Maximum length check
- `pattern(regex, message)` - Regex pattern matching
- `email` - Email format validation
- `url` - URL format validation
- `stellarPublicKey` - Stellar public key format
- `stellarSecretKey` - Stellar secret key format
- `number` - Numeric value validation
- `min(value)` - Minimum value check
- `max(value)` - Maximum value check
- `oneOf(values)` - Value must be in allowed list

**Usage:**
```typescript
import { useFormValidation, compose, required, stellarPublicKey, minLength } from './hooks/useFormValidation';

const { state, addValidator, setFieldValue, validateForm } = useFormValidation(
  { publicKey: '' },
  { autoSave: true, autoSaveKey: 'connect-form' }
);

// Add validators
addValidator('publicKey', compose(
  required,
  stellarPublicKey,
  minLength(56)
));

// Use in component
<ValidatedInput
  name="publicKey"
  value={state.values.publicKey}
  onChange={(value) => setFieldValue('publicKey', value)}
  error={state.errors.publicKey}
  touched={state.touched.publicKey}
  label="Public Key"
  required
/>
```

## Integration

All four systems are integrated through the `DeveloperTools` component in `src/components/DeveloperTools.tsx`, which is included in the main App component.

## Keyboard Shortcuts Reference

### Navigation
- `g + o` - Go to Overview
- `g + a` - Go to Account
- `g + t` - Go to Transactions
- `g + c` - Go to Contracts
- `g + n` - Go to Network Stats

### Actions
- `c` - Connect Account
- `d` - Disconnect
- `r` - Refresh Data
- `/` - Search

### View
- `t` - Toggle Theme
- `s` - Toggle Sidebar
- `l` - Toggle Log Monitor

### Developer Tools
- `Ctrl+Shift+L` - Toggle Log Monitor
- `Ctrl+Shift+T` - Toggle Time Travel Debugger
- `Ctrl+Shift+/` - Show Keyboard Shortcuts
- `Cmd/Ctrl+K` - Open Command Palette
- `?` - Show Keyboard Shortcuts

### Utility
- `Escape` - Close/Escape
- `Ctrl+C` - Copy

## Architecture Decisions

1. **Modular Design**: Each system is independent and can be used standalone
2. **TypeScript**: Core logic files use TypeScript for type safety
3. **Performance**: Debounced validation, efficient log storage, lazy loading
4. **Accessibility**: Full ARIA support, keyboard navigation, screen reader compatibility
5. **Extensibility**: Easy to add new validators, shortcuts, log levels

## Future Enhancements

- Add more validators for Stellar-specific data
- Implement shortcut presets for different user profiles
- Add remote log aggregation for production monitoring
- Enhance time travel with state branching
- Add visual diff viewer for state changes
- Implement collaborative debugging sessions
