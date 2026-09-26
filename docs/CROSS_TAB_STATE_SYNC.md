# Cross-tab state sync (deterministic) — #751

Settings and connected-account state are shared across browser tabs through
`localStorage`. Prior to #751, concurrent edits in two tabs could silently
clobber each other (a "lost update"): both tabs read version *N*, both wrote
*N+1*, and the second write won regardless of which was newer or what each tab
had changed.

`src/utils/stateSync.js` now resolves concurrent cross-tab updates
**deterministically** using a versioned compare-and-swap (CAS) envelope plus a
pure conflict-resolution function.

## How it works

Every persisted value is stored as an **envelope**:

```json
{ "__v": 3, "__t": 1690000000000, "__w": "tab-…", "value": { "network": "mainnet" } }
```

- `__v` — strictly increasing version, assigned per write.
- `__t` — wall-clock timestamp of the write.
- `__w` — stable per-tab id (`getTabId()`), used only to break ties.
- `value` — the caller-supplied state. **No secrets or private keys are ever
  stored** — only the allow-listed fields the caller chooses to persist.

### Writes — `syncState(key, value)`

1. Validates input (`key` is a non-empty string, `value` is not `undefined`).
2. Reads the current envelope to obtain the base version.
3. Attempts an optimistic CAS write: the new envelope is written only if the
   stored version is still the base version it was computed from.
4. If another tab committed a newer version in between, the write rebases onto
   that version and **retries** (up to `MAX_CONFLICT_RETRIES = 16`). Each retry
   advances the version, guaranteeing progress.
5. Returns the assigned version, or rejects on invalid input, unavailable
   storage, a write throw (e.g. `QuotaExceededError`), or exhausted retries.

This means two simultaneous edits can never land on the same version; the later
write observes the earlier one and builds on top of it, so nothing is silently
lost.

### Reads / notifications — `onStateChange(callback)` and `loadSyncedState(key)`

- `onStateChange((key, value, meta) => …)` fires on `storage` events from other
  tabs. `meta` is `{ version, writerId, timestamp }` (or `null` for legacy
  non-envelope writes). Malformed events are swallowed so a single bad entry
  cannot break a listener.
- `loadSyncedState(key)` returns `{ value, version, writerId, timestamp }` or
  `null` — useful when hydrating local version metadata.

### Conflict resolution — `resolveStateConflict(local, localMeta, incoming, incomingMeta)`

A **pure, order-independent** function:

```js
resolveStateConflict(a, ma, b, mb) === resolveStateConflict(b, mb, a, ma)
```

Ranking (higher wins): `version → timestamp → writerId → serialized value`.
A full tie returns the **local** value. Because every tab applies the same rule
to the same two records, all tabs converge to the same state — there is no
divergence and no silent lost update.

## Usage

```js
import { syncState, onStateChange, resolveStateConflict, loadSyncedState, getTabId } from '../utils/stateSync'

// Persist (deterministic, conflict-safe)
await syncState('settings:theme', 'dark')

// React to other tabs
const unsub = onStateChange((key, value, meta) => {
  if (key !== 'settings:theme') return
  // localMeta tracks the version you last applied locally
  const merged = resolveStateConflict(current, localMeta, value, meta)
  if (merged === value) { /* incoming won — adopt its metadata */ }
})
```

`usePersistedState` and the store persistence middleware already use this API.

## Compatibility

- **Browsers:** requires `localStorage` and the `storage` event (all modern
  browsers, plus jsdom for tests). If `localStorage` is unavailable (private
  mode, sandboxed iframe, SSR), `syncState` rejects with a clear error instead of
  failing silently; callers fall back to in-memory/local-only state.
- **Legacy data:** existing raw values stored before #751 have no `__v` and are
  normalised to **version 0** automatically, so old persisted settings keep
  working and join the deterministic resolution without a migration script.
- **No API/contract changes** for `broadcastStateChange` / `initStateSync`
  (BroadcastChannel live sync) — only the `localStorage` persistence path
  changed shape (now an envelope).

## Security

- Only the values the caller explicitly persists are written; the envelope adds
  only non-sensitive metadata (`version`, `timestamp`, a random tab id). Private
  keys and secrets are never part of synced state.
- The `storage` event handler parses defensively and never re-throws, so a
  malicious or corrupt `localStorage` entry cannot crash a tab.
- All persisted values are still JSON-serialized through the existing storage
  layer; no new remote surface is introduced.

## Migration notes

- **Storage format change:** `syncState(key, value)` now stores an envelope
  (`{ __v, __t, __w, value }`) instead of the raw JSON value. Code that reads
  the key directly via `localStorage` will now receive the envelope, not the raw
  value — use `loadSyncedState(key)` (or `onStateChange`'s `value` argument)
  instead. Raw pre-#751 values continue to be read correctly as version 0.
- **New exports:** `resolveStateConflict`, `getTabId`, and `loadSyncedState`
  were added. `syncState` now returns a `Promise<number>` (the assigned version)
  and may reject; previously it resolved `undefined` and swallowed all errors.
  Callers that ignored the promise should now tolerate rejections (the built-in
  consumers already catch and fall back to local persistence).
- **`onStateChange` callback signature** changed from `(key, value)` to
  `(key, value, meta)`. Existing callers ignoring the third argument are
  unaffected.
