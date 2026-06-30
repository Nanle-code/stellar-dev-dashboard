# Plugin System

Stellar Dev Dashboard supports third-party extensions through a manifest-first plugin system.

## Architecture

- `module` plugins are trusted bundles that export a plugin factory and can provide React widgets and data sources.
- `iframe` plugins are sandboxed extensions. They run inside an isolated frame and only receive the permissions granted during install.
- Plugin records are persisted in browser storage so installed extensions survive reloads.

## Manifest Format

```json
{
  "id": "community.activity-radar",
  "name": "Activity Radar",
  "version": "1.2.0",
  "description": "Sandboxed dashboard extension",
  "author": { "name": "Community Labs" },
  "permissions": ["dashboard:read", "data:read"],
  "runtime": {
    "mode": "iframe",
    "srcDoc": "<html>...</html>",
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

## Permission Scopes

- `dashboard:read` - read dashboard state and subscribe to state changes
- `dashboard:write` - use approved host actions such as navigation and search filters
- `data:read` - expose read-only data sources
- `data:write` - reserved for future writable plugin APIs
- `notifications:write` - create and remove notifications
- `network:request` - reserved for future remote fetch helpers
- `storage:read` - reserved for future isolated plugin storage access
- `storage:write` - reserved for future isolated plugin storage access
- `window:open` - reserved for future external link helpers

## Install Flow

1. The marketplace lists the manifest and requested permissions.
2. The user reviews the permissions in the plugin sidebar.
3. If approved, the manifest is persisted and the plugin is activated.
4. Marketplace updates can be compared by version and reinstalled when compatible.

## SDK

The public TypeScript SDK lives in `src/plugins/sdk.ts`.

It exports:

- `PLUGIN_PERMISSION_SCOPES`
- `definePlugin()`
- `createPluginManifest()`
- `createIframeWidget()`
- `comparePluginVersions()`

## CLI

Use the scaffold script to create a new plugin package:

```bash
node scripts/create-plugin.mjs --name "My Plugin" --id "community.my-plugin" --output ./my-plugin
```

Add `--runtime module` if you want to generate a module-style starter instead of an iframe starter.
