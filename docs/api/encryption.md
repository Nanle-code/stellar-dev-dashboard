# encryption.js

AES-GCM encryption for sensitive data using the Web Crypto API. No external dependencies.

## Functions

### `encrypt(plaintext, passphrase)`

Encrypts a string using AES-256-GCM. Derives a key from the passphrase using PBKDF2.

```js
import { encrypt } from './src/lib/encryption';

const result = await encrypt('S...secret-key...', 'my-passphrase');
// result: { ciphertext: string, iv: string, salt: string }
```

| Param | Type | Description |
|-------|------|-------------|
| plaintext | string | Data to encrypt |
| passphrase | string | User-provided passphrase for key derivation |

Returns: `Promise<{ ciphertext: string, iv: string, salt: string }>`

All values are base64-encoded strings safe for storage.

---

### `decrypt(ciphertext, passphrase, iv, salt)`

Decrypts data encrypted with `encrypt()`.

```js
import { decrypt } from './src/lib/encryption';

const secret = await decrypt(stored.ciphertext, 'my-passphrase', stored.iv, stored.salt);
```

Returns: `Promise<string>`

Throws if the passphrase is wrong or data is corrupted.

---

### `generateKey()`

Generates a random 256-bit encryption key as a base64 string. Useful for app-level encryption without a user passphrase.

```js
import { generateKey } from './src/lib/encryption';

const key = await generateKey();
```

Returns: `Promise<string>` (base64)

---

## Security Notes

- Keys are derived using PBKDF2 with 100,000 iterations and SHA-256
- Each encryption call generates a fresh random IV and salt
- AES-256-GCM provides both confidentiality and integrity (authenticated encryption)
- Never store the passphrase alongside the ciphertext
- For production use, consider hardware wallet signing instead of local key storage

---

## Encrypted Template Export Format (Issue #178)

Transaction template export/import uses `encrypt()` / `decrypt()` and produces a portable JSON file.

**File shape (v1):**

```json
{
  "format": "stellar-dev-dashboard.transaction-templates",
  "version": 1,
  "encrypted": { "ciphertext": "...", "iv": "...", "salt": "..." },
  "exportedAt": "2026-05-29T12:34:56.000Z"
}
```

Decrypted plaintext is a JSON pack:

```json
{ "version": 1, "templates": [/*...*/], "updatedAt": "..." }
```

**Storage-at-rest**

Locally saved templates are stored encrypted in IndexedDB via `setEncryptedValue()` / `getEncryptedValue()` in `src/lib/storage.js`.
No plaintext templates or passphrases are persisted.
