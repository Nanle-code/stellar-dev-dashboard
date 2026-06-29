/**
 * Example Usage: API Versioning System
 * 
 * Practical examples for using the versioning system
 */

import {
  VersionManager,
  DeprecationManager,
  CompatibilityManager,
  AnalyticsManager,
  MigrationManager,
  SunsetManager,
  globalVersionManager,
  globalDeprecationManager,
  globalAnalyticsManager,
  globalMigrationManager,
  globalSunsetManager,
} from '../src/lib/apiVersioning'

// ─── Example 1: Basic Versioning Setup ──────────────────────────────────────

export function exampleBasicSetup() {
  console.log('\n📌 Example 1: Basic Versioning Setup\n')

  const versionManager = new VersionManager({
    apiVersion: '1.0.0',
    minSupportedVersion: '1.0.0',
    maxSupportedVersion: '2.0.0',
    strategy: 'header',
    headerName: 'X-API-Version',
  })

  // Register an endpoint
  versionManager.registerEndpoint({
    path: '/accounts/:id',
    method: 'GET',
    versions: ['1.0.0', '1.1.0', '2.0.0'],
    currentVersion: '2.0.0',
  })

  console.log('✅ Version Manager initialized')
  console.log(`   Current API Version: ${versionManager.getConfig().apiVersion}`)
  console.log(`   Versioning Strategy: ${versionManager.getConfig().strategy}`)
}

// ─── Example 2: Deprecation Warnings ────────────────────────────────────────

export function exampleDeprecationWarnings() {
  console.log('\n📌 Example 2: Deprecation Warnings\n')

  const deprecationManager = new DeprecationManager()

  // Register a deprecated feature
  deprecationManager.registerDeprecatedFeature({
    id: 'legacy-auth',
    name: 'Legacy Authentication',
    description: 'Old JWT-based authentication',
    deprecatedIn: '1.2.0',
    sunsetsIn: '2.0.0',
    replacement: 'OAuth 2.0',
    migrationGuide: 'https://docs.stellar.dev/migration/auth',
    severity: 'critical',
    affectedEndpoints: ['/login', '/token'],
    breakingChanges: [
      'Response format changed',
      'Authentication flow changed',
    ],
  })

  // Check if feature is deprecated
  const isDeprecated = deprecationManager.isDeprecated('legacy-auth', '1.2.0')
  console.log(`✅ Feature "legacy-auth" deprecated in v1.2.0: ${isDeprecated}`)

  // Generate warning
  const warning = deprecationManager.generateWarning('legacy-auth', '1.2.0')
  if (warning) {
    console.log(`⚠️  Warning generated:`)
    console.log(`   ${warning.message}`)
    deprecationManager.logWarning(warning)
  }
}

// ─── Example 3: Backward Compatibility ──────────────────────────────────────

export function exampleBackwardCompatibility() {
  console.log('\n📌 Example 3: Backward Compatibility\n')

  const compatibilityManager = new CompatibilityManager()

  // Register compatibility adapter
  compatibilityManager.registerAdapter('1.0.0→1.1.0', {
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    requestTransforms: [],
    responseTransforms: [],
    fieldMappings: {
      'user_address': 'publicKey',
      'account_id': 'accountId',
      'created_at': 'createdAt',
    },
    removedFields: ['deprecated_field'],
    addedFields: {
      'apiVersion': '1.1.0',
      'timestamp': new Date().toISOString(),
    },
  })

  // Transform data
  const oldData = {
    user_address: 'GBUQWP3BOUZX34ULNQG23RQ6F4BFSRJSU6LPORBUO6XL5VH6FSH5SXVQ',
    account_id: '123',
    created_at: '2024-01-01T00:00:00Z',
    deprecated_field: 'will-be-removed',
  }

  console.log('Original (v1.0.0) data:')
  console.log(oldData)

  // Shim to v1.1.0
  const shimmedData = compatibilityManager.createShim(oldData, '1.0.0', '1.1.0')
  console.log('\nShimmed (v1.1.0) data:')
  console.log(shimmedData)
}

// ─── Example 4: Analytics & Tracking ────────────────────────────────────────

