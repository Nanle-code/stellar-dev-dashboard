# Alert Rules and Notifications System

The Alert Rules system allows you to monitor Stellar account activity and receive notifications when specific conditions are met.

## Features

- **Three Rule Types**: Balance thresholds, operation types, and counterparty monitoring
- **Configurable Frequency**: Check rules every 30s, 1min, 5min, or 10min
- **Multiple Notification Channels**: In-app notifications and browser notifications
- **Per-Account Rules**: Create rules for any Stellar account address
- **Persistent Storage**: Rules and notifications are stored in IndexedDB

## Rule Types

### 1. Balance Threshold

Monitor account balances and trigger alerts when they go above or below a specified threshold.

**Configuration:**
- Asset Code (e.g., XLM, USDC)
- Asset Issuer (optional, for non-native assets)
- Threshold amount
- Direction (below or above)

**Example Use Cases:**
- Alert when XLM balance drops below 100
- Alert when USDC balance exceeds 10,000
- Monitor reserve requirements

### 2. Operation Type

Trigger alerts when specific operation types occur on the monitored account.

**Configuration:**
- Operation types to monitor (payment, create_account, change_trust, etc.)

**Example Use Cases:**
- Alert on any incoming payment
- Monitor trustline changes
- Track account merge operations

### 3. Counterparty

Monitor transactions with specific counterparty addresses.

**Configuration:**
- Counterparty address (G-address)
- Direction (incoming, outgoing, or any)

**Example Use Cases:**
- Alert when receiving payments from a specific address
- Monitor outgoing transactions to a known address
- Track all interactions with a counterparty

## Creating a Rule

1. Navigate to **Tools > Alerts** in the sidebar
2. Click **+ Create Rule**
3. Select the rule type
4. Enter the account address to monitor
5. Configure rule-specific settings
6. Choose check frequency
7. Select notification channels
8. Click **Create Rule**

## Notification Channels

### In-App Notifications

Notifications appear in the dashboard's notification center. They are:
- Stored persistently in IndexedDB
- Marked as read/unread
- Accessible via the notification bell icon

### Browser Notifications

Native browser notifications that appear even when the dashboard is not in focus.

**Requirements:**
- Browser must support the Web Notifications API
- User must grant notification permission
- Dashboard must be running (tab open)

**Enabling Browser Notifications:**
1. Check the "Browser" checkbox when creating a rule
2. Grant permission when prompted
3. Notifications will appear as native OS notifications

**Note:** Browser notifications require the dashboard tab to remain open. Service worker push notifications (for background delivery) are planned for a future release.

## Rule Evaluation

Rules are evaluated by a client-side engine that:
- Runs continuously when an account is connected
- Checks each enabled rule based on its execution frequency
- Fetches data from Horizon using the Stellar SDK
- Compares current state against rule conditions
- Delivers notifications when conditions are met

**Evaluation Details:**
- Balance rules: Fetch current account balances via `fetchAccount()`
- Operation rules: Fetch new operations since last evaluation via `fetchOperations()`
- Counterparty rules: Check operations for matching addresses

## Managing Rules

### Viewing Rules

All active rules are displayed in the "Active Rules" section, showing:
- Rule type and configuration
- Monitored account address
- Check frequency
- Last triggered time
- Enable/disable status

### Enabling/Disabling Rules

Click the **Enabled/Disabled** button on any rule to toggle its active state. Disabled rules are not evaluated.

### Deleting Rules

Click the **Delete** button to permanently remove a rule. This action cannot be undone.

## Notifications

### Viewing Notifications

Click the **🔔 Notifications** button to view all alert notifications. The badge shows the count of unread notifications.

### Managing Notifications

- Click an unread notification to mark it as read
- Click **Mark all read** to mark all notifications as read
- Notifications are sorted by triggered time (newest first)

### Notification Retention

Notifications are stored indefinitely in IndexedDB. You can manually clear old notifications by deleting them from the browser's IndexedDB storage.

## Data Shapes

### Balance Threshold Rule

```typescript
{
  type: 'balance_threshold',
  config: {
    assetCode: 'XLM',
    assetIssuer: undefined, // or G-address for non-native
    threshold: 100,
    direction: 'below'
  }
}
```

**Horizon Field Used:** `account.balances[].balance`

### Operation Type Rule

