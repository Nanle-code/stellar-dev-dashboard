# API Lifecycle Management

Complete guide to API versioning, deprecation, and sunset policies for the Stellar Dev Dashboard.

## Table of Contents

1. [Versioning Strategy](#versioning-strategy)
2. [Backward Compatibility](#backward-compatibility)
3. [Deprecation Process](#deprecation-process)
4. [Migration Tools](#migration-tools)
5. [Analytics & Monitoring](#analytics--monitoring)
6. [Sunset Policy](#sunset-policy)

---

## Versioning Strategy

### Version Scheme

The API uses **semantic versioning** (SemVer) in URL paths and headers:

- **Major version**: Breaking changes (`/api/v1` → `/api/v2`)
- **Minor/Patch**: Backward-compatible changes reflected in header only

### Current Version

- **Path**: `/api/v1`
- **Header**: `API-Version: 1.0.0`

### Version Headers

**Request Headers:**
```http
Accept-Version: v1
```

Supported values:
- `1.0`
- `1.0.0`
- `v1`

**Response Headers:**
```http
API-Version: 1.0.0
X-API-Version: 1.0.0
```

### Version Routing

All API requests include version information:

1. **Path-based** (required): `/api/v1/accounts`
2. **Header-based** (optional): `Accept-Version: v1`

Unsupported versions return `400 Bad Request`:

```json
{
  "error": "Unsupported API version",
  "message": "Accept-Version \"v3\" is not supported.",
  "supportedVersions": ["1.0", "1.0.0", "v1"],
  "currentVersion": "1.0.0"
}
```

---

## Backward Compatibility

### Compatibility Guarantees

Within a major version (e.g., v1.x.x):

✅ **Safe changes** (non-breaking):
- Adding new endpoints
- Adding optional request parameters
- Adding new fields to responses
- Adding new response headers
- Performance improvements

❌ **Breaking changes** (require new major version):
- Removing endpoints
- Removing request parameters
- Removing response fields
- Changing field data types
- Changing authentication mechanisms
- Changing error response formats

### Checking Compatibility

```bash
GET /api/v1/migration/compatibility/v1
```

Response:
```json
{
  "version": "v1",
  "supported": true,
  "deprecated": false,
  "sunsetDate": null,
  "successor": null
}
```

---

## Deprecation Process

### Deprecation Warnings

Deprecated endpoints include headers:

```http
Deprecation: Sat, 01 Jun 2026 00:00:00 GMT
Sunset: Thu, 31 Dec 2026 00:00:00 GMT
Link: </api/v2/behavior>; rel="successor-version"
Warning: 299 - "Behavior endpoints are deprecated; migrate to /api/v2/behavior."
```

### Example: Deprecated Route

```bash
GET /api/v1/behavior/analytics
```

Response includes deprecation headers + normal payload until sunset date.

### Current Deprecations

View all deprecated endpoints:

```bash
GET /api/v1/migration/version-info
```

Response:
```json
{
  "current": "1.0.0",
  "supported": ["1.0", "1.0.0", "v1"],
  "deprecated": ["/api/v1/behavior"],
  "sunset": [],
  "timestamp": "2026-09-28T12:00:00.000Z"
}
```

---

## Migration Tools

### Migration Guides

#### List All Guides

```bash
GET /api/v1/migration/guides
```

Response:
```json
{
  "guides": [
    {
      "from": "v1",
      "to": "v2",
      "breaking_changes": [
        "Behavior endpoints moved from /api/v1/behavior to /api/v2/behavior",
        "Response format includes additional metadata fields"
      ],
      "steps": [
        "Update base URL from /api/v1 to /api/v2",
        "Update Accept-Version header to \"2.0\" or \"v2\"",
        "Review and update response parsing logic",
        "Test integration in staging environment"
      ],
      "examples": {
        "behavior": {
          "before": "GET /api/v1/behavior/analytics",
          "after": "GET /api/v2/behavior/analytics"
        }
      }
    }
  ],
  "policy": {
    "deprecationPeriod": "6 months minimum before sunset date",
    "sunsetWarning": "Deprecation headers sent in all responses",
    "gracePeriod": "30 days after sunset for critical bug fixes only",
    "enforcement": "After sunset, endpoints return HTTP 410 Gone"
  }
}
```

#### Get Specific Guide

```bash
GET /api/v1/migration/guides/v1/v2
```

### Breaking Changes

View breaking changes between versions:

```bash
GET /api/v1/migration/breaking-changes?from=v1
```

Response:
```json
{
  "changes": [
    {
      "version": "v2",
      "date": "2027-01-01",
      "changes": [
        "Behavior endpoints restructured",
        "New authentication mechanism",
        "Response pagination format changed"
      ],
      "impact": "high"
    }
  ],
  "timestamp": "2026-09-28T12:00:00.000Z"
}
```

---

## Analytics & Monitoring

### Version Usage Metrics

Track which API versions are being used:

```bash
GET /api/v1/analytics/version-usage
```

**Authentication**: Admin role required

Response:
```json
{
  "timestamp": "2026-09-28T12:00:00.000Z",
  "metrics": {
    "1.0.0": {
      "count": 15420,
      "lastSeen": "2026-09-28T11:59:58.000Z",
      "endpoints": {
        "/api/v1/accounts/GA...": 8500,
        "/api/v1/transactions": 6920
      }
    },
    "v1": {
      "count": 2340,
      "lastSeen": "2026-09-28T11:58:12.000Z",
      "endpoints": {
        "/api/v1/behavior/analytics": 2340
      }
    }
  }
}
```

### Deprecated Route Usage

Monitor usage of deprecated endpoints:

```bash
GET /api/v1/analytics/deprecated-routes
```

**Authentication**: Admin role required

Response:
```json
{
  "timestamp": "2026-09-28T12:00:00.000Z",
  "metrics": {
    "/api/v1/behavior/analytics": {
      "count": 2340,
      "lastSeen": "2026-09-28T11:58:12.000Z"
    }
  }
}
```

### Adoption Rates

View version adoption percentages:

```bash
GET /api/v1/analytics/adoption
```

**Authentication**: Admin role required

Response:
```json
{
  "timestamp": "2026-09-28T12:00:00.000Z",
  "totalRequests": 17760,
  "adoptionRates": {
    "1.0.0": 86.82,
    "v1": 13.18
  },
  "deprecatedRouteUsage": {
    "/api/v1/behavior/analytics": {
      "count": 2340,
      "lastSeen": "2026-09-28T11:58:12.000Z"
    }
  }
}
```

---

## Sunset Policy

### Timeline

When an endpoint or version is deprecated:

1. **Deprecation announcement** → Headers added to responses
2. **Minimum 6 months** → Deprecation period
3. **Sunset date** → Endpoint returns `410 Gone`
4. **30 days grace** → Critical security fixes only

### Sunset Enforcement

After the sunset date, deprecated endpoints return:

```http
HTTP/1.1 410 Gone
```

```json
{
  "error": "Endpoint removed",
  "message": "Behavior endpoints are deprecated; migrate to /api/v2/behavior.",
  "successor": "/api/v2/behavior",
  "sunsetDate": "Thu, 31 Dec 2026 00:00:00 GMT"
}
```

### Sunset Policy Details

```bash
GET /api/v1/migration/sunset-policy
```

Response:
```json
{
  "policy": {
    "deprecationPeriod": "6 months minimum before sunset date",
    "sunsetWarning": "Deprecation headers sent in all responses",
    "gracePeriod": "30 days after sunset for critical bug fixes only",
    "enforcement": "After sunset, endpoints return HTTP 410 Gone"
  },
  "timestamp": "2026-09-28T12:00:00.000Z"
}
```

---

## Best Practices for API Consumers

### 1. Monitor Response Headers

Always check for deprecation warnings:

```javascript
const response = await fetch('/api/v1/behavior/analytics');
const deprecation = response.headers.get('Deprecation');
const sunset = response.headers.get('Sunset');

if (deprecation) {
  console.warn(`Endpoint deprecated since ${deprecation}`);
  console.warn(`Will be removed on ${sunset}`);
}
```

### 2. Version Your Integrations

Pin to specific API versions:

```javascript
const headers = {
  'Accept-Version': 'v1',
  'Authorization': 'Bearer token'
};
```

### 3. Subscribe to Migration Guides

Check migration guides periodically:

```bash
GET /api/v1/migration/guides
```

### 4. Test Before Sunset

Migrate and test in staging environment well before sunset dates.

### 5. Handle 410 Gone

Always handle sunset responses gracefully:

```javascript
if (response.status === 410) {
  const body = await response.json();
  console.error(`Endpoint removed. Use ${body.successor} instead.`);
}
```

---

## Communication Channels

Stay informed about API changes:

1. **Response headers** → Real-time deprecation warnings
2. **Migration endpoints** → Programmatic access to guides
3. **Analytics dashboard** → Version usage tracking (admin)
4. **Documentation** → Updated migration guides

---

## Examples

### Complete Migration Workflow

```bash
# 1. Check current version info
curl https://api.stellar-dashboard.dev/api/v1/migration/version-info

# 2. Get migration guide
curl https://api.stellar-dashboard.dev/api/v1/migration/guides/v1/v2

# 3. Check breaking changes
curl https://api.stellar-dashboard.dev/api/v1/migration/breaking-changes?from=v1

# 4. Update code and test in staging

# 5. Monitor adoption (if admin)
curl -H "Authorization: Bearer token" \
  https://api.stellar-dashboard.dev/api/v1/analytics/adoption

# 6. Deploy to production before sunset date
```

---

## Related Documentation

- [API_VERSIONING.md](./API_VERSIONING.md) - Version header specifications
- [VERSION_HISTORY.md](./VERSION_HISTORY.md) - Release history
- [RATE_LIMITING.md](./RATE_LIMITING.md) - Rate limiting policies
