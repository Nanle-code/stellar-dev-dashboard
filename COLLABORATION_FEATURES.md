# Real-Time Collaboration Features

## Overview

The Stellar Dev Dashboard now includes real-time collaboration features that enable multi-user sessions across browser tabs without requiring a backend server. All collaboration features use the browser's `BroadcastChannel` API for cross-tab communication and IndexedDB for persistent storage.

## Features

### 1. Presence Awareness

Track which users/tabs are viewing the same accounts or transactions in real-time.

**Components:**
- `PresenceManager` - Core presence tracking system
- `usePresence` - React hook for accessing presence features
- `PresenceIndicator` - Compact viewer count display
- `PresenceList` - Detailed viewer list with status

**Features:**
- Real-time viewer count per account
- Shows which tab each viewer is on
- Tracks cursor positions and selections
- Automatic cleanup of inactive users (15s timeout)
- Heartbeat mechanism (5s interval)

**Usage:**
```jsx
import { usePresence } from '../hooks/usePresence'
import { PresenceIndicator } from '../components/collaboration/PresenceIndicator'

function MyComponent() {
  const { users, updateAccount, updateActiveTab } = usePresence()
  
  useEffect(() => {
    updateAccount(accountId)
  }, [accountId, updateAccount])
  
  return <PresenceIndicator accountId={accountId} />
}
```

### 2. Collaborative Annotations

Add comments and annotations to accounts, transactions, and contracts that persist across sessions.

**Components:**
- `AnnotationsStore` - Annotation management with IndexedDB persistence
- `useAnnotations` - React hook for annotation operations
- `AnnotationsPanel` - UI for viewing and managing annotations

**Features:**
- Add, edit, resolve, and delete annotations
- Annotations persist in IndexedDB
- Real-time sync across tabs via BroadcastChannel
- Type-specific annotations (account, transaction, contract)
- Author tracking with timestamps

**Usage:**
```jsx
import { useAnnotations } from '../hooks/useAnnotations'
import { AnnotationsPanel } from '../components/collaboration/AnnotationsPanel'

function TransactionDetail({ transactionId }) {
  const { addAnnotation, getAnnotationsForTarget } = useAnnotations()
  
  const handleAddComment = async (content) => {
    await addAnnotation('transaction', transactionId, content, 'user-123', 'You')
  }
  
  return <AnnotationsPanel type="transaction" targetId={transactionId} />
}
```

### 3. Cursor Sharing

See real-time cursor positions from other users viewing the same content.

**Components:**
- `CursorOverlay` - Displays remote cursors with user labels
- Integrated into `PresenceManager`

**Features:**
- Real-time cursor position broadcasting
- Color-coded cursors per user
- User labels on cursors
- Smooth position transitions

**Usage:**
```jsx
import { CursorOverlay } from '../components/collaboration/CursorOverlay'
import { usePresence } from '../hooks/usePresence'

function MyView({ accountId }) {
  const { updateCursor } = usePresence()
  
  const handleMouseMove = (e) => {
    updateCursor(e.clientX, e.clientY, 'my-element')
  }
  
  return (
    <div onMouseMove={handleMouseMove}>
      <CursorOverlay accountId={accountId} />
    </div>
  )
}
```

### 4. Cross-Tab State Sync

Existing feature enhanced with presence integration. Automatically syncs network, active tab, and connected address across browser tabs.

**Components:**
- `stateSync.js` - Cross-tab synchronization via BroadcastChannel
- `useCollaboration` - React hook for collaboration features
- `CollaborativeView` - UI for collaboration settings

**Features:**
- Automatic state propagation across tabs
- Shareable URL encoding (network + tab + address)
- Privacy warnings for public key sharing
- Tab count tracking

**Usage:**
```jsx
import { useCollaboration } from '../hooks/useCollaboration'
import CollaborativeView from '../components/dashboard/CollaborativeView'

function Settings() {
  const { syncStatus, connectedTabs, generateShareLink } = useCollaboration(store)
  
  return <CollaborativeView store={store} />
}
```

## Architecture

### BroadcastChannel Communication

All real-time features use the browser's `BroadcastChannel` API:

```typescript
// Presence channel
const PRESENCE_CHANNEL = 'stellar-dashboard-presence'

// Annotations channel
const ANNOTATIONS_CHANNEL = 'stellar-dashboard-annotations'

// State sync channel
const SYNC_CHANNEL = 'stellar-dashboard-sync'
```

### IndexedDB Persistence

Annotations and user preferences are stored in IndexedDB:

```javascript
// Annotations storage
const ANNOTATIONS_STORAGE_KEY = 'stellar-collaboration-annotations'

// User preferences
const PREFS_STORAGE_KEY = 'store:preferences'
```

### Security Considerations

- **No private keys shared**: Only public keys and non-sensitive state are broadcast
- **Allow-listed fields**: Only specific state fields are synced (network, activeTab, connectedAddress, theme)
- **Local-only**: All communication stays within the browser; no external servers
- **Privacy warnings**: Users are warned when sharing URLs containing public keys

## Integration Guide

### Adding Presence to a Component

1. Import the hook:
```jsx
import { usePresence } from '../hooks/usePresence'
```

