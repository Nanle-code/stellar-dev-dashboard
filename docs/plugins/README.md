# Plugin System & Capability Sandbox

Stellar Dev Dashboard supports third-party extensions through a secure, manifest-first plugin system powered by capability-based permissions.

## Architecture & Security Model

The plugin platform adheres to the **principle of least privilege**:
- **`iframe` plugins (sandboxed extensions)**: Run inside an isolated HTML iframe (`sandbox="allow-scripts"` without `allow-same-origin`). They have zero ambient access to parent cookies, local storage, or window objects. Communication with the host dashboard occurs strictly through a capability-guarded bidirectional `postMessage` RPC bridge.
- **`module` plugins**: Trusted extensions that export a plugin factory and can directly render React widgets and register data sources.
- **Isolated Per-Plugin Storage**: Plugin storage is partitioned under `stellar-dashboard:plugin-data:<pluginId>`. Plugins cannot read or overwrite keys of other extensions, and isolated storage is automatically destroyed when an extension is uninstalled.
- **Safe State Sanitization**: When a plugin reads dashboard state via `dashboard:read`, sensitive properties (such as secret keys, seed phrases, and auth tokens) are stripped before delivery.
- **Dynamic Capability Revocation**: Users can revoke any granted capability at runtime from the Plugin Management UI. Revoking a capability immediately:
  1. Tears down active subscriptions and event listeners tied to that capability.
  2. Broadcasts a `PLUGIN_CAPABILITY_REVOKED` event to the plugin frame.
  3. Rejects any subsequent guarded API invocations with `ERR_CAPABILITY_REVOKED`.

---

## Capability Scopes

| Scope | Description | Guarded Operations |
|---|---|---|
| `dashboard:read` | Read safe dashboard state and subscribe to changes | `getState()`, `getConfig()`, `subscribe()` |
| `dashboard:write` | Execute authorized UI mutations | `actions.setActiveTab()`, `actions.setNetwork()`, `actions.setSearchFilters()` |
| `data:read` | Read-only access to registered data sources | Querying plugin data feeds |
| `data:write` | Write access to plugin data feeds | Mutating plugin data feeds |
| `notifications:write` | Display user notifications | `notifications.add()`, `notifications.remove()` |
| `network:request` | Outbound HTTP/HTTPS network requests | `fetch()` (enforces HTTP/HTTPS protocol validation) |
| `storage:read` | Read plugin-isolated persistent storage | `storage.get()`, `storage.list()`, `storage.getAll()` |
| `storage:write` | Write and clear plugin-isolated persistent storage | `storage.set()`, `storage.remove()`, `storage.clear()` |
| `window:open` | Open external links in new window | `openWindow()` (enforces `noopener,noreferrer` security flags) |

---

## Error Codes & Failure Paths

The capability sandbox provides structured `CapabilityError` exceptions with standard codes:

- `ERR_CAPABILITY_NOT_GRANTED`: Attempted an operation requiring a capability that was not granted in the manifest or during install.
- `ERR_CAPABILITY_REVOKED`: Attempted an operation whose capability was explicitly revoked by the user or security policy.
- `ERR_INVALID_CAPABILITY_SCOPE`: Supplied an unrecognized capability scope string.
- `ERR_INVALID_INPUT`: Supplied malformed arguments (e.g. non-string storage key, invalid or non-HTTP URL protocol).
- `ERR_UNSUPPORTED_ENVIRONMENT`: Attempted an operation requiring browser APIs (such as `fetch` or `window.open`) in an environment where they are absent.
- `ERR_CAPABILITY_EXECUTION_FAILED`: Failure occurred while executing the guarded host method or an RPC request timed out.

---

## Manifest Format

