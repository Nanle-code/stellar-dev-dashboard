# API Version History

This document tracks released API documentation versions and the repo package version.

| Version | Date | Notes |
| --- | --- | --- |
| 1.1.0 | 2026-09-28 | **Issue #449**: Comprehensive API lifecycle management implementation with version analytics, migration tools, and sunset policy enforcement. |
| 1.0.0 | 2026-06-02 | Added explicit `API-Version` / deprecation headers for public dashboard routes. See [API_VERSIONING.md](./API_VERSIONING.md). |
| 0.1.0 | - | Initial API reference generator and runnable example assets. |

## Current Package Version

- `package.json` version: **0.1.0**
- API version: **1.1.0**
- Generated documentation date: 2026-09-28

## Version 1.1.0 Changes (Issue #449)

### New Features

#### 1. Version Analytics
- Real-time version usage tracking
- Endpoint-level metrics per version
- Adoption rate calculation
- Deprecated route usage monitoring
- Admin-only analytics endpoints

#### 2. Migration Tools
- Programmatic migration guides API
- Version compatibility checker
- Breaking changes documentation
- Step-by-step migration instructions
- Code examples for version transitions

#### 3. Enhanced Deprecation
- Automatic sunset date enforcement
- HTTP 410 Gone responses after sunset
- Improved deprecation warning headers
- Successor route recommendations

#### 4. Sunset Policy
- Formalized 6-month deprecation period
- 30-day grace period for critical fixes
- Clear enforcement guidelines
- Automated policy enforcement

#### 5. Documentation
- Comprehensive lifecycle management guide
- Migration workflow examples
- Best practices for API consumers
- Analytics usage documentation

### New Endpoints

- `GET /api/v1/analytics/version-usage` - Version usage metrics (admin)
- `GET /api/v1/analytics/deprecated-routes` - Deprecated route tracking (admin)
- `GET /api/v1/analytics/adoption` - Adoption rate statistics (admin)
- `GET /api/v1/migration/guides` - All migration guides
- `GET /api/v1/migration/guides/:from/:to` - Specific migration guide
- `GET /api/v1/migration/compatibility/:version` - Version compatibility check
- `GET /api/v1/migration/breaking-changes` - Breaking changes list
- `GET /api/v1/migration/version-info` - Current version information
- `GET /api/v1/migration/sunset-policy` - Sunset policy details

### Enhanced Middleware

- Version tracking in `apiVersioningMiddleware`
- Sunset date enforcement (410 responses)
- Per-request metrics collection
- Enhanced deprecation headers

### Files Added

- `api/routes/analytics.ts` - Analytics endpoints
- `api/routes/migration.ts` - Migration tools endpoints
- `api/utils/migrationTools.ts` - Migration utilities
- `docs/api/API_LIFECYCLE_MANAGEMENT.md` - Complete lifecycle guide

### Files Modified

- `api/middleware/apiVersioning.ts` - Added analytics tracking and sunset enforcement
- `api/server.js` - Integrated new routes and updated documentation

## See Also

- [API_LIFECYCLE_MANAGEMENT.md](./API_LIFECYCLE_MANAGEMENT.md) - Complete lifecycle management guide
- [API_VERSIONING.md](./API_VERSIONING.md) - Version header specifications
