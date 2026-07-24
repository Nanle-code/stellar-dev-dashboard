# Stellar Dev Dashboard — Public API Proposal

> **Status:** Draft · v0.2  
> **Intended audience:** Backend engineers, integrators, and Stellar ecosystem developers  
> **Scope:** Read-only REST API exposing enriched transaction data, relationship analysis, time-series metrics, and cross-network status. Does **not** replace Stellar Horizon or Soroban RPC — it augments them with derived analytics.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Base URL & Versioning](#2-base-url--versioning)
3. [Authentication](#3-authentication)
4. [Rate Limits](#4-rate-limits)
5. [Caching](#5-caching)
6. [Common Headers](#6-common-headers)
7. [Endpoints](#7-endpoints)
   - 7.1 [Account Enrichment](#71-account-enrichment)
   - 7.2 [Relationship Graph](#72-relationship-graph)
   - 7.3 [Time-Series Analytics](#73-time-series-analytics)
   - 7.4 [Cross-Network Status](#74-cross-network-status)
   - 7.5 [Address Labels](#75-address-labels)
   - 7.6 [Entity Clusters](#76-entity-clusters)
8. [Schemas](#8-schemas)
9. [Error Handling](#9-error-handling)
10. [Pagination](#10-pagination)
11. [Examples](#11-examples)
12. [Rate Limit Headers](#12-rate-limit-headers)
13. [Glossary](#13-glossary)

---

## 1. Design Principles

- **Read-only by design.** Write operations (transactions, contract calls) go through Horizon or Soroban RPC directly.
- **Derived data only.** We do not mirror Horizon data — we compute relationships, time-bucketed metrics, entity clusters, and enriched labels.
- **Network-aware.** Every resource is scoped to a Stellar network (`mainnet`, `testnet`, `futurenet`). Cross-network queries are explicit.
- **Cache-friendly.** All responses include `ETag` and `Cache-Control` headers. Clients should respect these before re-requesting.
- **Pagination via cursor.** List endpoints use cursor-based pagination with a `Link` header (RFC 5988).

---

## 2. Base URL & Versioning

```
https://api.stellar-dashboard.io/v1
```

All requests require the `Accept: application/json` header. The API version is embedded in the path (`/v1/`). Breaking changes increment the version number; backward-compatible additions are released within the current version.

| Environment | Base URL |
|---|---|
| Production | `https://api.stellar-dashboard.io/v1` |
| Staging | `https://api-staging.stellar-dashboard.io/v1` |
| Development | `https://api-dev.stellar-dashboard.io/v1` |

---

## 3. Authentication

### 3.1 API Key (recommended)

```
Authorization: Bearer sd_abc123def456ghi789jkl
```

API keys are provisioned per-project. Each key is bound to:

- Rate limit tier (see §4)
- Allowed networks (e.g., mainnet-only, testnet-only, or all)
- Allowed origin domains (CORS enforcement)

Keys are prefixed with `sd_` and are 32 bytes (encoded as 43 Base64URL characters).

**Key management endpoints** (admin-only, out of scope for this proposal):

- `POST /v1/admin/keys` — create a new key
- `GET /v1/admin/keys` — list keys
- `DELETE /v1/admin/keys/{id}` — revoke a key

### 3.2 Unauthenticated Access

Unauthenticated requests are limited to:

- 100 requests per hour
- `GET /v1/networks/status` only
- No label CRUD or relationship queries

Unauthenticated requests omit the `Authorization` header.

---

## 4. Rate Limits

| Tier | Requests / second | Burst | Monthly quota | Cost model |
|---|---|---|---|---|
| Free (unauthenticated) | — | — | 100/hr | Free |
| Developer | 10 | 20 | 100,000 | Free |
| Professional | 50 | 100 | 1,000,000 | Paid |
| Enterprise | 200 | 500 | Custom | Custom |

Rate limits are applied per API key, sliding window. Exceeding the burst returns `429 Too Many Requests`. All rate limit headers are documented in §12.

---

## 5. Caching

### 5.1 Server-side

All derived metrics are cached for a minimum of 30 seconds and a maximum of 5 minutes depending on the endpoint's computational cost. Cache TTLs are documented per-endpoint in §7.

### 5.2 Client-side

| Header | Behaviour |
|---|---|
| `ETag` | Content-based hash. Send `If-None-Match` in subsequent requests. Server responds `304 Not Modified` with empty body if unchanged. |
| `Cache-Control` | `public, max-age={ttl}` where `ttl` is in seconds. Clients should honour this before re-fetching. |
| `Age` | How many seconds ago the response was generated (from server cache). |

### 5.3 Stale-while-revalidate

Responses include `stale-while-revalidate=30` in `Cache-Control`, allowing clients to serve stale data for up to 30 seconds while the server re-computes in the background.

---

## 6. Common Headers

### Request

| Header | Required | Description |
|---|---|---|
| `Accept` | Yes | Must be `application/json` |
| `Authorization` | Conditional | `Bearer sd_...` (required for authenticated endpoints) |
| `If-None-Match` | No | ETag from previous response for cache validation |
| `X-Network` | No | Target Stellar network: `mainnet`, `testnet`, `futurenet` (default: `mainnet`) |

### Response

| Header | Description |
|---|---|
| `Content-Type` | Always `application/json` |
| `ETag` | Content-based hash for cache validation |
| `Cache-Control` | Caching policy with max-age and stale-while-revalidate |
| `Age` | Server-cache age in seconds |
| `X-Request-Id` | Unique request identifier for debugging |
| `X-Network` | Network used to serve the request |
| `Link` | Pagination links (RFC 5988) for list endpoints |

---

## 7. Endpoints

### 7.1 Account Enrichment

Derived metrics for a single Stellar account.

#### `GET /v1/{network}/accounts/{address}`

**Cache TTL:** 60 s  
**Scope:** Authenticated (developer tier or higher)

Retrieves enriched account data combining live Horizon state with computed analytics.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `network` | string | `mainnet`, `testnet`, or `futurenet` |
| `address` | string | Stellar public key (G...) |

**Response `200 OK`:**

```json
{
  "address": "GA7QVNHE3H4H4Q3H4H4Q3H4H4Q3H4H4Q3H4H4Q3H4H4",
  "network": "mainnet",
  "enriched_at": "2026-06-24T12:00:00Z",
  "horizon": {
    "balance": "12500.5000000",
    "subentry_count": 12,
    "sequence": "187654321",
    "signers": 3
  },
  "analytics": {
    "total_transactions": 8472,
    "total_operations": 15420,
    "first_seen": "2022-03-15T08:30:00Z",
    "last_active": "2026-06-23T22:15:00Z",
    "avg_daily_ops_30d": 12.4,
    "peak_hour_utc": 14,
    "peak_day": "Wed"
  },
  "counterparties": {
    "unique_count": 342,
    "top_by_volume": [
      {"address": "GCV...ABCD", "label": "Exchange Hot Wallet", "volume_xlm": 12500000, "tx_count": 452}
    ]
  },
  "labels": {
    "self": "My Trading Bot",
    "tags": ["trading", "automated", "high-volume"],
    "category": "personal"
  }
}
```

---

#### `GET /v1/{network}/accounts/{address}/activity`

**Cache TTL:** 120 s  
**Scope:** Authenticated

Returns time-bucketed activity counts.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `granularity` | string | `day` | `hour`, `day`, `week` |
| `from` | ISO 8601 | 30 days ago | Inclusive start |
| `to` | ISO 8601 | now | Exclusive end |

**Response `200 OK`:**

```json
{
  "address": "GA7Q...",
  "network": "mainnet",
  "granularity": "day",
  "buckets": [
    {"timestamp": "2026-06-01T00:00:00Z", "operations": 142, "transactions": 89, "volume_xlm": 25000.50},
    {"timestamp": "2026-06-02T00:00:00Z", "operations": 98, "transactions": 61, "volume_xlm": 12500.00}
  ]
}
```

---

### 7.2 Relationship Graph

Computed entity relationships for an address.

#### `GET /v1/{network}/accounts/{address}/relationships`

**Cache TTL:** 120 s  
**Scope:** Authenticated (professional tier or higher)

Returns ranked counterparties with composite relationship scores.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `min_score` | float | `0` | Minimum relationship score (0–1) |
| `limit` | integer | `25` | Max relationships to return |
| `cursor` | string | — | Pagination cursor |
| `include_self` | boolean | `false` | Include relationships where address is on both sides |

**Response `200 OK`:**

```json
{
  "address": "GA7Q...",
  "network": "mainnet",
  "count": 25,
  "has_more": true,
  "next_cursor": "eyJsYXN0X3Njb3JlIjogMC41Mn0=",
  "relationships": [
    {
      "counterparty": "GCV...ABCD",
      "label": "Exchange Hot Wallet",
      "score": 0.87,
      "metrics": {
        "tx_count": 452,
        "volume_xlm": 12500000,
        "first_seen": "2023-01-10T00:00:00Z",
        "last_seen": "2026-06-23T18:30:00Z",
        "is_bidirectional": true,
        "operation_types": ["payment", "manage_buy_offer", "manage_sell_offer"]
      },
      "breakdown": {
        "frequency": 0.92,
        "volume": 0.78,
        "recency": 0.95,
        "directionality": 1.0,
        "diversity": 0.6
      }
    }
  ]
}
```

---

#### `GET /v1/{network}/accounts/{address}/graph`

**Cache TTL:** 300 s  
**Scope:** Authenticated (professional tier or higher)

Full graph payload for force-directed rendering. Optimized for Cytoscape.js / react-force-graph consumption.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `depth` | integer | `1` | Degrees of separation from address (`1` or `2`) |
| `min_tx` | integer | `1` | Minimum transaction count for edge inclusion |
| `limit` | integer | `200` | Maximum nodes to return |

**Response `200 OK`:**

```json
{
  "address": "GA7Q...",
  "network": "mainnet",
  "generated_at": "2026-06-24T12:00:00Z",
  "nodes": [
    {"id": "GA7Q...", "label": "You", "tx_count": 8472, "is_central": true, "importance": 0.95},
    {"id": "GCV...ABCD", "label": "Exchange Hot Wallet", "tx_count": 452, "is_central": false, "importance": 0.72}
  ],
  "edges": [
    {"source": "GA7Q...", "target": "GCV...ABCD", "tx_count": 452, "score": 0.87, "types": ["payment"]}
  ],
  "clusters": [
    {"id": 0, "size": 12, "member_addresses": ["GA7Q...", "GCV...ABCD"]}
  ]
}
```

---

### 7.3 Time-Series Analytics

Aggregated metrics across all observed addresses for a network.

#### `GET /v1/{network}/analytics/activity`

**Cache TTL:** 300 s  
**Scope:** Authenticated (professional tier)

Time-bucketed network activity.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `granularity` | string | `day` | `hour`, `day`, `week` |
| `from` | ISO 8601 | 7 days ago | Inclusive start |
| `to` | ISO 8601 | now | Exclusive end |
| `type` | string | `all` | Operation type filter (`payment`, `manage_buy_offer`, ...) |

**Response `200 OK`:**

```json
{
  "network": "mainnet",
  "granularity": "day",
  "from": "2026-06-17T00:00:00Z",
  "to": "2026-06-24T00:00:00Z",
  "buckets": [
    {
      "timestamp": "2026-06-17T00:00:00Z",
      "operations": 15842,
      "transactions": 12004,
      "volume_xlm": 3420000,
      "by_type": {
        "payment": 8900,
        "manage_buy_offer": 3200,
        "manage_sell_offer": 1800,
        "create_account": 500
      }
    }
  ]
}
```

---

#### `GET /v1/{network}/analytics/hourly-pattern`

**Cache TTL:** 600 s  
**Scope:** Authenticated (professional tier)

Aggregate activity distribution by hour of day (0–23) over a lookback window.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `lookback_days` | integer | `30` | Number of days to aggregate |

**Response `200 OK`:**

```json
{
  "network": "mainnet",
  "lookback_days": 30,
  "distribution": [
    {"hour": 0, "fraction": 0.032},
    {"hour": 1, "fraction": 0.028}
  ]
}
```

---

### 7.4 Cross-Network Status

#### `GET /v1/networks/status`

**Cache TTL:** 30 s  
**Scope:** Unauthenticated (public)

Live status of all Stellar networks probed from this API's edge locations.

**Response `200 OK`:**

```json
{
  "probed_at": "2026-06-24T12:00:05Z",
  "networks": [
    {
      "network": "mainnet",
      "label": "Mainnet",
      "horizon_status": "up",
      "horizon_latency_ms": 120,
      "soroban_status": "up",
      "soroban_latency_ms": 450,
      "last_ledger_sequence": 51234567,
      "last_ledger_closed_at": "2026-06-24T12:00:00Z"
    },
    {
      "network": "testnet",
      "label": "Testnet",
      "horizon_status": "up",
      "horizon_latency_ms": 85,
      "soroban_status": "degraded",
      "soroban_latency_ms": 2200,
      "last_ledger_sequence": 4123456,
      "last_ledger_closed_at": "2026-06-24T11:59:55Z"
    },
    {
      "network": "futurenet",
      "label": "Futurenet",
      "horizon_status": "down",
      "horizon_latency_ms": null,
      "soroban_status": "down",
      "soroban_latency_ms": null,
      "last_ledger_sequence": null,
      "last_ledger_closed_at": null
    }
  ]
}
```

---

#### `POST /v1/accounts/resolve`

**Cache TTL:** 60 s  
**Scope:** Authenticated (developer tier or higher)

Resolve a single address across multiple Stellar networks simultaneously.

**Request body:**

```json
{
  "address": "GA7QVNHE3H4H4Q3H4H4Q3H4H4Q3H4H4Q3H4H4Q3H4H4",
  "networks": ["mainnet", "testnet", "futurenet"]
}
```

**Response `200 OK`:**

```json
{
  "address": "GA7Q...",
  "resolved_at": "2026-06-24T12:00:00Z",
  "results": {
    "mainnet": {"exists": true, "balance": "12500.5000000", "sequence": "187654321"},
    "testnet": {"exists": true, "balance": "10000.0000000", "sequence": "95000000"},
    "futurenet": {"exists": false, "error": "account not found"}
  }
}
```

---

### 7.5 Address Labels

End-user managed labels and tags for addresses. Labels are private to the authenticated API key's project.

#### `GET /v1/labels`

**Cache TTL:** 10 s (labels change infrequently but must reflect quickly)  
**Scope:** Authenticated

List all saved labels for the authenticated project.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `search` | string | — | Filter by address, label, or tag |
| `category` | string | — | `personal`, `exchange`, `defi`, `nft`, `custodial`, `contract`, `other` |
| `favorites_only` | boolean | `false` | Only return starred addresses |

**Response `200 OK`:**

```json
{
  "count": 42,
  "labels": [
    {
      "id": "lbl_abc123",
      "address": "GCV...ABCD",
      "label": "Exchange Hot Wallet",
      "tags": ["exchange", "hot-wallet", "high-volume"],
      "category": "exchange",
      "color": "#f59e0b",
      "favorite": true,
      "notes": "Primary exchange deposit address",
      "network": "mainnet",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2026-06-20T14:30:00Z"
    }
  ]
}
```

---

#### `POST /v1/labels`

**Scope:** Authenticated

Create a new label.

**Request body:**

```json
{
  "address": "GCV...ABCD",
  "label": "Exchange Hot Wallet",
  "tags": ["exchange", "hot-wallet"],
  "category": "exchange",
  "color": "#f59e0b",
  "favorite": false,
  "notes": "Primary exchange deposit address",
  "network": "mainnet"
}
```

**Response `201 Created`:** Returns the created label object (as above, including `id`, `created_at`, `updated_at`).

---

#### `PATCH /v1/labels/{id}`

**Scope:** Authenticated

Update specific fields on an existing label. Omitting a field leaves it unchanged.

**Request body:**

```json
{
  "label": "Exchange Hot Wallet v2",
  "favorite": true,
  "tags": ["exchange", "hot-wallet", "verified"]
}
```

**Response `200 OK`:** Returns the full updated label object.

---

#### `DELETE /v1/labels/{id}`

**Scope:** Authenticated

Delete a label.

**Response `204 No Content`.**

---

#### `POST /v1/labels/import`

**Scope:** Authenticated (professional tier)

Bulk import labels from a JSON array. Existing labels with matching addresses are overwritten; new addresses are created.

**Request body:**

```json
{
  "labels": [
    {"address": "GCV...ABCD", "label": "Exchange Hot Wallet", "category": "exchange", "network": "mainnet"},
    {"address": "GD5...WXYZ", "label": "Personal Vault", "category": "personal", "network": "mainnet"}
  ],
  "on_conflict": "overwrite"
}
```

**Response `200 OK`:**

```json
{
  "imported": 15,
  "updated": 3,
  "errors": []
}
```

---

#### `GET /v1/labels/export`

**Scope:** Authenticated (professional tier)

Export all labels as a JSON array for backup or transfer.

**Response `200 OK`:** Array of label objects (same schema as `GET /v1/labels`).

---

### 7.6 Entity Clusters

Groups of addresses that form a connected component in the transaction graph.

#### `GET /v1/{network}/clusters`

**Cache TTL:** 600 s  
**Scope:** Authenticated (enterprise tier)

List all detected clusters for the network.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `min_size` | integer | `2` | Minimum members in a cluster |
| `limit` | integer | `50` | Max clusters to return |

**Response `200 OK`:**

```json
{
  "network": "mainnet",
  "total_clusters": 1240,
  "count": 50,
  "has_more": true,
  "clusters": [
    {
      "id": "clust_001",
      "size": 15,
      "edge_count": 42,
      "total_volume_xlm": 120000000,
      "top_addresses": [
        {"address": "GA7Q...", "label": "Central Exchange", "tx_count": 51200},
        {"address": "GCV...", "label": "Market Maker A", "tx_count": 28900}
      ]
    }
  ]
}
```

---

## 8. Schemas

### 8.1 AccountEnrichment

| Field | Type | Description |
|---|---|---|
| `address` | string | Stellar G... address |
| `network` | enum | `mainnet`, `testnet`, `futurenet` |
| `enriched_at` | ISO 8601 | Timestamp of computation |
| `horizon` | object | Live Horizon data (balance, subentries, etc.) |
| `analytics` | object | Derived metrics (tx count, first seen, patterns) |
| `counterparties` | object | Top counterparties by volume |
| `labels` | object | User-managed labels (if any) |

### 8.2 Relationship

| Field | Type | Description |
|---|---|---|
| `counterparty` | string | Stellar G... address |
| `label` | string | Resolved label or truncated address |
| `score` | float | Composite relationship score (0–1) |
| `metrics` | object | tx_count, volume_xlm, first_seen, last_seen, is_bidirectional, operation_types |
| `breakdown` | object | Individual score components |

### 8.3 GraphData

| Field | Type | Description |
|---|---|---|
| `address` | string | Central node address |
| `network` | string | Network scope |
| `generated_at` | ISO 8601 | Computation timestamp |
| `nodes` | array | Graph nodes with id, label, tx_count, is_central, importance |
| `edges` | array | Graph edges with source, target, tx_count, score, types |
| `clusters` | array | Connected component clusters |

### 8.4 Label

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | — | Auto-generated label ID (prefix `lbl_`) |
| `address` | string | yes | Stellar G... address |
| `label` | string | yes | Display name (1–64 chars) |
| `tags` | string[] | no | Arbitrary tags |
| `category` | enum | no | `personal`, `exchange`, `defi`, `nft`, `custodial`, `contract`, `other` |
| `color` | string | no | Hex color (e.g. `#f59e0b`) |
| `favorite` | boolean | no | Starred for quick access |
| `notes` | string | no | Free-text notes (max 500 chars) |
| `network` | string | no | Network scope (`mainnet`, `testnet`, `futurenet`, `all`) |
| `created_at` | ISO 8601 | — | Auto-generated |
| `updated_at` | ISO 8601 | — | Auto-updated |

### 8.5 Cluster

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique cluster identifier |
| `size` | integer | Number of member addresses |
| `edge_count` | integer | Internal transaction edges |
| `total_volume_xlm` | float | Cumulative XLM volume within cluster |
| `top_addresses` | array | Up to 5 most active members |

### 8.6 TimeBucket

| Field | Type | Description |
|---|---|---|
| `timestamp` | ISO 8601 | Bucket start time |
| `operations` | integer | Operation count |
| `transactions` | integer | Transaction count |
| `volume_xlm` | float | XLM volume |
| `by_type` | object | Per-operation-type breakdown |

---

## 9. Error Handling

All errors return a consistent JSON body:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "You have exceeded your rate limit. See Retry-After header.",
    "request_id": "req_abc123def456",
    "docs_url": "https://docs.stellar-dashboard.io/errors#rate_limit_exceeded"
  }
}
```

### Standard error codes

| HTTP Status | Code | Description |
|---|---|---|
| 400 | `bad_request` | Malformed request, missing required field, or invalid type |
| 401 | `unauthorized` | Missing or invalid `Authorization` header |
| 403 | `forbidden` | Key does not have access to the requested network or resource |
| 404 | `not_found` | Address, label, or cluster not found |
| 409 | `conflict` | Label already exists for this address (use `on_conflict: overwrite`) |
| 422 | `unprocessable` | Request body failed schema validation |
| 429 | `rate_limit_exceeded` | Rate limit or burst exceeded — check `Retry-After` header |
| 500 | `internal_error` | Unexpected server error — include `request_id` when contacting support |
| 502 | `bad_upstream` | Horizon or Soroban RPC returned an error |
| 503 | `service_unavailable` | API is in maintenance mode |

### Field-level validation errors

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request body failed validation",
    "details": [
      {"field": "address", "code": "required", "message": "address is required"},
      {"field": "label", "code": "max_length", "message": "label must be 64 characters or fewer"}
    ]
  }
}
```

---

## 10. Pagination

List endpoints use **cursor-based pagination**.

### Request

| Parameter | Type | Description |
|---|---|---|
| `limit` | integer | Max items per page (default: 25, max: 100) |
| `cursor` | string | Opaque cursor from previous response's `next_cursor` |

### Response

| Field | Description |
|---|---|
| `count` | Number of items in this page |
| `has_more` | Boolean indicating more pages exist |
| `next_cursor` | Opaque cursor to pass as `cursor` parameter for the next page |

The `Link` header (RFC 5988) provides the full URL for the next page:

```
Link: <https://api.stellar-dashboard.io/v1/mainnet/accounts/GA7Q.../relationships?limit=25&cursor=eyJsYXN0X3Njb3JlIjogMC41Mn0=>; rel="next"
```

### Initial request (no cursor):

```
GET /v1/mainnet/accounts/GA7Q.../relationships?limit=25
```

### Subsequent request:

```
GET /v1/mainnet/accounts/GA7Q.../relationships?limit=25&cursor=eyJsYXN0X3Njb3JlIjogMC41Mn0=
```

---

## 11. Examples

### 11.1 Fetch enriched account data

```bash
curl -s https://api.stellar-dashboard.io/v1/mainnet/accounts/GA7QVNHE3H4H4Q3H4H4Q3H4H4Q3H4H4Q3H4H4Q3H4H4 \
  -H "Authorization: Bearer sd_abc123def456ghi789jkl" \
  -H "Accept: application/json" | jq .
```

### 11.2 Get relationship graph with depth 2

```bash
curl -s "https://api.stellar-dashboard.io/v1/mainnet/accounts/GA7Q.../graph?depth=2&min_tx=5&limit=100" \
  -H "Authorization: Bearer sd_abc123def456ghi789jkl" \
  -H "Accept: application/json" | jq '.nodes | length'
```

### 11.3 Cross-network address resolution

```bash
curl -s -X POST https://api.stellar-dashboard.io/v1/accounts/resolve \
  -H "Authorization: Bearer sd_abc123def456ghi789jkl" \
  -H "Content-Type: application/json" \
  -d '{"address": "GA7Q...", "networks": ["mainnet", "testnet", "futurenet"]}' | jq .
```

### 11.4 Time-series analytics with type filter

```bash
curl -s "https://api.stellar-dashboard.io/v1/mainnet/analytics/activity?granularity=hour&from=2026-06-23T00:00:00Z&to=2026-06-24T00:00:00Z&type=payment" \
  -H "Authorization: Bearer sd_abc123def456ghi789jkl" \
  -H "Accept: application/json" | jq '.buckets | length'
```

### 11.5 Bulk import labels

```bash
curl -s -X POST https://api.stellar-dashboard.io/v1/labels/import \
  -H "Authorization: Bearer sd_abc123def456ghi789jkl" \
  -H "Content-Type: application/json" \
  -d '{
    "labels": [
      {"address": "GCV...ABCD", "label": "Exchange Hot Wallet", "category": "exchange", "network": "mainnet"},
      {"address": "GD5...WXYZ", "label": "Personal Vault", "category": "personal", "network": "mainnet"}
    ],
    "on_conflict": "overwrite"
  }' | jq .
```

### 11.6 Paginated relationship list with cache validation

```bash
# First request
curl -s -D - "https://api.stellar-dashboard.io/v1/mainnet/accounts/GA7Q.../relationships?limit=10" \
  -H "Authorization: Bearer sd_abc123def456ghi789jkl" \
  -H "Accept: application/json" -o /tmp/rel1.json | head -20

# Extract ETag and next_cursor, then validate cache
ETAG=$(grep -i etag /tmp/headers | awk '{print $2}')
CURSOR=$(jq -r '.next_cursor' /tmp/rel1.json)

curl -s "https://api.stellar-dashboard.io/v1/mainnet/accounts/GA7Q.../relationships?limit=10&cursor=$CURSOR" \
  -H "Authorization: Bearer sd_abc123def456ghi789jkl" \
  -H "Accept: application/json" \
  -H "If-None-Match: $ETAG"
```

### 11.7 Public network status

```bash
curl -s https://api.stellar-dashboard.io/v1/networks/status \
  -H "Accept: application/json" | jq '.networks[] | {network: .network, status: .horizon_status}'
```

---

## 12. Rate Limit Headers

Every authenticated response includes:

| Header | Description | Example |
|---|---|---|
| `X-RateLimit-Limit` | Requests allowed per second | `50` |
| `X-RateLimit-Remaining` | Requests remaining in current window | `42` |
| `X-RateLimit-Reset` | Unix timestamp when the window resets | `1719230400` |
| `X-RateLimit-Burst` | Max burst size | `100` |
| `X-RateLimit-Burst-Remaining` | Burst capacity remaining | `80` |
| `Retry-After` | Seconds to wait before retrying (only on 429) | `30` |

On `429 Too Many Requests`:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Retry after 30 seconds.",
    "retry_after_seconds": 30
  }
}
```

---

## 13. Glossary

| Term | Definition |
|---|---|
| **Stellar network** | An independent instance of the Stellar blockchain (`mainnet`, `testnet`, `futurenet`, `local`, `custom`). Each has its own ledger, accounts, and state. |
| **Horizon** | Stellar's REST API server for reading ledger data and submitting transactions. |
| **Soroban RPC** | Remote Procedure Call endpoint for interacting with Soroban smart contracts. |
| **Relationship score** | Composite metric (0–1) combining transaction frequency, volume, recency, directionality, and operation-type diversity between two addresses. |
| **Entity cluster** | A connected component in the transaction graph — a group of addresses that have transacted with each other (directly or indirectly). |
| **Enrichment** | The process of combining raw Horizon data with derived analytics (patterns, relationships, labels) to produce an enhanced account view. |
| **Cursor pagination** | Pagination method using an opaque cursor token rather than page numbers, ensuring stable results when data is appended. |
| **Stale-while-revalidate** | A cache strategy where stale data is served while the server recomputes fresh data in the background. |
| **API key** | A bearer token (`sd_...`) used to authenticate API requests, bound to rate limit tiers and network permissions. |

---

*Proposal v0.2 · For discussion. Not yet implemented.*