export function exampleAnalytics() {
  console.log('\n📌 Example 4: Analytics & Tracking\n')

  const analyticsManager = new AnalyticsManager()

  // Simulate API usage
  analyticsManager.recordRequest('1.0.0', 'user-alice', true, 125)
  analyticsManager.recordRequest('1.0.0', 'user-bob', true, 150)
  analyticsManager.recordRequest('1.0.0', 'user-alice', false, 200)

  analyticsManager.recordRequest('2.0.0', 'user-charlie', true, 100)
  analyticsManager.recordRequest('2.0.0', 'user-charlie', true, 110)

  // Track deprecated feature usage
  analyticsManager.recordDeprecatedFeatureUsage(
    'legacy-auth',
    'Legacy Authentication',
    'user-alice'
  )

  // Get metrics
  const v1Metrics = analyticsManager.getVersionMetrics('1.0.0')
  const v2Metrics = analyticsManager.getVersionMetrics('2.0.0')

  console.log('✅ Version Metrics:')
  console.log('\nv1.0.0:')
  console.log(`  - Total Requests: ${v1Metrics?.requestCount}`)
  console.log(`  - Success Count: ${v1Metrics?.successCount}`)
  console.log(`  - Error Count: ${v1Metrics?.errorCount}`)
  console.log(`  - Avg Response Time: ${v1Metrics?.avgResponseTime.toFixed(2)}ms`)
  console.log(`  - Unique Users: ${v1Metrics?.uniqueUsers}`)
  console.log(`  - Error Rate: ${analyticsManager.getErrorRate('1.0.0').toFixed(2)}%`)

  console.log('\nv2.0.0:')
  console.log(`  - Total Requests: ${v2Metrics?.requestCount}`)
  console.log(`  - Success Count: ${v2Metrics?.successCount}`)
  console.log(`  - Avg Response Time: ${v2Metrics?.avgResponseTime.toFixed(2)}ms`)

  // Adoption rate
  const adoptionRate = analyticsManager.calculateAdoptionRate('2.0.0')
  console.log(`\nv2.0.0 Adoption Rate: ${adoptionRate.toFixed(2)}%`)
}

// ─── Example 5: Migration Automation ────────────────────────────────────────

export async function exampleMigration() {
  console.log('\n📌 Example 5: Migration Automation\n')

  const migrationManager = new MigrationManager()

  // Register migration script
  migrationManager.registerScript({
    id: 'v1-to-v1.1',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    steps: [
      {
        id: 'rename-user-address',
        description: 'Rename user_address to publicKey',
        action: 'rename-field',
        target: 'user_address',
        details: { newName: 'publicKey' },
      },
      {
        id: 'rename-account-id',
        description: 'Rename account_id to accountId',
        action: 'rename-field',
        target: 'account_id',
        details: { newName: 'accountId' },
      },
      {
        id: 'add-version',
        description: 'Add apiVersion field',
        action: 'add-field',
        target: 'apiVersion',
        details: { value: '1.1.0' },
      },
    ],
    estimatedTime: 5000,
    reversible: true,
    automatable: true,
  })

  // Data to migrate
  const data = {
    user_address: 'GBUQWP3BOUZX34ULNQG23RQ6F4BFSRJSU6LPORBUO6XL5VH6FSH5SXVQ',
    account_id: '123',
    balance: '1000.00',
  }

  console.log('Data before migration (v1.0.0):')
  console.log(data)

  // Execute migration
  const result = await migrationManager.executeMigration('v1-to-v1.1', data, (progress) => {
    console.log(`Progress: ${Math.round(progress)}%`)
  })

  console.log('\n✅ Migration complete:')
  console.log(`   Success: ${result.success}`)
  console.log(`   Steps Completed: ${result.report.stepsCompleted}/${result.report.totalSteps}`)

  console.log('\nData after migration (v1.1.0):')
  console.log(result.data)
}

// ─── Example 6: Sunset Management ───────────────────────────────────────────

