# Idempotency Keys for Mutating API Proxy Calls

The public API server accepts optional **idempotency keys** on mutating proxy endpoints so clients can safely retry `POST`, `PUT`, `PATCH`, and `DELETE` requests without creating duplicate side effects.

Implementation lives in:

- `api/middleware/idempotency.js`
- `api/middleware/idempotencyStore.js`
- wired globally in `api/server.js`

---

## Usage

Send a unique key with every mutating request you may retry:

```http
POST /api/v1/gas/record HTTP/1.1
Content-Type: application/json
Idempotency-Key: gas-record-2026-08-31-001

{"accountId":"GABC...","actualCost":1200}
```

If the network fails after the server processed the first attempt, resend the **exact same request** with the same key. The API returns the original response and sets:

```http
Idempotency-Replayed: true
```

---

## Key format

| Rule | Value |
|------|-------|
| Header name | `Idempotency-Key` |
| Length | 1–128 characters |
| Allowed characters | `A–Z`, `a–z`, `0–9`, `-`, `_` |
| Required? | Optional — omit the header to skip idempotency handling |

---

## Responses

| Status | When |
|--------|------|
| `200` / `201` / … | First successful execution, or a replay of a prior success |
| `409 Conflict` | Same key reused with a different payload, or a duplicate arrived while the first request is still processing (`Retry-After: 1`) |
| `422 Unprocessable Entity` | Malformed key when the header is present |

When the backing store is unavailable the middleware **fails open** and sets `Idempotency-Degraded: true` so traffic is not blocked.

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `IDEMPOTENCY_ENABLED` | `true` | Set to `false` to disable middleware entirely |
| `IDEMPOTENCY_TTL_MS` | `86400000` (24 h) | How long replay records are kept |
| `IDEMPOTENCY_STORE` | `memory` | `memory` for single-instance dev; `redis` for production |
| `REDIS_URL` | — | Required when `IDEMPOTENCY_STORE=redis` |

---

## Security & migration notes

- Keys should be **unique per logical operation** (for example, include your client-generated UUID).
- Do not reuse keys across different endpoints or payloads — the server fingerprints `method + path + JSON body`.
- Replays return the stored response verbatim; rotate keys when intentionally changing request semantics.
- Existing clients that omit the header behave exactly as before — this is a backward-compatible enhancement.

---

## Developer reference

Machine-readable guidance is exposed at `GET /api/docs/idempotency`.

Automated coverage: `tests/api/middleware/idempotency.test.js`.