```typescript
{
  type: 'operation_type',
  config: {
    operationTypes: ['payment', 'create_account']
  }
}
```

**Horizon Field Used:** `operations[].type`

### Counterparty Rule

```typescript
{
  type: 'counterparty',
  config: {
    counterpartyAddress: 'GCOUNTERPARTY...',
    direction: 'incoming'
  }
}
```

**Horizon Fields Used:** `operations[].from`, `operations[].to`, `operations[].source_account`

## Execution Frequency Options

- **30 seconds**: High-frequency monitoring for time-sensitive alerts
- **60 seconds (1 minute)**: Balanced frequency for most use cases
- **300 seconds (5 minutes)**: Lower frequency for less urgent monitoring
- **600 seconds (10 minutes)**: Minimal frequency for background monitoring

**Note:** More frequent checks result in more Horizon API calls. Consider rate limits when setting frequencies.

## Limitations

- **Client-side evaluation**: Rules only run when the dashboard is open
- **No email notifications**: Only in-app and browser notifications are supported
- **No service worker**: Browser notifications require an open tab
- **No webhooks**: External webhook delivery is not supported
- **Per-browser storage**: Rules are stored locally and not synced across devices

## Future Enhancements

Planned features for future releases:

- **Service Worker Push Notifications**: Background notification delivery
- **Email Notifications**: Send alerts via email
- **Webhook Delivery**: POST notifications to external endpoints
- **Cloud Sync**: Sync rules across devices
- **Advanced Conditions**: Combine multiple conditions with AND/OR logic
- **Historical Triggers**: View rule trigger history and analytics
- **Rule Templates**: Pre-configured rules for common scenarios

## Troubleshooting

### Rules Not Triggering

1. Check that the rule is **Enabled**
2. Verify the account address is correct
3. Ensure the execution frequency has elapsed
4. Check browser console for errors
5. Verify Horizon connectivity

### Browser Notifications Not Appearing

1. Check that browser notifications are enabled in browser settings
2. Verify permission was granted (not denied)
3. Ensure the dashboard tab is open
4. Check that the "Browser" channel is selected for the rule

### Performance Issues

If the dashboard becomes slow:
1. Reduce the number of active rules
2. Increase execution frequency intervals
3. Clear old notifications from IndexedDB
4. Check browser console for errors

## Privacy and Security

- **Local Storage**: All rules and notifications are stored in browser IndexedDB
- **No Server**: No data is sent to external servers
- **Account Addresses**: Monitored addresses are stored locally only
- **API Keys**: Horizon API calls use public endpoints (no authentication)
- **Browser Permissions**: Notification permission is requested only when needed

## API Reference

### Hook: `useAlertRules()`

```typescript
const {
  rules,              // AlertRule[]
  notifications,      // AlertNotification[]
  loading,            // boolean
  error,              // string | null
  engineRunning,      // boolean
  addRule,            // (rule) => Promise<void>
  updateRule,         // (rule) => Promise<void>
  removeRule,         // (ruleId) => Promise<void>
  toggleRule,         // (ruleId) => Promise<void>
  markRead,           // (notificationId) => Promise<void>
  markAllRead,        // () => Promise<void>
  refreshRules,       // () => Promise<void>
  refreshNotifications, // () => Promise<void>
} = useAlertRules()
```

### Engine Functions

```typescript
// Start the rule evaluation engine
startRuleEngine(userId: string, network: NetworkName, onNotification: Function): void

// Stop the rule evaluation engine
stopRuleEngine(): void

// Check if engine is running
isEngineRunning(): boolean
```

### Notification Functions

```typescript
// Request browser notification permission
requestBrowserNotificationPermission(): Promise<boolean>

// Check if browser notifications are available
areBrowserNotificationsAvailable(): boolean

// Get current permission status
getBrowserNotificationPermission(): NotificationPermission | 'unsupported'
```

## Contributing

To contribute to the Alert Rules system:

1. Read the implementation in `src/lib/alertRuleEngine.ts`
2. Review the data model in `src/types/alerts.ts`
3. Check existing tests in `src/lib/__tests__/alertRuleEngine.test.ts`
4. Follow the existing code patterns and conventions
5. Add tests for new functionality
6. Update this documentation

## Support

For issues or questions:
- Check the browser console for errors
- Review the troubleshooting section above
- Open an issue on GitHub with detailed information