export function exampleSunsetManagement() {
  console.log('\n📌 Example 6: Sunset Management\n')

  const sunsetManager = new SunsetManager()

  // Define sunset policy
  const today = new Date()
  const deprecationDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days
  const sunsetDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000) // 90 days

  sunsetManager.registerSunsetPolicy({
    version: '1.0.0',
    deprecationDate: deprecationDate.toISOString(),
    sunsetDate: sunsetDate.toISOString(),
    communicationPhases: [
      {
        phase: 1,
        name: 'Initial Notice',
        startDate: today.toISOString(),
        endDate: deprecationDate.toISOString(),
        channels: ['email', 'documentation'],
        message: 'Version 1.0.0 is deprecated. Please upgrade to v2.0.0.',
        frequency: 1,
      },
      {
        phase: 2,
        name: 'Reminder',
        startDate: deprecationDate.toISOString(),
        endDate: sunsetDate.toISOString(),
        channels: ['email', 'banner', 'api'],
        message: 'Version 1.0.0 sunsets on ' + sunsetDate.toDateString(),
        frequency: 2,
      },
    ],
    decommissioningSteps: [
      {
        stepNumber: 1,
        description: 'Mark version as deprecated',
        date: deprecationDate.toISOString(),
        action: 'disable',
      },
      {
        stepNumber: 2,
        description: 'Transition to read-only mode',
        date: new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        action: 'readonly',
      },
      {
        stepNumber: 3,
        description: 'Full removal',
        date: sunsetDate.toISOString(),
        action: 'remove',
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

  // Check sunset status
  const isDeprecated = sunsetManager.isDeprecated('1.0.0')
  const isSunset = sunsetManager.isSunset('1.0.0')
  const daysRemaining = sunsetManager.daysUntilSunset('1.0.0')

  console.log('✅ Sunset Status:')
  console.log(`   Version: 1.0.0`)
  console.log(`   Deprecated: ${isDeprecated}`)
  console.log(`   Sunset: ${isSunset}`)
  console.log(`   Days Until Sunset: ${daysRemaining}`)

  // Generate notices
  const notice = sunsetManager.generateSunsetNotice('1.0.0')
  console.log(`\n${notice}`)

  // Get versions expiring soon
  const expiring = sunsetManager.getExpiringVersions(30)
  console.log(`\nVersions expiring within 30 days: ${expiring.join(', ')}`)
}

// ─── Example 7: Using Global Instances ──────────────────────────────────────

export function exampleGlobalInstances() {
  console.log('\n📌 Example 7: Using Global Instances\n')

  // Configure global version manager
  globalVersionManager.updateConfig({
    apiVersion: '2.0.0',
    minSupportedVersion: '1.0.0',
    maxSupportedVersion: '2.0.0',
    strategy: 'header',
  })

  // Register deprecated feature globally
  globalDeprecationManager.registerDeprecatedFeature({
    id: 'old-payment-api',
    name: 'Old Payment API',
    description: 'Legacy payment endpoint',
    deprecatedIn: '1.5.0',
    sunsetsIn: '2.0.0',
    replacement: 'New Payment API v2',
    severity: 'critical',
    affectedEndpoints: ['/payments'],
  })

  // Record analytics globally
  globalAnalyticsManager.recordRequest('2.0.0', 'user-123', true, 95)

  console.log('✅ Global instances configured:')
  console.log(`   Current API Version: ${globalVersionManager.getConfig().apiVersion}`)
  console.log(`   Deprecated Features Tracked: 1`)
  console.log(`   Analytics Events: 1`)
}

// ─── Run All Examples ────────────────────────────────────────────────────────

export async function runAllExamples() {
  console.log('═'.repeat(70))
  console.log('API Versioning System - Examples')
  console.log('═'.repeat(70))

  exampleBasicSetup()
  exampleDeprecationWarnings()
  exampleBackwardCompatibility()
  exampleAnalytics()
  await exampleMigration()
  exampleSunsetManagement()
  exampleGlobalInstances()

  console.log('\n' + '═'.repeat(70))
  console.log('✅ All examples completed')
  console.log('═'.repeat(70))
}

// Export for use in other files
if (typeof module !== 'undefined' && require.main === module) {
  runAllExamples().catch(console.error)
}
