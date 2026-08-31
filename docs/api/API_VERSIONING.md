# Public Dashboard API Versioning

The public dashboard API uses explicit path versioning and response headers aligned with the public contract.

## Current version

- Path prefix: `/api/v1`
- Response headers: `API-Version` and `X-API-Version` (currently `1.0.0`)

Every API response includes these headers so clients can detect the active contract version without parsing the body.

## Client negotiation

Clients may send an optional `Accept-Version` header. Supported values:

- `1.0`
- `1.0.0`
- `v1`

Unsupported values receive `400 Bad Request`:

```json
{
  "error": "Unsupported API version",
  "supportedVersions": ["1.0", "1.0.0", "v1"],
  "currentVersion": "1.0.0"
}
```

## Deprecation policy

Deprecated routes include:

| Header | Purpose |
| --- | --- |
| `Deprecation` | HTTP-date when the route was marked deprecated |
| `Sunset` | HTTP-date when the route will be removed |
| `Link` | Successor route (`rel="successor-version"`) |
| `Warning` | Human-readable migration guidance |

Currently deprecated:

- `/api/v1/behavior/*` → successor `/api/v2/behavior`
- Sunset: `Thu, 31 Dec 2026 00:00:00 GMT`

## Migration notes

1. Read `API-Version` on every response and log breaking changes during integration tests.
2. When `Deprecation` is present, schedule migration before the `Sunset` date.
3. Prefer the `Link` successor route for new integrations.
4. Do not rely on undocumented response fields; versioned payloads include `apiVersion` where applicable.

## Security

Version headers are informational only. Authentication, rate limits, and authorization remain enforced by existing middleware.

## Compatibility

- Existing `/api/v1/*` clients continue to work without changes.
- Clients that ignore deprecation headers remain functional until the published sunset date.
