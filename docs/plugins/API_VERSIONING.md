# Plugin API Versioning

The Stellar Dev Dashboard exposes a **stable, versioned plugin interface** so that
third-party plugins keep working across dashboard releases. Plugins declare
which API contract they target, and the runtime enforces compatibility or emits
deprecation notices.

This document is the public contract for the plugin API. It is stabilised at
**API version `1.0.0`** (the version of the interface described in
[`docs/plugins/README.md`](./README.md)).

## Versioning policy

The plugin API version follows [Semantic Versioning](https://semver.org/),
tracked independently of the dashboard's own release version.

| Change type | Example | Meaning for plugins |
| --- | --- | --- |
| **MAJOR** (`1.x → 2.x`) | `apiVersion: "2.0.0"` | Breaking change to the plugin interface. Plugins built for `1.x` keep running but are flagged **deprecated**; plugins built for `2.x` will not activate until the dashboard supports `2.x`. |
| **MINOR** (`1.0 → 1.1`) | `apiVersion: "1.1.0"` | Additive, backward-compatible change. A plugin targeting `1.1` runs on any dashboard that supports `>= 1.1`. Targeting a newer minor than the dashboard ships is **unsupported** (requires an upgrade). |
| **PATCH** (`1.0.0 → 1.0.1`) | `apiVersion: "1.0.1"` | Backward-compatible bug fix. Always compatible within the current major. |

## Declaring your API version

Add `apiVersion` to your `plugin.json` manifest (the value is a semver string):

```jsonc
{
  "id": "community.activity-radar",
  "name": "Activity Radar",
  "version": "1.2.0",
  "apiVersion": "1.0.0",
  "runtime": { "mode": "iframe", "sandbox": ["allow-scripts"] }
}
```

* `version` is the plugin's **own** release version (for marketplace updates and
  self-reporting). It is **not** the API version.
* `apiVersion` is the **plugin API contract** the plugin is built against. See the
  guidance notice attached to every installed plugin for this distinction.

### Omitting `apiVersion` (backwards compatibility)

Plugins that do not declare `apiVersion` are assumed to target the dashboard's
current version and are treated as **supported**, but a deprecation notice is
surfaced recommending that you declare it explicitly. Future majors may require
an explicit `apiVersion`.

## Compatibility matrix

For a dashboard shipping `apiVersion = 1.0.0`:

| Plugin `apiVersion` | Compatibility | Can activate? |
| --- | --- | --- |
| `1.0.0` | supported | Yes |
| `1.0.1` | unsupported (requires upgrade) | No |
| `1.1.0` | unsupported (requires upgrade) | No |
| `0.9.0` | deprecated (older major) | Yes, with a deprecation notice |
| `2.0.0` | unsupported (future major) | No |
| `not-a-version` | invalid | No |
| *(omitted)* | supported (defaults to `1.0.0`) | Yes |

> Plugins whose `apiVersion` is **unsupported** or **invalid** are blocked from
> activating and are surfaced to the user as failed/blocked. **Deprecated**
> plugins remain active but render a deprecation notice.

## Deprecation notices

Two sources of deprecation information are surfaced to plugin authors and users:

1. **Dashboard-wide API deprecations.** The runtime ships a registry
   (`PLUGIN_API_DEPRECATIONS`) of API surfaces scheduled for removal. Every
   notice lists a `since` version, the `feature` affected, a human-readable
   `message`, and an optional `removalVersion`. Notices are attached to plugin
   records whose target `apiVersion` is `>=` the notice's `since` version.

2. **Plugin-author deprecation.** A plugin may mark *itself* as deprecated via
   the manifest's `deprecated` field:

   ```jsonc
   {
     "id": "community.legacy",
     "name": "Legacy Extension",
     "version": "0.9.0",
     "apiVersion": "1.0.0",
     "deprecated": {
       "since": "0.9.0",
       "message": "Superseded by community.modern.",
       "removalVersion": "2.0.0"
     }
   }
   ```

   The `deprecated` object is surfaced on the plugin record and in the plugin
   sidebar so users are warned before installing.

## Security

* `apiVersion` is validated with a strict `MAJOR.MINOR.PATCH` parser. Malformed
  strings are rejected (no fuzzy matching, no coercion) so a hand-edited or
  malicious manifest cannot smuggle an unexpected version into the runtime.
* iframe plugins continue to run in a sandboxed browsing context regardless of
  `apiVersion`. Declaring a version never weakens sandbox isolation.
* The `entry` field for `module` plugins is still loaded only through the
  dashboard's configured extension host; `apiVersion` changes do not alter the
  loading trust boundary.

## Migration guide

### From an unversioned plugin (pre-1.0)

1. Set `apiVersion` to the version your plugin was developed against (`"1.0.0"`
   for plugins written against the current interface).
2. Run the scaffold CLI to refresh your manifest:

   ```bash
   node scripts/create-plugin.mjs --name "My Plugin" --id "community.my-plugin" --output ./my-plugin
   ```

   New scaffolds include `apiVersion` automatically.

### Bumping to a new MAJOR

When the dashboard publishes a new major API version:

1. Review `docs/plugins/API_VERSIONING.md` for breaking changes.
2. Update your manifest's `apiVersion` to the new major.
3. Update your `definePlugin()` usage to match the new `PluginDefinition` shape.
4. Re-test installation and initialisation flow.

## Reference (runtime helpers)

These are exported from `src/plugins/sdk.ts`:

* `SUPPORTED_PLUGIN_API_VERSION` — the dashboard's current API version.
* `parseApiVersion(version)` — parse/validate a version string.
* `compareApiVersions(a, b)` — semver comparator.
* `getApiVersionCompatibility(version)` — returns `"supported" | "deprecated" |
  "unsupported" | "invalid"`.
* `isPluginApiVersionSupported(version)` — boolean convenience.
* `getDeprecationNoticesForVersion(version)` — dashboard-wide deprecation
  notices applicable to a target version.
* `resolveApiVersion(version)` — resolve an (optional) declared version into a
  `{ apiVersion, declared, compatibility, deprecationNotices }` record.
* `PLUGIN_API_DEPRECATIONS` — the dashboard-wide deprecation registry.

Plugin records additionally expose `apiVersion`, `apiVersionCompatibility`, and
`deprecationNotices` via `PluginManager.getPluginRecords()` and the dashboard API
handed to each plugin.
