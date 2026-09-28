---
id: get-events
title: getEvents
sidebar_label: getEvents
---

# getEvents

Query contract-emitted events from the ledger. Useful for off-chain indexing and real-time activity feeds.

## Request

```bash
curl -s -X POST "https://soroban-testnet.stellar.org" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "events-1",
    "method": "getEvents",
    "params": {
      "startLedger": 5493000,
      "filters": [
        {
          "type": "contract",
          "contractIds": ["CBXG...CONTRACT_ID"],
          "topics": [["*", "*"]]
        }
      ],
      "pagination": { "limit": 20 }
    }
  }'
```

```js
import { SorobanRpc } from '@stellar/stellar-sdk';

const rpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org');

const { events } = await rpc.getEvents({
  startLedger: 5493000,
  filters: [
    {
      type: 'contract',
      contractIds: ['CBXG...CONTRACT_ID'],
      topics: [['*', '*']],
    },
  ],
  limit: 20,
});

for (const event of events) {
  console.log('Ledger:', event.ledger);
  console.log('Topics:', event.topic.map(t => t.toString()));
  console.log('Value:', event.value.toString());
}
```

## Response

```json
{
  "jsonrpc": "2.0",
  "id": "events-1",
  "result": {
    "events": [
      {
        "type": "contract",
        "ledger": 5493101,
        "ledgerClosedAt": "2026-06-02T09:00:00Z",
        "contractId": "CBXG...CONTRACT_ID",
        "id": "0023452341-0000000001",
        "pagingToken": "0023452341-0000000001",
        "topic": ["AAAADwAAAAhpbmNyZW1lbnQ=", "AAAAEAAAABk="],
        "value": "AAAAEAAAAAE="
      }
    ],
    "latestLedger": 5493230
  }
}
```

## Filter options

| Field | Description |
|---|---|
| `type` | `"contract"`, `"system"`, or `"diagnostic"` |
| `contractIds` | Array of contract IDs to filter by |
| `topics` | Array of topic filter arrays. Use `"*"` as wildcard |

## Pagination

Use `pagination.cursor` from the last event's `pagingToken` to page through large event sets:

```js
const page1 = await rpc.getEvents({ startLedger, filters, limit: 20 });
const lastCursor = page1.events.at(-1)?.pagingToken;

const page2 = await rpc.getEvents({
  filters,
  pagination: { limit: 20, cursor: lastCursor },
});
```
