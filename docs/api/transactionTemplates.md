# transactionTemplates.js

Pre-built transaction templates for the Advanced Transaction Builder.

## `TRANSACTION_TEMPLATES`

Array of template objects. Each template has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `label` | `string` | Human-readable name |
| `description` | `string` | One-line explanation |
| `operations` | `Array` | Default operation list (same shape as `buildTransaction` input) |
| `memo` | `string` | Default memo text |
| `memoType` | `string` | Default memo type (`text` \| `id` \| …) |

### Available templates

| id | label |
|----|-------|
| `simple_payment` | Simple XLM Payment |
| `asset_payment` | Custom Asset Payment |
| `add_trustline` | Add Trustline |
| `create_account` | Create & Fund Account |
| `path_payment` | Path Payment (Cross-Asset) |
| `set_home_domain` | Set Home Domain |
| `account_merge` | Merge Account |
| `bump_sequence` | Bump Sequence |

## `getTemplate(id)`

Return the template with the given `id`, or `undefined` if not found.

## `cloneTemplate(id)`

Deep-clone a template so edits don't mutate the original constant. Returns `null` if the id is not found.

```js
import { cloneTemplate } from './src/lib/transactionTemplates';

const tpl = cloneTemplate('simple_payment');
tpl.operations[0].params.destination = 'G...';
tpl.operations[0].params.amount = '50';
// tpl is now ready to pass to buildTransaction()
```
