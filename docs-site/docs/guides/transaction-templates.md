---
id: transaction-templates
title: Transaction Templates
sidebar_label: Transaction Templates
---

# Transaction Templates

The dashboard ships with pre-built transaction templates that cover the most common Stellar workflows. Templates are defined in `src/lib/transactionTemplates.js` and can be cloned, customised, and executed without touching the raw SDK.

## Available templates

| ID | Label | Description |
|---|---|---|
| `simple_payment` | Simple XLM Payment | Send native XLM to a destination |
| `asset_payment` | Custom Asset Payment | Send any trustline asset |
| `add_trustline` | Add Trustline | Accept a new custom asset |
| `create_account` | Create & Fund Account | Create and seed a new account |
| `path_payment` | Path Payment (Cross-Asset) | DEX swap in a single operation |
| `set_home_domain` | Set Home Domain | Update the account's home domain |
| `account_merge` | Merge Account | Close account and transfer balance |
| `bump_sequence` | Bump Sequence | Invalidate pending transactions |

## Using templates in code

```ts
import { cloneTemplate, TRANSACTION_TEMPLATES } from '@/lib/transactionTemplates';
import { buildTransaction, signAndSubmitTransaction } from '@/lib/transactionBuilder';

// List all available templates
console.log(TRANSACTION_TEMPLATES.map(t => `${t.id}: ${t.label}`));

// Clone a template (deep copy — original is never mutated)
const tpl = cloneTemplate('simple_payment');

// Customise the cloned template
tpl.operations[0].params.destination = 'GDEST...RECIPIENT';
tpl.operations[0].params.amount = '25';
tpl.memo = 'Payment for services';

// Build and submit
const tx = await buildTransaction({
  ...tpl,
  sourceAccount: 'GABC...PUBLIC_KEY',
  network: 'testnet',
});

const result = await signAndSubmitTransaction(tx, 'SXXX...SECRET', 'testnet');
console.log('Hash:', result.hash);
```

## Simulate before sending

```ts
import { simulateTransaction } from '@/lib/transactionBuilder';

const report = await simulateTransaction({
  ...tpl,
  sourceAccount: 'GABC...',
  network: 'testnet',
});

if (!report.success) {
  console.error('Errors:', report.errors);
} else {
  console.log(`Fee: ${report.fee} stroops | Operations: ${report.operationCount}`);
  console.log('XDR:', report.xdr);
}
```

## Export and import templates (encrypted)

Templates can be exported as an encrypted JSON file and re-imported later:

```ts
import { downloadScaffold, exportContractSpec } from '@/lib/contractDevelopment';

// Export a contract scaffold bundle
downloadScaffold('token');   // triggers browser download of spec + README + source
```

The encrypted export format:

```json
{
  "format": "stellar-dev-dashboard.transaction-templates",
  "version": 1,
  "encrypted": { "ciphertext": "...", "iv": "...", "salt": "..." },
  "exportedAt": "2026-06-02T12:00:00.000Z"
}
```

Decrypt with `src/lib/encryption.js`:

```ts
import { decrypt } from '@/lib/encryption';

const json = await decrypt(exported.encrypted.ciphertext, passphrase, exported.encrypted.iv, exported.encrypted.salt);
const { templates } = JSON.parse(json);
```

## Creating a custom template

```ts
import { TRANSACTION_TEMPLATES } from '@/lib/transactionTemplates';

// Push a custom template into the array (runtime only)
TRANSACTION_TEMPLATES.push({
  id: 'my_airdrop',
  label: 'Token Airdrop',
  description: 'Send tokens to multiple recipients in one transaction',
  operations: [
    { type: 'payment', params: { destination: '', assetType: 'credit_alphanum4', assetCode: 'MYTKN', assetIssuer: 'GABC...', amount: '100' } },
    { type: 'payment', params: { destination: '', assetType: 'credit_alphanum4', assetCode: 'MYTKN', assetIssuer: 'GABC...', amount: '100' } },
  ],
  memo: 'Airdrop',
  memoType: 'text',
});
```
