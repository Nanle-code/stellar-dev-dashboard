# Offline-First Conflict Resolution

Part of **D-009: offline-first architecture** (issue #412).

The service worker + offline queue lets users keep working while disconnected.
The hard part is what happens on reconnect: a queued local write may collide
with a newer server-side edit. Blindly replaying the queue silently destroys
the remote change.

This module makes that collision explicit and resolvable.

## Record model

Every syncable record carries version metadata:

| Field | Meaning |
| --- | --- |
| `id` | Stable record identifier. |
| `version` | Monotonic version stamp of the record. |
| `baseVersion` | The version the local copy was derived from. |
| `updatedAt` | Epoch ms of the last write. |
| `updatedBy` | Device/user that produced the write (diagnostics). |
| `data` | The payload. |

`src/lib/offline/conflictResolution.ts` is pure and dependency-free.

## Conflict detection

`detectConflict(local, remote)` returns a `Conflict` when the remote record was
modified after our offline copy branched — i.e. `remote.version !== local.baseVersion` —
and the payloads actually diverge.

It returns `null` (fast-forward, no user action) when:

- either record is missing or malformed;
- the ids differ;
- `local.baseVersion === remote.version` (nobody else touched it); or
- the payloads are structurally identical (`deepEqual`).

`conflict.overlappingFields` lists only the fields that differ, so the UI can
show a focused diff instead of the whole record.

## Merge strategies

`resolveConflict(conflict, strategy, options)` returns a `Resolution` with the
merged record (version bumped to `max(local, remote) + 1`, `baseVersion` pinned
to the remote version) and a `requiresUser` flag.

| Strategy | Behaviour |
| --- | --- |
| `local-wins` | Keep the offline edit. |
| `remote-wins` | Discard the offline edit and take the server copy. |
| `last-write-wins` | Pick whichever record has the newer `updatedAt` (ties go to remote). |
| `field-merge` | Union of non-overlapping fields; overlapping fields resolved by `options.resolver`, falling back to last-write-wins per field. |
| `manual` | Do not decide — surface the conflict to the user. |

An unknown strategy degrades to `manual` rather than throwing, so a bad client
can never wedge the sync loop.

## UI

- `src/hooks/useOfflineConflicts.ts` holds the pending conflict queue, returns
  the merged record from `resolve(id, strategy)`, and supports `dismiss`/`add`.
- `src/components/sync/ConflictResolutionPanel.tsx` renders a per-conflict
  local/remote field table plus **Keep mine / Keep remote / Merge fields /
  Decide later** actions.

## Usage

```ts
import { detectConflict, resolveConflict } from '@/lib/offline/conflictResolution';

const conflict = detectConflict(localRecord, remoteRecord);
if (conflict) {
  const resolution = resolveConflict(conflict, 'field-merge');
  if (resolution.requiresUser) showConflictPanel(resolution.conflict);
  else await api.put(`/records/${conflict.id}`, resolution.merged);
}
```

## Tests

`src/lib/offline/__tests__/conflictResolution.test.ts` covers the primary path
(conflict detected and merged), boundary cases (fast-forward, identical data,
mismatched ids, invalid input) and failure handling (unknown strategy).
