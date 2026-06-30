# Data Export & Import

Dashboard backup, CSV/JSON export, and restore functionality.

The feature is accessible from two places:

- **Sidebar → Export** (`/dataExport`) — a dedicated full-page panel.
- **Settings → Export & Import** — an embedded panel at the bottom of the Settings page.

---

## User Flow

### Exporting

1. Connect a Stellar account.
2. Navigate to **Export** in the sidebar (or scroll to **Export & Import** in **Settings**).
3. Choose an export action:
   - **Export Dashboard Backup (JSON)** — downloads a `stellar-<key>-backup.json` file containing
     theme, network, and account preferences. Use this to restore your dashboard state later.
   - **Export Transactions (CSV)** — downloads all currently loaded transactions as
     `stellar-transactions.csv`. Requires at least one transaction to be loaded.
   - **Export Balances (CSV)** — downloads the account's asset balances as
     `stellar-balances.csv`. Requires at least one balance entry.

### Importing

1. Navigate to **Export** in the sidebar (or **Settings → Export & Import**).
2. Click **Choose Backup File** and select a `.json` file previously exported from the dashboard.
3. The file is validated:
   - Must be valid JSON.
   - Must contain a `version` field matching a supported version (`1`).
   - Must contain `exportedAt` and `account` fields.
4. On success a green confirmation message is shown and the store is updated (theme, network,
   watched addresses).
5. On failure a red error message describes exactly what went wrong.

---

## Architecture

```
src/
├── components/dashboard/DataExport.jsx   # UI panel (export buttons + import file input)
├── hooks/useDataExport.js                # React hook — wires UI to export/import logic
├── utils/export.js                       # Pure functions: download trigger, CSV/JSON builders
└── lib/import.js                         # Pure functions: parse, validate, apply backup
```

### Data flow — Export

```
User clicks button
  → useDataExport.exportDashboard()
      → buildBackupPayload(store)   [utils/export.js]
      → exportJson(payload, name)   [utils/export.js]
          → Blob → URL.createObjectURL → <a>.click()
```

### Data flow — Import

```
User selects file
  → useDataExport.importBackup(file)
      → readFileAsText(file)            [lib/import.js]
      → parseBackup(text)               [lib/import.js]  — JSON.parse + version check
      → validateBackupPayload(data)     [lib/import.js]  — required field checks
      → applyBackupToStore(data, store) [lib/import.js]  — whitelisted store updates
```

---

## API Reference

### `src/utils/export.js`

#### `exportJson(data, filename)`

Serialise `data` to pretty-printed JSON and trigger a browser download as `filename.json`.

#### `exportCsv(rows, filename, columns?)`

Convert an array of objects to CSV and download as `filename.csv`. Column order follows the
`columns` array, or `Object.keys(rows[0])` if omitted. Values containing commas, quotes, or
newlines are properly escaped (RFC 4180).

#### `buildBackupPayload(state)`

Return the backup object without triggering a download. Shape:

```json
{
  "version": 1,
  "exportedAt": "2024-01-01T00:00:00.000Z",
  "account": {
    "connectedAddress": "G...",
    "network": "testnet"
  },
  "watchedAddresses": [],
  "customNetworks": [],
  "theme": "dark",
  "activeTab": "overview"
}
```

#### `flattenTransaction(tx)`

Flatten a Horizon transaction record to a plain CSV-friendly row:

| Field | Source |
|---|---|
| `id` | `tx.id` |
| `hash` | `tx.hash` |
| `ledger` | `tx.ledger` |
| `created_at` | `tx.created_at` |
| `source_account` | `tx.source_account` |
| `fee_charged` | `tx.fee_charged` |
| `operation_count` | `tx.operation_count` |
| `successful` | `tx.successful` |
| `memo_type` | `tx.memo_type` |
| `memo` | `tx.memo` |

#### `flattenBalance(balance)`

Flatten a Horizon balance record to a plain CSV-friendly row:

| Field | Source |
|---|---|
| `asset_type` | `balance.asset_type` |
| `asset_code` | `balance.asset_code` (defaults to `XLM`) |
| `asset_issuer` | `balance.asset_issuer` |
| `balance` | `balance.balance` |
| `limit` | `balance.limit` |
| `buying_liabilities` | `balance.buying_liabilities` |
| `selling_liabilities` | `balance.selling_liabilities` |

---

### `src/lib/import.js`

#### `parseBackup(jsonString)`

Parse and validate a backup JSON string.

**Returns:** `{ ok: true, data } | { ok: false, error: string }`

Error cases:
- `"File is not valid JSON."` — JSON.parse failed.
- `"Backup file has an unexpected format."` — parsed value is not an object.
- `"Unsupported backup version: X. Expected one of: 1."` — version mismatch.

#### `readFileAsText(file)`

Read a `File` object (from `<input type="file">`) and return its text content as a
`Promise<string>`. Rejects with `"Could not read file."` on FileReader error.

#### `validateBackupPayload(data)`

Check required fields. Returns an array of error strings (empty array = valid).

Checked fields:
- `exportedAt` — must be present.
- `account` — must be a non-null object.

#### `applyBackupToStore(data, store)`

Apply whitelisted fields from a validated backup payload to the Zustand store.
Only the following fields are restored (prototype pollution guard):

| Backup field | Store action |
|---|---|
| `theme` (`"dark"` or `"light"`) | `store.setTheme()` |
| `account.network` | `store.setNetwork()` |
| `watchedAddresses` (array) | `store.setWatchedAddresses()` |

---

### `src/hooks/useDataExport.js`

```js
import { useDataExport } from './src/hooks/useDataExport';

const {
  isExporting,         // boolean — true while a download is being built
  isImporting,         // boolean — true while a file is being read/validated
  exportError,         // string | null — last export error message
  importError,         // string | null — last import error message
  importSuccess,       // boolean — true after a successful import
  exportDashboard,     // () => void  — downloads JSON backup
  exportTransactions,  // (txs: Object[]) => void — downloads CSV
  exportBalances,      // (balances: Object[]) => void — downloads CSV
  importBackup,        // async (file: File) => void
} = useDataExport();
```

---

## Supported Backup Versions

| Version | Status |
|---|---|
| `1` | Supported (current) |

When a new field is added to the backup payload, increment the version number and update
`SUPPORTED_VERSIONS` in `src/lib/import.js`.

---

## Testing

Unit tests live in `src/hooks/useDataExport.test.js` and cover:

- `exportDashboard` triggers a JSON Blob download.
- `exportTransactions` triggers a CSV Blob download.
- `exportBalances` triggers a CSV Blob download.
- `importBackup` with a valid file sets `importSuccess = true`.
- `importBackup` with invalid JSON sets a descriptive `importError`.
- `importBackup` with an unsupported version sets a descriptive `importError`.
- `importBackup` with a missing required field sets a descriptive `importError`.

Run with:

```bash
npm run test:unit -- src/hooks/useDataExport.test.js
```
