# Mainnet Safety Guard

**Issue:** #983  
**Status:** Implemented

---

## Overview

A consistent, defence-in-depth safety system that makes it very hard to accidentally submit a write action to mainnet while developing or testing.

Three layers of protection work together:

| Layer | What it does |
|---|---|
| **Persistent network badge** | Amber, always-visible header badge on mainnet; grey on all other networks |
| **`useWriteGuard()` hook** | Central gate — intercepts every write action on mainnet and requires the user to type `mainnet` before proceeding |
| **Per-session read-only lock** | Optional session flag that blocks all writes until explicitly lifted — survives navigation but is cleared on tab close |

---

## Network Badge (`NetworkSafetyBadge`)

Located in the dashboard header alongside the existing compact `NetworkIndicator`.

- **Testnet / Futurenet / Local:** neutral grey badge showing the network name.
- **Mainnet:** amber badge with `⚠ MAINNET` label, amber border glow, and a tooltip on hover.
- **Mainnet + read-only lock:** red badge with `⚠ MAINNET 🔒` label and a red glow.

Clicking the mainnet badge toggles the per-session read-only lock. The current lock state is also announced via `aria-live="polite"` for screen readers.

---

## `useWriteGuard()` Hook

**Location:** `src/hooks/useWriteGuard.ts`  
**Export:** also re-exported from `src/hooks/index.ts`

### API

```typescript
const { guard, isReadOnlyLocked, lockReadOnly, unlockReadOnly, dialogOpen, dialogProps } = useWriteGuard();
```

| Return value | Type | Description |
|---|---|---|
| `guard(opts)` | `(opts: GuardOptions) => void` | Call before any write action |
| `isReadOnlyLocked` | `boolean` | `true` when on mainnet **and** the session lock is active |
| `lockReadOnly()` | `() => void` | Activate the per-session read-only lock |
| `unlockReadOnly()` | `() => void` | Lift the per-session read-only lock |
| `dialogOpen` | `boolean` | Whether the confirmation dialog is open |
| `dialogProps` | `MainnetConfirmDialogProps` | Spread directly onto `<MainnetConfirmDialog>` |

### `GuardOptions`

```typescript
interface GuardOptions {
  /** Human-readable description shown in the confirmation dialog */
  action: string;
  /** Called only after the user has confirmed */
  onConfirm: () => void | Promise<void>;
}
```

### Behaviour by network

| Network | Read-only lock | `guard()` behaviour |
|---|---|---|
| testnet / futurenet / local | N/A | Calls `onConfirm` immediately |
| mainnet (lock off) | — | Opens typed-confirmation dialog |
| mainnet (lock on) | Active | Silently blocks — no dialog opened |

### Usage pattern

```tsx
import { useWriteGuard } from '../../hooks/useWriteGuard';
import MainnetConfirmDialog from '../security/MainnetConfirmDialog';

function MySubmitForm() {
  const { guard, isReadOnlyLocked, dialogProps } = useWriteGuard();

  async function doSubmit() {
    // actual network call here
  }

  function handleSubmit() {
    guard({ action: 'payment', onConfirm: doSubmit });
  }

  return (
    <>
      <MainnetConfirmDialog {...dialogProps} />
      {isReadOnlyLocked && <div>🔒 Mainnet read-only lock is active.</div>}
      <button onClick={handleSubmit}>Send Payment</button>
    </>
  );
}
```

---

## `MainnetConfirmDialog`

**Location:** `src/components/security/MainnetConfirmDialog.tsx`

A modal that requires the user to type the exact phrase `mainnet` (case-insensitive, leading/trailing whitespace trimmed) before the **Confirm Write** button becomes active. Pressing **Cancel** or **Escape** cancels without side effects.

Props are the `dialogProps` object returned by `useWriteGuard()` — spread them directly:

```tsx
<MainnetConfirmDialog {...dialogProps} />
```

---

## Per-session Read-Only Lock

The lock is stored in `sessionStorage` under the key `stellar:mainnet-readonly-lock`. It:

- Persists across React re-renders and in-page navigations.
- Is cleared automatically when the browser tab is closed.
- Has no effect on non-mainnet networks (isReadOnlyLocked returns `false`).

Toggle via the `NetworkSafetyBadge` in the header, or programmatically:

```typescript
const { lockReadOnly, unlockReadOnly } = useWriteGuard();
lockReadOnly();   // block all writes for this session
unlockReadOnly(); // restore write access
```

---

## Submit Paths Covered

Every write action routes through `useWriteGuard().guard()`:

| Flow | Component |
|---|---|
| Sign & submit transaction | `TransactionSigner` |
| Fund account (Faucet) | `Faucet` |
| Contract function invoke | `ContractInteraction` |
| Contract deploy / simulate | `ContractDeployer` |

---

## Lint Enforcement (`local/no-direct-submit`)

A custom ESLint rule in `eslint-rules/no-direct-submit.mjs` (loaded in `eslint.config.js`) reports an **error** if component code calls any of the following directly:

- `server.submitTransaction()`
- `server.sendTransaction()`
- `signAndSubmitTransaction()`

**Allowlisted files** (transport layer — direct calls are intentional):
- `src/lib/transactionBuilder.ts`
- `src/lib/contractInvoker.ts`
- `src/lib/horizonRetry.ts`
- `src/lib/bulkOperations.ts`
- Any file under `tests/`

To add a new submit path, wrap it with `guard()` rather than adding it to the allowlist.

---

## Adding a New Write Flow

1. Call `useWriteGuard()` at the top of the component.
2. Mount `<MainnetConfirmDialog {...dialogProps} />` in the JSX return.
3. Replace the direct submit call:
   ```diff
   - await doSubmit();
   + guard({ action: 'describe the action', onConfirm: doSubmit });
   ```
4. Optionally show a `isReadOnlyLocked` inline banner.
5. The `local/no-direct-submit` lint rule will catch any missed paths at CI time.

---

## Security Notes

- The typed-confirmation phrase (`mainnet`) is deliberately short and specific — it forces conscious intent rather than a click-through.
- The read-only lock is a **session-scoped** safeguard for developers who want to browse mainnet data without any risk of accidental writes. It is not a security boundary against malicious code.
- The guard operates entirely client-side. Server-side routes remain protected by existing authentication/authorisation middleware (Bearer token, admin role checks).

---

## Compatibility & Migration

- No breaking changes to existing APIs.
- The existing per-component `MainnetReviewModal` in `ContractInteraction` is preserved as a **secondary** detailed review step after the guard confirms. Both checks run when on mainnet.
- The existing `network === 'mainnet'` inline checks in `TransactionSigner._proceedToSign()` and `Contracts.handleSubmit()` are preserved for backward compatibility; they now fire **after** the guard has already obtained typed confirmation.
- Non-mainnet flows are completely unaffected — `guard()` calls `onConfirm` synchronously on testnet/futurenet/local with zero additional latency.
