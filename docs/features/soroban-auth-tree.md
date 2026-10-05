# Soroban Contract Authorization Tree (#850)

The Soroban invocation UI now renders an **Authorization Requirements** panel immediately after each simulation. This tree lets developers verify which accounts must sign and what invocations they are authorizing—including cross-contract calls—before committing a transaction.

## Overview

When you simulate a Soroban contract call, the Stellar RPC returns a list of `SorobanAuthorizationEntry` values embedded in the simulation result. Each entry describes:

- **Who must sign** — the `SorobanCredentials` field, which is either the transaction's source account or an explicit Stellar address.
- **What they are authorizing** — the `rootInvocation` tree, which may recursively contain sub-invocations representing cross-contract calls.

The `AuthorizationTree` component reads these entries from the simulation result, serializes them to plain JSON-safe values, and renders the tree visually in the Contract Interaction panel.

## Using the feature

1. Open the **Contract Interaction** panel and enter a valid contract ID, function name, and arguments.
2. Click **Simulate**.
3. If the contract function requires any authorization, the **Authorization Requirements** panel appears below the simulation output.
4. Each signer entry shows:
   - A color-coded credentials badge (green for source-account signers, orange for explicit address signers).
   - The nonce and signature-expiration ledger for address credentials.
   - An expandable invocation tree with every function name and contract address the signer is authorizing, including nested cross-contract calls.

## Security guidance

- **Always inspect before signing.** The authorization tree shows the full scope of what a signer is committing to. An entry that lists only the expected top-level function is very different from one with unexpected sub-invocations (potential rug-pull patterns).
- **Address credentials with an expiry ledger close to the current ledger** should be treated with extra caution—the window for replay may still be open.
- **Source-account credentials** authorize the transaction signer directly. If you see a source-account entry for a function you did not expect to call, abort and investigate the contract.
- All displayed values originate from XDR data returned by the Soroban RPC server. React's default string escaping prevents XSS; no raw HTML is rendered.

## Compatibility

| Requirement | Notes |
|---|---|
| Stellar SDK | `@stellar/stellar-sdk` ≥ 17 (already required by this project) |
| Soroban Protocol | Protocol 20 and later (the `auth` field on `SimulateHostFunctionResult` was introduced in Protocol 20) |
| Browser | Any modern browser; no additional APIs required |
| Network | Works on Testnet, Mainnet, and custom networks |

## Migration notes

- No breaking changes. The `authEntries` field was **added** to `ContractSimulationResult`; existing callers that don't reference it are unaffected.
- The `AuthorizationTree` component renders `null` when `authEntries` is empty or absent, so rendering it unconditionally after a simulation result is safe.
- Simulations of non-invocation transactions (e.g. restoring a footprint) return no `result` object, and therefore no auth entries. The panel will not appear for those simulations.

## Data model reference

The serialized types used by `AuthorizationTree` are exported from `src/lib/stellar.ts`:

```typescript
// Top-level entry
interface SerializedAuthEntry {
  credentials: SerializedAuthCredentials;
  rootInvocation: SerializedAuthInvocation;
}

// Discriminated union for credentials
type SerializedAuthCredentials =
  | { type: 'source_account' }
  | {
      type: 'address';
      address: string;       // Stellar G... address
      nonce: string;         // i64 nonce as decimal string
      signatureExpirationLedger: number;
    };

// Recursive invocation node
interface SerializedAuthInvocation {
  functionType: 'contract_fn' | 'create_contract' | 'create_contract_v2' | 'unknown';
  contractAddress: string;  // empty for host-function variants
  functionName: string;     // empty for host-function variants
  args: unknown[];          // serialized ScVal values
  subInvocations: SerializedAuthInvocation[];
}
```

## Component API

```tsx
import AuthorizationTree from 'src/components/dashboard/AuthorizationTree';

<AuthorizationTree
  authEntries={simulationResult.authEntries}
  // Optional CSS class forwarded to the outer wrapper div.
  className="my-custom-class"
/>
```

The component accepts `authEntries?: SerializedAuthEntry[]` and renders nothing (`null`) when the array is empty or the prop is absent/null/non-array.
