---
id: accounts
title: Accounts
sidebar_label: Accounts
---

# Accounts

## GET /accounts/{accountId}

Fetch account balances, sequence number, thresholds, signers, and flags for a given Stellar public key.

**Base URL:** `https://horizon-testnet.stellar.org` or `https://horizon.stellar.org`

### Path parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `accountId` | string | ✓ | A valid G... Stellar public key (ED25519, 56 chars) |

### Request

```bash
curl -s "https://horizon-testnet.stellar.org/accounts/GABC...YOUR_PUBLIC_KEY"
```

```js
import { Horizon } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');
const account = await server.loadAccount('GABC...YOUR_PUBLIC_KEY');
```

```python
from stellar_sdk import Server

server = Server("https://horizon-testnet.stellar.org")
account = server.accounts().account_id("GABC...YOUR_PUBLIC_KEY").call()
```

### Response `200 OK`

```json
{
  "id": "GABC...PUBLIC_KEY",
  "account_id": "GABC...PUBLIC_KEY",
  "sequence": "125893021482",
  "subentry_count": 2,
  "last_modified_ledger": 5493201,
  "last_modified_time": "2026-06-02T08:45:12Z",
  "thresholds": {
    "low_threshold": 0,
    "med_threshold": 1,
    "high_threshold": 2
  },
  "flags": {
    "auth_required": false,
    "auth_revocable": false,
    "auth_immutable": false,
    "auth_clawback_enabled": false
  },
  "balances": [
    {
      "balance": "1240.4019234",
      "asset_type": "native"
    },
    {
      "balance": "500.0000000",
      "limit": "922337203685.4775807",
      "asset_type": "credit_alphanum4",
      "asset_code": "USDC",
      "asset_issuer": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
    }
  ],
  "signers": [
    {
      "weight": 1,
      "key": "GABC...PUBLIC_KEY",
      "type": "ed25519_public_key"
    }
  ],
  "data": {}
}
```

### Error responses

| Status | type | Cause |
|---|---|---|
| `400` | `bad_request` | Malformed public key |
| `404` | `not_found` | Account does not exist on this network |

```json
{
  "type": "https://stellar.org/horizon-errors/not_found",
  "title": "Resource Missing",
  "status": 404,
  "detail": "The resource at the url requested was not found."
}
```

---

## GET /accounts/{accountId}/transactions

Paginated list of transactions for an account.

### Query parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | `10` | Records per page (max 200) |
| `order` | string | `asc` | `asc` or `desc` |
| `cursor` | string | — | Paging token for cursor-based navigation |
| `include_failed` | boolean | `false` | Include failed transactions |

### Request

```bash
curl -s "https://horizon-testnet.stellar.org/accounts/GABC.../transactions?limit=20&order=desc"
```

```js
const page = await server
  .transactions()
  .forAccount('GABC...PUBLIC_KEY')
  .limit(20)
  .order('desc')
  .call();

const records = page.records;
const nextPage = await page.next(); // cursor-based
```

```python
page = (
    server.transactions()
    .for_account("GABC...PUBLIC_KEY")
    .limit(20)
    .order(desc=True)
    .call()
)
records = page["_embedded"]["records"]
```

---

## GET /accounts/{accountId}/operations

Paginated list of operations for an account.

### Request

```bash
curl -s "https://horizon-testnet.stellar.org/accounts/GABC.../operations?limit=20&order=desc"
```

```js
const ops = await server
  .operations()
  .forAccount('GABC...PUBLIC_KEY')
  .limit(20)
  .order('desc')
  .call();
```

---

## SDK helper — `fetchAccount`

The dashboard wraps Horizon calls in `src/lib/stellar.ts` with caching and circuit-breaking:

```ts
import { fetchAccount } from '@/lib/stellar';

// Cached, circuit-broken, network-aware
const account = await fetchAccount('GABC...PUBLIC_KEY', 'testnet');
console.log(account.balances);
```

Returns the full `Horizon.AccountResponse` type from `@stellar/stellar-sdk`.
