# Clipboard confirmation for sensitive values

Copying a secret key, a signed transaction envelope, or a recovery phrase to the
system clipboard is a common way to accidentally leak funds. `CopyableValue` now
gates these values behind a deliberate confirmation step, while keeping
one-click copy for ordinary, non-sensitive values (public keys, hashes, ids).

## How detection works

`src/lib/sensitiveValue.ts` classifies a value into one of:

| Kind           | Detected by                                                    |
| -------------- | -------------------------------------------------------------- |
| `secret-key`   | Stellar StrKey secret (`S` + 55 base32 chars)                  |
| `signed-xdr`   | Base64 XDR envelope beginning `AAAA` (long form)               |
| `unsigned-xdr` | Base64 XDR envelope beginning `AAAA` (short form)              |
| `mnemonic`     | 12/15/18/21/24 lower-case words                                |
| `jwt`          | `eyJ…​.…​.…` bearer/JWT shape                                   |
| `none`         | Everything else                                                |

Non-string input never throws — it is reported as `none`.

## Usage

```tsx
// Auto-detected: shows a confirmation step because this is a secret key.
<CopyableValue value={account.secretKey} />

// Force gating for a custom field that the heuristics can't recognise.
<CopyableValue value={apiToken} sensitive sensitiveLabel="API token" />
```

Behaviour:

1. First click arms the action — the icon switches to a shield and the button
   label becomes **Confirm sensitive copy** (`data-confirming`).
2. Second click performs the copy and fires `onCopy(value)`.
3. Changing the `value` resets the confirmation latch.

Ordinary values copy on the first click exactly as before.

## Failure paths

- Empty values are ignored (no clipboard call, no confirmation prompt).
- A rejected clipboard write is swallowed and leaves the button in the
  actionable state, so the user can retry instead of seeing a false "Copied".

## Testing

- `src/lib/__tests__/sensitiveValue.test.ts` — classification matrix + invalid
  input boundaries.
- `src/components/dashboard/tests/CopyableValue.test.tsx` — one-click normal
  copy, sensitive gating (auto + explicit), empty value, and clipboard rejection.

Run `pnpm run test -- sensitiveValue` and `pnpm run test -- CopyableValue`.
