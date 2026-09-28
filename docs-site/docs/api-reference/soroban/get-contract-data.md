---
id: get-contract-data
title: getContractData (getLedgerEntries)
sidebar_label: getContractData
---

# getContractData / getLedgerEntries

Read contract storage entries from the ledger without submitting a transaction.

## Request

```bash
curl -s -X POST "https://soroban-testnet.stellar.org" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "data-1",
    "method": "getLedgerEntries",
    "params": {
      "keys": ["AAAAB...XDR_LEDGER_KEY..."]
    }
  }'
```

```js
import {
  SorobanRpc, xdr, Contract, nativeToScVal, scValToNative
} from '@stellar/stellar-sdk';

const rpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org');

// Build the ledger key for a contract data entry
const contractId = 'CBXG...CONTRACT_ID';
const key = nativeToScVal('Counter', { type: 'symbol' });

const ledgerKey = xdr.LedgerKey.contractData(
  new xdr.LedgerKeyContractData({
    contract: new Contract(contractId).address().toScAddress(),
    key,
    durability: xdr.ContractDataDurability.persistent(),
  })
);

const result = await rpc.getLedgerEntries(ledgerKey);

if (result.entries.length > 0) {
  const entry = result.entries[0];
  const val = xdr.LedgerEntryData.fromXDR(entry.xdr, 'base64');
  const native = scValToNative(val.contractData().val());
  console.log('Counter value:', native);
}
```

## Response

```json
{
  "jsonrpc": "2.0",
  "id": "data-1",
  "result": {
    "entries": [
      {
        "key": "AAAAB...LEDGER_KEY_XDR...",
        "xdr": "AAAAB...LEDGER_ENTRY_XDR...",
        "lastModifiedLedgerSeq": 5493100,
        "liveUntilLedgerSeq": 5493700
      }
    ],
    "latestLedger": 5493230
  }
}
```

## Field reference

| Field | Description |
|---|---|
| `entries[].xdr` | Base64 XDR `LedgerEntryData` — decode with `xdr.LedgerEntryData.fromXDR` |
| `entries[].lastModifiedLedgerSeq` | Ledger sequence when this entry was last written |
| `entries[].liveUntilLedgerSeq` | Ledger sequence when this entry expires (TTL) |

:::tip Checking expiry
If `liveUntilLedgerSeq` is close to `latestLedger`, you may need to call `extendContractDataFootprintTtl` to bump the TTL before the entry is archived.
:::
