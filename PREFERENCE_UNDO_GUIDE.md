# Reversible Preference Changes & Short-Window Undo Guide

## Overview

The Stellar Developer Dashboard provides a unified **Short-Window Undo** system for reversible preference mutations. When users change application settings—such as themes, dashboard widget layouts, notification priorities, or display densities—the application creates a temporary undo window (default: **10 seconds**) allowing immediate restoration of the prior state with a single click or keyboard shortcut.

---

## Features & Capabilities

- **Short-Window Active Expiration**: Preference changes remain undoable for a configurable window (default 10,000ms), after which expired items are automatically pruned from the active undo stack.
- **Multi-Domain Preference Support**: Supports reversible mutations across all preference domains:
  - **Theme & Display**: Light/Dark toggles, custom color themes, font size, density.
  - **Dashboard Layout**: Widget ordering, column counts, widget visibility toggles.
  - **Notification Preferences**: Category toggles, priority thresholds, quiet hours, sound/push options.
  - **General Preferences**: Currency, language, default network, auto-refresh settings.
- **Fail-Safe & Error Handling**:
  - **Invalid Input Handling**: Rejects malformed preference mutation payloads without throwing unhandled exceptions.
  - **Unsupported Environments**: Gracefully falls back to in-memory state updates if browser storage (`localStorage` or IndexedDB) fails or is restricted (e.g. private browsing mode or quota exceeded).
  - **Restoration Failure Isolation**: Catches failures during state restoration, preserves the active undo stack, and reports failure cleanly without crashing the UI.
- **UI Integration**: Includes a floating `PreferenceUndoBanner` component and `usePreferenceUndo` React hook for interactive feedback.

---

## Architecture & API Reference

### 1. `PreferenceUndoManager` (`src/lib/preferenceUndoManager.ts`)

The core singleton module managing undo/redo stacks, expiration timers, and subscriber notifications.

```typescript
import { preferenceUndoManager } from './preferenceUndoManager'

// Record an undoable mutation
const result = preferenceUndoManager.recordAction({
  category: 'theme',
  key: 'theme',
  label: 'Changed Theme to light',
  previousValue: 'dark',
  nextValue: 'light',
  restore: async () => {
    // Restoration logic
  }
})

// Execute undo
const undoResult = await preferenceUndoManager.undo()

// Check status
const canUndo = preferenceUndoManager.canUndo()
const timeRemaining = preferenceUndoManager.getRemainingTimeMs()
```

### 2. Helper Integrations

#### User Preferences (`src/lib/userPreferences.ts`)
- `updatePreferenceWithUndo(key, value)`
- `savePreferencesWithUndo(partial)`
- `saveDashboardLayoutWithUndo(layout)`
- `resetPreferencesWithUndo()`
- `applyPreferencePresetWithUndo(presetId)`

#### Notification Preferences (`src/lib/notificationPreferences.ts`)
- `saveNotificationPreferencesWithUndo(partial)`
- `resetNotificationPreferencesWithUndo()`

### 3. React Hooks & UI Components

#### `usePreferenceUndo` (`src/hooks/usePreferenceUndo.ts`)
```typescript
import { usePreferenceUndo } from '../hooks/usePreferenceUndo'

function MyComponent() {
  const { canUndo, latestAction, timeRemainingMs, undo, clear } = usePreferenceUndo()

  return canUndo ? (
    <button onClick={undo}>
      Undo {latestAction?.label} ({Math.ceil(timeRemainingMs / 1000)}s)
    </button>
  ) : null
}
```

#### `PreferenceUndoBanner` (`src/components/preferences/PreferenceUndoBanner.tsx`)
A ready-to-use, responsive banner component that renders floating undo feedback whenever an undoable action is active.

---

## Compatibility, Security & Migration Notes

1. **Backward Compatibility**: All existing functions (`savePreferences`, `updatePreference`, `saveNotificationPreferences`, etc.) retain their exact parameter signatures and function contracts. The `*WithUndo` variants and `usePreferences` hook enhance existing functionality without breaking legacy callers.
2. **Storage Quota & Security**:
   - Undo history snapshots are held primarily in-memory within the `PreferenceUndoManager` instance.
   - Sensitive user tokens, credentials, and seed phrases are **never** captured in preference undo snapshots.
   - If `localStorage` write operations fail (e.g. `QuotaExceededError`), the preference system logs a non-fatal warning and maintains active in-memory state.
3. **Migration Notes**: No database schema or localStorage version migration is required for this feature.