2. Initialize and update state:
```jsx
const { updateAccount, updateActiveTab, updateSelection } = usePresence()

useEffect(() => {
  updateAccount(accountId)
}, [accountId, updateAccount])

useEffect(() => {
  updateActiveTab(tabName)
}, [tabName, updateActiveTab])
```

3. Add presence indicator:
```jsx
<PresenceIndicator accountId={accountId} />
```

### Adding Annotations to a Component

1. Import the hook:
```jsx
import { useAnnotations } from '../hooks/useAnnotations'
```

2. Use annotation functions:
```jsx
const { addAnnotation, getAnnotationsForTarget } = useAnnotations()

const handleAddComment = async (content) => {
  await addAnnotation(type, targetId, content, authorId, authorName)
}
```

3. Render annotations panel:
```jsx
<AnnotationsPanel type="account" targetId={accountId} />
```

## API Reference

### usePresence Hook

```javascript
const {
  users,              // Array of active users
  isInitialized,      // Boolean, true when presence manager is ready
  updateAccount,      // (accountId: string | null) => void
  updateActiveTab,    // (tab: string) => void
  updateCursor,       // (x: number, y: number, element?: string) => void
  updateSelection,    // (type: string, id: string) => void
  getUsersForAccount, // (accountId: string) => PresenceUser[]
  getUserCount,       // () => number
} = usePresence()
```

### useAnnotations Hook

```javascript
const {
  annotations,           // Array of all annotations
  isInitialized,         // Boolean, true when store is ready
  addAnnotation,         // (type, targetId, content, authorId, authorName) => Promise<Annotation>
  updateAnnotation,      // (id, updates) => Promise<Annotation | null>
  deleteAnnotation,      // (id) => Promise<boolean>
  resolveAnnotation,     // (id) => Promise<boolean>
  getAnnotationsForTarget, // (type, targetId) => Annotation[]
  getAnnotationCount,    // (type, targetId) => number
} = useAnnotations()
```

### PresenceUser Type

```typescript
interface PresenceUser {
  id: string
  tabId: string
  accountId: string | null
  activeTab: string
  lastSeen: number
  cursor?: {
    x: number
    y: number
    element?: string
  }
  selection?: {
    type: 'account' | 'transaction' | 'contract'
    id: string
  }
}
```

### Annotation Type

```typescript
interface Annotation {
  id: string
  type: 'account' | 'transaction' | 'contract'
  targetId: string
  content: string
  authorId: string
  authorName?: string
  createdAt: number
  updatedAt: number
  resolved: boolean
}
```

## Styling

Collaboration components use the CSS in `src/styles/collaboration.css`. The styles are automatically imported via `globals.css`.

### Customization

Styles use CSS custom properties that match the dashboard's design tokens:

```css
--bg-base, --bg-surface, --bg-elevated
--border, --border-bright
--text-primary, --text-secondary, --text-muted
--cyan, --green, --amber, --red
```

## Browser Compatibility

- **BroadcastChannel**: Supported in all modern browsers (Chrome 54+, Firefox 38+, Safari 15.4+)
- **IndexedDB**: Supported in all modern browsers
- **Fallback**: Graceful degradation when features are not supported

## Testing

### Manual Testing

1. Open the dashboard in multiple browser tabs
2. Connect to the same account in each tab
3. Observe the presence indicator showing viewer count
4. Add annotations in one tab and see them appear in others
5. Move cursor in one tab and observe cursor overlay in others

### Automated Testing

Collaboration features can be tested using Playwright's multi-tab capabilities:

```javascript
test('presence sync across tabs', async ({ context }) => {
  const page1 = await context.newPage()
  const page2 = await context.newPage()
  
  // Connect both pages to same account
  await page1.goto('/?account=...')
  await page2.goto('/?account=...')
  
  // Verify presence indicator shows 2 viewers
  const viewers1 = await page1.locator('.presence-indicator').textContent()
  expect(viewers1).toContain('2 viewers')
})
```

## Future Enhancements

Potential improvements for collaboration features:

1. **WebSocket Integration**: Add optional WebSocket server for cross-device collaboration
2. **User Authentication**: Add user identity and authentication
3. **Rich Text Annotations**: Support markdown, code blocks, and formatting
4. **Annotation Reactions**: Add emoji reactions to annotations
5. **Voice/Video**: Integrate WebRTC for voice/video collaboration
6. **Screen Sharing**: Add screen sharing capabilities
7. **Version History**: Track changes to annotations with version history
8. **Export/Import**: Allow exporting annotations for backup

## Troubleshooting

### Presence not showing

- Verify BroadcastChannel is supported in the browser
- Check that tabs are on the same origin
- Ensure presence manager is initialized
- Check browser console for errors

### Annotations not syncing

- Verify IndexedDB is enabled
- Check that annotations store is initialized
- Ensure BroadcastChannel is working
- Check for storage quota exceeded errors

### Cursor overlay not visible

- Ensure CursorOverlay component is rendered
- Check that cursor updates are being called
- Verify z-index is not being overridden
- Check that accountId matches between tabs

## Performance Considerations

- **Heartbeat interval**: 5 seconds (configurable in PresenceManager)
- **Presence timeout**: 15 seconds (configurable in PresenceManager)
- **Annotation history**: Capped at 200 entries (configurable in AnnotationsStore)
- **Cursor updates**: Throttled to avoid excessive broadcasts

## License

MIT - Part of the Stellar Dev Dashboard project.