```json
{
  "id": "community.activity-radar",
  "name": "Activity Radar",
  "version": "1.2.0",
  "description": "Sandboxed dashboard extension with capability-based security",
  "author": { "name": "Community Labs" },
  "permissions": ["dashboard:read", "storage:read", "storage:write", "network:request"],
  "runtime": {
    "mode": "iframe",
    "srcDoc": "<!doctype html><html><body><div id=\"root\"></div></body></html>",
    "sandbox": ["allow-scripts"]
  },
  "widgets": [
    {
      "id": "community.activity-radar.settings",
      "title": "Activity Radar",
      "placement": "settings",
      "kind": "iframe"
    }
  ],
  "dataSources": []
}
```

---

## Bidirectional RPC Bridge Protocol

Sandboxed `iframe` extensions communicate with the host via `window.parent.postMessage`:

### 1. RPC Request / Response
```ts
// Request from iframe to host:
{
  type: "PLUGIN_RPC_REQUEST",
  pluginId: "community.activity-radar",
  requestId: "req-123",
  capability: "dashboard:read",
  method: "getState",
  args: []
}

// Response from host to iframe:
{
  type: "PLUGIN_RPC_RESPONSE",
  pluginId: "community.activity-radar",
  requestId: "req-123",
  success: true,
  result: { network: "testnet", theme: "dark" }
}
```

### 2. State Subscriptions
```ts
// Subscribe from iframe:
{
  type: "PLUGIN_RPC_SUBSCRIBE",
  pluginId: "community.activity-radar",
  subscriptionId: "sub-456",
  capability: "dashboard:read"
}

// Event notification from host:
{
  type: "PLUGIN_RPC_EVENT",
  pluginId: "community.activity-radar",
  subscriptionId: "sub-456",
  payload: { network: "testnet", theme: "light" }
}

// Unsubscribe from iframe:
{
  type: "PLUGIN_RPC_UNSUBSCRIBE",
  pluginId: "community.activity-radar",
  subscriptionId: "sub-456"
}
```

### 3. Capability Revocation Broadcast
When a user revokes a permission, the host automatically notifies the iframe:
```ts
{
  type: "PLUGIN_CAPABILITY_REVOKED",
  pluginId: "community.activity-radar",
  capability: "storage:write"
}
```

---

## SDK Usage

The public TypeScript SDK lives in `src/plugins/sdk.ts`.

### In Sandboxed Iframes (`createSandboxClient`):
```ts
import { createSandboxClient } from "@stellar/plugin-sdk";

const client = createSandboxClient({ pluginId: "community.activity-radar" });

// Read safe state:
const state = await client.getState();

// Isolated storage:
await client.storage.set("themePref", "dark");
const stored = await client.storage.get("themePref");

// Listen for dynamic capability revocation:
client.onCapabilityRevoked((revokedScope) => {
  console.warn(`Capability ${revokedScope} was revoked by the user.`);
});
```

---

## CLI Scaffold (`scripts/create-plugin.mjs`)

Create a new plugin with tailored capabilities using the CLI:

```bash
node scripts/create-plugin.mjs \
  --name "My Analytics Plugin" \
  --id "community.my-analytics" \
  --output ./plugins/my-analytics \
  --runtime iframe \
  --capabilities "dashboard:read,storage:read,storage:write"
```

### CLI Options
- `--name <name>`: Display name of the plugin (required).
- `--id <id>`: Unique plugin ID in lowercase dot/hyphen notation (required).
- `--output <dir>`: Target directory for the scaffolded package (required).
- `--runtime <mode>`: Runtime mode: `iframe` (default) or `module`.
- `--capabilities <scopes>`: Comma-separated list of required capabilities (defaults to `dashboard:read`).
- `--help, -h`: Show usage information.

---

## Compatibility & Migration Notes

- **Manifest Compatibility**: Plugins declaring `permissions` in their `plugin.json` automatically map to capability scopes without requiring schema migrations.
- **Storage Isolation**: Storage written by plugins is isolated by `pluginId`. Existing plugins upgrading to capability-guarded storage will store data safely under their own isolated namespace.
- **Breaking Changes**: If an iframe plugin previously attempted to invoke undeclared or revoked host APIs, those calls will now fail with a structured `CapabilityError`. Plugins should declare all necessary capabilities in their manifest.
