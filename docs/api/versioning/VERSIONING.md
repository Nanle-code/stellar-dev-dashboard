# API Versioning Guide

A comprehensive guide to implementing and managing API versions in the Stellar Dev Dashboard.

## Table of Contents

1. [Overview](#overview)
2. [Step 1: Versioning Strategy](#step-1-versioning-strategy)
3. [Step 2: Backward Compatibility](#step-2-backward-compatibility)
4. [Step 3: Documentation](#step-3-documentation)
5. [Step 4: Analytics & Monitoring](#step-4-analytics--monitoring)
6. [Step 5: Sunset Management](#step-5-sunset-management)
7. [Best Practices](#best-practices)

---

## Overview

This versioning system provides:
- **Semantic versioning** (major.minor.patch)
- **Multiple versioning strategies** (header, URL path, query param, hybrid)
- **Backward compatibility** management
- **Deprecation warnings** and migration paths
- **Usage analytics** and adoption tracking
- **Sunset policies** and decommissioning plans

### Core Managers

| Manager | Purpose |
|---------|---------|
| `VersionManager` | Core versioning logic, routing, headers |
| `DeprecationManager` | Deprecation tracking and warnings |
| `CompatibilityManager` | Backward compatibility transformations |
| `AnalyticsManager` | Usage metrics and adoption tracking |
| `MigrationManager` | Automated migration tools |
| `SunsetManager` | Version lifecycle and decommissioning |

---

## Step 1: Versioning Strategy

### 1.1 Setup Version Manager

```typescript
import { VersionManager } from './lib/apiVersioning/versionManager'

const versionManager = new VersionManager({
  apiVersion: '1.0.0',
  minSupportedVersion: '1.0.0',
  maxSupportedVersion: '2.0.0',
  strategy: 'header', // 'header' | 'url-path' | 'query-param' | 'hybrid'
  headerName: 'X-API-Version',
  urlPrefix: '/api/v',
  queryParamName: 'api_version',
})
```

### 1.2 Register Endpoints

```typescript
versionManager.registerEndpoint({
  path: '/accounts/:id',
  method: 'GET',
  versions: ['1.0.0', '1.1.0', '2.0.0'],
  currentVersion: '2.0.0',
  deprecated: false,
})
```

### 1.3 Version Extraction

The system automatically extracts version based on configured strategy:

**Header Strategy:**
```
GET /api/accounts/123
X-API-Version: 1.0.0
```

**URL Path Strategy:**
```
GET /api/v1/accounts/123
```

**Query Param Strategy:**
```
GET /api/accounts/123?api_version=1.0.0
```

**Hybrid Strategy:**
Tries header first, then URL path, then query param.

---

## Step 2: Backward Compatibility

### 2.1 Register Compatibility Adapters

```typescript
import { CompatibilityManager } from './lib/apiVersioning/compatibilityLayer'

const compatibilityManager = new CompatibilityManager()

compatibilityManager.registerAdapter('1.0.0→1.1.0', {
  fromVersion: '1.0.0',
  toVersion: '1.1.0',
  requestTransforms: [
    (data) => {
      // Transform request from v1.0.0 to v1.1.0
      return data
    },
  ],
  responseTransforms: [
    (data) => {
      // Transform response from v1.1.0 to v1.0.0
      return data
    },
  ],
  fieldMappings: {
    'user_id': 'userId',
    'account_id': 'accountId',
  },
  removedFields: ['deprecated_field'],
  addedFields: {
    'apiVersion': '1.1.0',
  },
})
```

### 2.2 Transform Data

```typescript
// Transform request for target version
const transformedRequest = compatibilityManager.transformRequest(
  '/accounts/:id',
  requestData,
  targetVersion
)

// Transform response from source version
const transformedResponse = compatibilityManager.transformResponse(
  '/accounts/:id',
  responseData,
  sourceVersion,
  targetVersion
)
```

### 2.3 Ensure Compatibility

```typescript
const compatible = compatibilityManager.ensureBackwardCompatibility(
  data,
  '1.0.0',
  ['id', 'timestamp', 'version']
)
```

---

## Step 3: Documentation

### 3.1 Deprecation Warnings

```typescript
import { DeprecationManager } from './lib/apiVersioning/deprecationWarnings'

const deprecationManager = new DeprecationManager()

deprecationManager.registerDeprecatedFeature({
  id: 'old-auth-endpoint',
  name: 'Old Authentication Endpoint',
  description: 'Legacy /login endpoint',
  deprecatedIn: '1.2.0',
  sunsetsIn: '2.0.0',
  replacement: 'Use /oauth/token instead',
  migrationGuide: '/docs/migration/auth-v1-to-v2',
  severity: 'critical',
  affectedEndpoints: ['/login'],
  breakingChanges: ['Response format changed', 'Authentication method changed'],
})

// Generate warning
const warning = deprecationManager.generateWarning('old-auth-endpoint', '1.2.0')
deprecationManager.logWarning(warning)
```

### 3.2 Migration Paths

```typescript
deprecationManager.registerMigrationPath({
  from: '1.0.0',
  to: '2.0.0',
  changes: [
    {
      type: 'renamed',
      endpoint: '/accounts/:id',
      oldName: 'address',
      newName: 'publicKey',
      details: 'Field renamed for clarity',
    },
    {
      type: 'removed',
      endpoint: '/transactions/:id',
      details: 'Legacy transaction format removed',
    },
    {
      type: 'added',
      endpoint: '/transactions/:id',
      details: 'New fields: nonce, expiresAt',
    },
  ],
  estimatedEffort: 'moderate',
  automatedTools: ['@stellar-dev-dashboard/migrate-v1-to-v2'],
})

const path = deprecationManager.getMigrationPath('1.0.0', '2.0.0')
```

---

## Step 4: Analytics & Monitoring

### 4.1 Track Version Usage

```typescript
import { AnalyticsManager } from './lib/apiVersioning/analytics'

const analyticsManager = new AnalyticsManager()

// Record API request
analyticsManager.recordRequest(
  '1.0.0',      // version
  'user-123',   // userId
  true,         // success
  125           // responseTimeMs
)

// Record deprecated feature usage
analyticsManager.recordDeprecatedFeatureUsage(
  'old-auth-endpoint',
  'Old Authentication Endpoint',
  'user-123'
)

// Record migration event
analyticsManager.recordMigrationEvent(
  'user-123',
  '1.0.0',
  '1.1.0',
  true // success
)
```

### 4.2 Get Metrics

```typescript
// Get version metrics
const v1Metrics = analyticsManager.getVersionMetrics('1.0.0')
console.log(v1Metrics)
// {
//   version: '1.0.0',
//   timestamp: '2024-01-01T00:00:00Z',
//   requestCount: 1000,
//   successCount: 980,
//   errorCount: 20,
//   avgResponseTime: 125.5,
//   uniqueUsers: 150,
// }

// Get deprecation metrics
const deprecationMetrics = analyticsManager.getDeprecationMetrics('old-auth-endpoint')

// Get adoption rate
const adoptionRate = analyticsManager.calculateAdoptionRate('2.0.0')
console.log(`${adoptionRate}% of users have adopted v2.0.0`)

// Export metrics
const allMetrics = analyticsManager.exportMetrics()
const csv = analyticsManager.exportMetricsAsCSV()
```

---

## Step 5: Sunset Management

### 5.1 Define Sunset Policy

```typescript
import { SunsetManager } from './lib/apiVersioning/sunsetManager'

const sunsetManager = new SunsetManager()

sunsetManager.registerSunsetPolicy({
  version: '1.0.0',
  deprecationDate: '2024-06-01',
  sunsetDate: '2024-12-31',
  communicationPhases: [
    {
      phase: 1,
      name: 'Initial Notice',
      startDate: '2024-06-01',
      endDate: '2024-08-01',
      channels: ['email', 'documentation'],
      message: 'Version 1.0.0 is deprecated. Please upgrade to v1.1.0 or v2.0.0.',
      frequency: 1, // once
    },
    {
      phase: 2,
      name: 'Reminder',
      startDate: '2024-08-02',
      endDate: '2024-10-01',
      channels: ['email', 'banner', 'api'],
      message: 'Version 1.0.0 sunsets on 2024-12-31. Upgrade now.',
      frequency: 4, // monthly
    },
    {
      phase: 3,
      name: 'Final Notice',
      startDate: '2024-10-02',
      endDate: '2024-12-31',
      channels: ['email', 'banner', 'notification', 'api'],
      message: 'Version 1.0.0 stops working at 2024-12-31. Upgrade immediately.',
      frequency: 2, // bi-weekly
    },
  ],
  decommissioningSteps: [
    {
      stepNumber: 1,
      description: 'Mark version as deprecated',
      date: '2024-06-01',
      action: 'disable',
    },
    {
      stepNumber: 2,
      description: 'Transition to read-only mode',
      date: '2024-10-01',
      action: 'readonly',
    },
    {
      stepNumber: 3,
      description: 'Redirect to v2.0.0',
      date: '2024-12-01',
      action: 'redirect',
      targetVersion: '2.0.0',
    },
    {
      stepNumber: 4,
      description: 'Full removal',
      date: '2024-12-31',
      action: 'remove',
      backupLocation: 's3://backups/api-v1.0.0/',
    },
  ],
  alternatives: [
    {
      version: '1.1.0',
      reason: 'Recommended for current v1.x users',
    },
    {
      version: '2.0.0',
      reason: 'Latest version with new features',
    },
  ],
})
```

### 5.2 Manage Sunset

```typescript
// Check status
const isSunset = sunsetManager.isSunset('1.0.0')
const isDeprecated = sunsetManager.isDeprecated('1.0.0')
const daysRemaining = sunsetManager.daysUntilSunset('1.0.0')

// Get current communication phase
const currentPhase = sunsetManager.getCurrentCommunicationPhase('1.0.0')

// Get next decommissioning step
const nextStep = sunsetManager.getNextDecommissioningStep('1.0.0')

// Execute step
sunsetManager.executeDecommissioningStep('1.0.0', nextStep)

// Generate notices
const notice = sunsetManager.generateSunsetNotice('1.0.0')
const plan = sunsetManager.generateDecommissioningPlan('1.0.0')

// Log communication
sunsetManager.logCommunicationSent('1.0.0', 1, ['user@example.com'])

// Get versions expiring soon
const expiringVersions = sunsetManager.getExpiringVersions(30) // within 30 days
```

---

## Best Practices

### 1. Version Planning

- ✅ Plan versions ahead with clear roadmaps
- ✅ Use semantic versioning (major.minor.patch)
- ✅ Document breaking changes before release
- ❌ Avoid surprise breaking changes

### 2. Backward Compatibility

- ✅ Support at least 2 major versions
- ✅ Provide compatibility adapters
- ✅ Maintain transformation rules
- ❌ Break compatibility without warning

### 3. Communication

- ✅ Announce deprecations 6+ months ahead
- ✅ Provide clear migration guides
- ✅ Use multiple communication channels
- ✅ Share adoption metrics with users
- ❌ Force immediate upgrades

### 4. Testing

- ✅ Test all version combinations
- ✅ Test migration scripts
- ✅ Monitor error rates by version
- ✅ Load test version transitions
- ❌ Deploy untested versions

### 5. Monitoring

- ✅ Track version usage patterns
- ✅ Monitor deprecated feature usage
- ✅ Measure adoption rates
- ✅ Alert on unusual patterns
- ❌ Ignore adoption metrics

### 6. Documentation

- ✅ Maintain version-specific docs
- ✅ Keep changelog updated
- ✅ Provide migration guides
- ✅ Document all breaking changes
- ❌ Assume users will figure it out

---

## Quick Reference

### Create Version Manager
```typescript
import { globalVersionManager } from './lib/apiVersioning'
globalVersionManager.updateConfig({
  apiVersion: '1.0.0',
})
```

### Track Deprecation
```typescript
import { globalDeprecationManager } from './lib/apiVersioning'
const warning = globalDeprecationManager.generateWarning('feature-id', '1.0.0')
```

### Record Analytics
```typescript
import { globalAnalyticsManager } from './lib/apiVersioning'
globalAnalyticsManager.recordRequest('1.0.0', 'user-id', true, 100)
```

### Execute Migration
```typescript
import { globalMigrationManager } from './lib/apiVersioning'
const result = await globalMigrationManager.executeMigration('script-id', data)
```

### Manage Sunset
```typescript
import { globalSunsetManager } from './lib/apiVersioning'
const daysRemaining = globalSunsetManager.daysUntilSunset('1.0.0')
```

---

## Related Documentation

- [CHANGELOG.md](./CHANGELOG.md) - Version history and changes
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Step-by-step migration instructions
- [API_ENDPOINTS.md](./API_ENDPOINTS.md) - Endpoint versioning details
