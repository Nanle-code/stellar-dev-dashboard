/**
 * API Versioning Test Suite
 * 
 * Comprehensive tests for all versioning components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  VersionManager,
} from '../../../src/lib/apiVersioning/versionManager'
import {
  DeprecationManager,
} from '../../../src/lib/apiVersioning/deprecationWarnings'
import {
  CompatibilityManager,
} from '../../../src/lib/apiVersioning/compatibilityLayer'
import {
  AnalyticsManager,
} from '../../../src/lib/apiVersioning/analytics'
import {
  MigrationManager,
} from '../../../src/lib/apiVersioning/migrations'
import {
  SunsetManager,
} from '../../../src/lib/apiVersioning/sunsetManager'

describe('API Versioning System', () => {
  // ─── Version Manager Tests ───────────────────────────────────────────────

  describe('VersionManager', () => {
    let versionManager: VersionManager

    beforeEach(() => {
      versionManager = new VersionManager({
        apiVersion: '1.0.0',
        minSupportedVersion: '1.0.0',
        maxSupportedVersion: '2.0.0',
        strategy: 'header',
      })
    })

    it('should initialize with default config', () => {
      const config = versionManager.getConfig()
      expect(config.apiVersion).toBe('1.0.0')
      expect(config.strategy).toBe('header')
    })

    it('should register endpoints', () => {
      versionManager.registerEndpoint({
        path: '/accounts/:id',
        method: 'GET',
        versions: ['1.0.0', '2.0.0'],
        currentVersion: '2.0.0',
      })

      const endpoint = versionManager.getEndpoint('/accounts/:id', 'GET')
      expect(endpoint).toBeDefined()
      expect(endpoint?.currentVersion).toBe('2.0.0')
    })

    it('should validate semantic versions', () => {
      expect(versionManager.isValidVersion('1.0.0')).toBe(true)
      expect(versionManager.isValidVersion('2.1.5')).toBe(true)
      expect(versionManager.isValidVersion('1.0')).toBe(false)
      expect(versionManager.isValidVersion('invalid')).toBe(false)
    })

    it('should check version support', () => {
      expect(versionManager.isSupportedVersion('1.0.0')).toBe(true)
      expect(versionManager.isSupportedVersion('1.5.0')).toBe(true)
      expect(versionManager.isSupportedVersion('2.0.0')).toBe(true)
      expect(versionManager.isSupportedVersion('3.0.0')).toBe(false)
    })

    it('should compare versions correctly', () => {
      expect(versionManager.compareVersions('1.0.0', '1.0.0')).toBe(0)
      expect(versionManager.compareVersions('1.1.0', '1.0.0')).toBe(1)
      expect(versionManager.compareVersions('1.0.0', '1.1.0')).toBe(-1)
      expect(versionManager.compareVersions('2.0.0', '1.9.9')).toBe(1)
    })

    it('should generate next version', () => {
      expect(versionManager.getNextVersion('1.0.0', 'major')).toBe('2.0.0')
      expect(versionManager.getNextVersion('1.0.0', 'minor')).toBe('1.1.0')
      expect(versionManager.getNextVersion('1.0.0', 'patch')).toBe('1.0.1')
    })

    it('should extract version from header', () => {
      const version = versionManager.extractVersion({
        headers: {
          'X-API-Version': '1.5.0',
        },
      })
      expect(version).toBe('1.5.0')
    })

    it('should format URL with version', () => {
      const versionManagerUrl = new VersionManager({
        strategy: 'url-path',
        urlPrefix: '/api/v',
      })
      const url = versionManagerUrl.formatUrl('/accounts/:id', '1.0.0')
      expect(url).toBe('/api/v1/accounts/:id')
    })

    it('should create versioned response', () => {
      const response = versionManager.createVersionedResponse(
        { id: 123 },
        '1.0.0',
        true,
        'This version is deprecated'
      )
      expect(response.data).toEqual({ id: 123 })
      expect(response.version).toBe('1.0.0')
      expect(response.deprecated).toBe(true)
    })

    it('should get version headers', () => {
      const headers = versionManager.getVersionHeaders('1.0.0')
      expect(headers['X-API-Version']).toBe('1.0.0')
    })
  })

  // ─── Deprecation Manager Tests ───────────────────────────────────────────

  describe('DeprecationManager', () => {
    let deprecationManager: DeprecationManager

    beforeEach(() => {
      deprecationManager = new DeprecationManager()
      deprecationManager.reset()
    })

    it('should register deprecated features', () => {
      deprecationManager.registerDeprecatedFeature({
        id: 'old-endpoint',
        name: 'Old Endpoint',
        description: 'Legacy endpoint',
        deprecatedIn: '1.0.0',
        sunsetsIn: '2.0.0',
        replacement: 'new-endpoint',
        severity: 'warning',
        affectedEndpoints: ['/legacy'],
      })

      const feature = deprecationManager.getDeprecatedFeature('old-endpoint')
      expect(feature).toBeDefined()
      expect(feature?.sunsetsIn).toBe('2.0.0')
    })

    it('should check if feature is deprecated', () => {
      deprecationManager.registerDeprecatedFeature({
        id: 'test-feature',
        name: 'Test Feature',
        description: 'Test',
        deprecatedIn: '1.0.0',
        sunsetsIn: '2.0.0',
        severity: 'warning',
        affectedEndpoints: [],
      })

      expect(deprecationManager.isDeprecated('test-feature', '1.0.0')).toBe(true)
      expect(deprecationManager.isDeprecated('test-feature', '1.5.0')).toBe(true)
    })

    it('should generate deprecation warnings', () => {
      deprecationManager.registerDeprecatedFeature({
        id: 'test-feature',
        name: 'Test Feature',
        description: 'A test feature',
        deprecatedIn: '1.0.0',
        sunsetsIn: '2.0.0',
        replacement: 'new-feature',
        severity: 'warning',
        affectedEndpoints: [],
      })

      const warning = deprecationManager.generateWarning('test-feature', '1.0.0')
      expect(warning).toBeDefined()
      expect(warning?.feature).toBe('Test Feature')
      expect(warning?.severity).toBe('warning')
    })

    it('should suppress warnings', () => {
      deprecationManager.suppressWarning('test-feature')
      expect(deprecationManager.isWarningSuppressed('test-feature')).toBe(true)

      deprecationManager.resumeWarning('test-feature')
      expect(deprecationManager.isWarningSuppressed('test-feature')).toBe(false)
    })

    it('should get sunset date', () => {
      deprecationManager.registerDeprecatedFeature({
        id: 'test-feature',
        name: 'Test',
        description: 'Test',
        deprecatedIn: '1.0.0',
        sunsetsIn: '2.5.0',
        severity: 'warning',
        affectedEndpoints: [],
      })

      const sunsetDate = deprecationManager.getSunsetDate('test-feature')
      expect(sunsetDate).toBe('2.5.0')
    })
  })

  // ─── Compatibility Manager Tests ───────────────────────────────────────

  describe('CompatibilityManager', () => {
    let compatibilityManager: CompatibilityManager

    beforeEach(() => {
      compatibilityManager = new CompatibilityManager()
    })

    it('should register compatibility adapters', () => {
      compatibilityManager.registerAdapter('1.0.0→1.1.0', {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        requestTransforms: [],
        responseTransforms: [],
        fieldMappings: {
          'user_id': 'userId',
        },
      })

      const adapter = compatibilityManager.getAdapter('1.0.0', '1.1.0')
      expect(adapter).toBeDefined()
    })

    it('should apply field mappings', () => {
      const data = {
        user_id: 123,
        account_id: 456,
      }

      compatibilityManager.registerFieldMappings('1.1.0', {
        'user_id': 'userId',
        'account_id': 'accountId',
      })

      const transformed = compatibilityManager.transformRequest('/accounts', data, '1.1.0')
      expect(transformed).toHaveProperty('userId', 123)
    })

    it('should ensure backward compatibility', () => {
      const data = { id: 123 }
      const compatible = compatibilityManager.ensureBackwardCompatibility(
        data,
        '1.0.0',
        ['id', 'timestamp', 'version']
      )

      expect(compatible).toHaveProperty('id', 123)
      expect(compatible).toHaveProperty('timestamp')
      expect(compatible).toHaveProperty('version', '1.0.0')
    })

    it('should create compatibility shim', () => {
      compatibilityManager.registerAdapter('1.0.0→1.1.0', {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        requestTransforms: [],
        responseTransforms: [],
        fieldMappings: { 'old_field': 'newField' },
        removedFields: ['deprecated'],
        addedFields: { 'newRequired': 'default' },
      })

      const data = {
        old_field: 'value',
        deprecated: 'remove-me',
      }

      const shimmed = compatibilityManager.createShim(data, '1.0.0', '1.1.0')
      expect(shimmed).toHaveProperty('newField', 'value')
      expect(shimmed).not.toHaveProperty('deprecated')
      expect(shimmed).toHaveProperty('newRequired', 'default')
    })
  })

  // ─── Analytics Manager Tests ───────────────────────────────────────────

  describe('AnalyticsManager', () => {
    let analyticsManager: AnalyticsManager

    beforeEach(() => {
      analyticsManager = new AnalyticsManager()
      analyticsManager.clearMetrics()
    })

    it('should record API requests', () => {
      analyticsManager.recordRequest('1.0.0', 'user-1', true, 100)
      analyticsManager.recordRequest('1.0.0', 'user-1', true, 120)
      analyticsManager.recordRequest('1.0.0', 'user-2', false, 150)

      const metrics = analyticsManager.getVersionMetrics('1.0.0')
      expect(metrics?.requestCount).toBe(3)
      expect(metrics?.successCount).toBe(2)
      expect(metrics?.errorCount).toBe(1)
      expect(metrics?.uniqueUsers).toBe(2)
    })

    it('should calculate average response time', () => {
      analyticsManager.recordRequest('1.0.0', 'user-1', true, 100)
      analyticsManager.recordRequest('1.0.0', 'user-1', true, 200)

      const metrics = analyticsManager.getVersionMetrics('1.0.0')
      expect(metrics?.avgResponseTime).toBe(150)
    })

    it('should record deprecated feature usage', () => {
      analyticsManager.recordDeprecatedFeatureUsage('old-feature', 'Old Feature', 'user-1')
      analyticsManager.recordDeprecatedFeatureUsage('old-feature', 'Old Feature', 'user-2')

      const metrics = analyticsManager.getDeprecationMetrics('old-feature')
      expect(metrics?.usageCount).toBe(2)
      expect(metrics?.affectedUsers.size).toBe(2)
    })

    it('should record migration events', () => {
      analyticsManager.recordMigrationEvent('user-1', '1.0.0', '1.1.0', true)
      analyticsManager.recordMigrationEvent('user-2', '1.0.0', '1.1.0', true)
      analyticsManager.recordMigrationEvent('user-3', '1.0.0', '1.1.0', false)

      const rate = analyticsManager.getMigrationSuccessRate()
      expect(rate).toBeCloseTo(66.67, 1)
    })

    it('should get error rate', () => {
      analyticsManager.recordRequest('1.0.0', 'user-1', true, 100)
      analyticsManager.recordRequest('1.0.0', 'user-1', true, 100)
      analyticsManager.recordRequest('1.0.0', 'user-1', false, 100)
      analyticsManager.recordRequest('1.0.0', 'user-1', false, 100)

      const errorRate = analyticsManager.getErrorRate('1.0.0')
      expect(errorRate).toBeCloseTo(50, 1)
    })

    it('should export metrics as JSON', () => {
      analyticsManager.recordRequest('1.0.0', 'user-1', true, 100)
      const exported = analyticsManager.exportMetrics()

      expect(exported).toHaveProperty('versions')
      expect(exported).toHaveProperty('deprecations')
      expect(exported).toHaveProperty('migrations')
      expect(Array.isArray(exported.versions)).toBe(true)
    })

    it('should export metrics as CSV', () => {
      analyticsManager.recordRequest('1.0.0', 'user-1', true, 100)
      const csv = analyticsManager.exportMetricsAsCSV()

      expect(csv).toContain('Version')
      expect(csv).toContain('1.0.0')
      expect(csv).toContain('Requests')
    })
  })

  // ─── Migration Manager Tests ───────────────────────────────────────────

  describe('MigrationManager', () => {
    let migrationManager: MigrationManager

    beforeEach(() => {
      migrationManager = new MigrationManager()
      migrationManager.clearHistory()
    })

    it('should register migration scripts', () => {
      migrationManager.registerScript({
        id: 'v1-to-v1.1',
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        steps: [],
        estimatedTime: 5000,
        reversible: true,
        automatable: true,
      })

      const script = migrationManager.getScript('v1-to-v1.1')
      expect(script).toBeDefined()
    })

    it('should find migration script between versions', () => {
      migrationManager.registerScript({
        id: 'v1-to-v1.1',
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        steps: [],
        estimatedTime: 5000,
        reversible: true,
        automatable: true,
      })

      const script = migrationManager.findMigrationScript('1.0.0', '1.1.0')
      expect(script?.id).toBe('v1-to-v1.1')
    })

    it('should validate migration scripts', () => {
      const validScript = {
        id: 'test',
        fromVersion: '1.0.0' as const,
        toVersion: '1.1.0' as const,
        steps: [{ id: 'step1', description: 'Step 1', action: 'rename-field' as const, target: 'field' }],
        estimatedTime: 1000,
        reversible: true,
        automatable: true,
      }

      const validation = migrationManager.validateScript(validScript)
      expect(validation.valid).toBe(true)
    })

    it('should check if migration is available', () => {
      migrationManager.registerScript({
        id: 'v1-to-v1.1',
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        steps: [],
        estimatedTime: 5000,
        reversible: true,
        automatable: true,
      })

      expect(migrationManager.isMigrationAvailable('1.0.0', '1.1.0')).toBe(true)
      expect(migrationManager.isMigrationAvailable('1.0.0', '2.0.0')).toBe(false)
    })

    it('should execute migration scripts', async () => {
      migrationManager.registerScript({
        id: 'v1-to-v1.1',
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        steps: [
          {
            id: 'rename-field',
            description: 'Rename user_id to userId',
            action: 'rename-field',
            target: 'user_id',
            details: { newName: 'userId' },
          },
        ],
        estimatedTime: 5000,
        reversible: true,
        automatable: true,
      })

      const data = { user_id: 123 }
      const result = await migrationManager.executeMigration('v1-to-v1.1', data)

      expect(result.success).toBe(true)
      expect(result.report.stepsCompleted).toBe(1)
    })
  })

  // ─── Sunset Manager Tests ──────────────────────────────────────────────

  describe('SunsetManager', () => {
    let sunsetManager: SunsetManager

    beforeEach(() => {
      sunsetManager = new SunsetManager()
    })

    it('should register sunset policies', () => {
      const today = new Date()
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

      sunsetManager.registerSunsetPolicy({
        version: '1.0.0',
        deprecationDate: today.toISOString(),
        sunsetDate: tomorrow.toISOString(),
        communicationPhases: [],
        decommissioningSteps: [],
        alternatives: [],
      })

      const policy = sunsetManager.getSunsetPolicy('1.0.0')
      expect(policy).toBeDefined()
    })

    it('should check if version is deprecated', () => {
      const today = new Date()
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

      sunsetManager.registerSunsetPolicy({
        version: '1.0.0',
        deprecationDate: yesterday.toISOString(),
        sunsetDate: today.toISOString(),
        communicationPhases: [],
        decommissioningSteps: [],
        alternatives: [],
      })

      expect(sunsetManager.isDeprecated('1.0.0')).toBe(true)
    })

    it('should calculate days until sunset', () => {
      const today = new Date()
      const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      sunsetManager.registerSunsetPolicy({
        version: '1.0.0',
        deprecationDate: today.toISOString(),
        sunsetDate: futureDate.toISOString(),
        communicationPhases: [],
        decommissioningSteps: [],
        alternatives: [],
      })

      const days = sunsetManager.daysUntilSunset('1.0.0')
      expect(days).toBeGreaterThan(0)
      expect(days).toBeLessThanOrEqual(30)
    })

    it('should generate sunset notice', () => {
      const today = new Date()
      const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      sunsetManager.registerSunsetPolicy({
        version: '1.0.0',
        deprecationDate: today.toISOString(),
        sunsetDate: futureDate.toISOString(),
        communicationPhases: [],
        decommissioningSteps: [],
        alternatives: [
          { version: '1.1.0', reason: 'Bug fixes' },
          { version: '2.0.0', reason: 'New features' },
        ],
      })

      const notice = sunsetManager.generateSunsetNotice('1.0.0')
      expect(notice).toContain('SUNSET NOTICE')
      expect(notice).toContain('1.0.0')
      expect(notice).toContain('1.1.0')
      expect(notice).toContain('2.0.0')
    })

    it('should get versions expiring soon', () => {
      const today = new Date()
      const soon = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)
      const later = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000)

      sunsetManager.registerSunsetPolicy({
        version: '1.0.0',
        deprecationDate: today.toISOString(),
        sunsetDate: soon.toISOString(),
        communicationPhases: [],
        decommissioningSteps: [],
        alternatives: [],
      })

      sunsetManager.registerSunsetPolicy({
        version: '1.1.0',
        deprecationDate: today.toISOString(),
        sunsetDate: later.toISOString(),
        communicationPhases: [],
        decommissioningSteps: [],
        alternatives: [],
      })

      const expiring = sunsetManager.getExpiringVersions(30)
      expect(expiring).toContain('1.0.0')
      expect(expiring).not.toContain('1.1.0')
    })
  })

  // ─── Integration Tests ──────────────────────────────────────────────────

  describe('Integration Tests', () => {
    it('should handle complete versioning workflow', () => {
      const versionManager = new VersionManager()
      const deprecationManager = new DeprecationManager()
      const analyticsManager = new AnalyticsManager()

      // Register endpoint
      versionManager.registerEndpoint({
        path: '/accounts/:id',
        method: 'GET',
        versions: ['1.0.0', '2.0.0'],
        currentVersion: '2.0.0',
      })

      // Register deprecation
      deprecationManager.registerDeprecatedFeature({
        id: 'old-account-format',
        name: 'Old Account Format',
        description: 'Legacy account response',
        deprecatedIn: '1.5.0',
        sunsetsIn: '2.0.0',
        severity: 'warning',
        affectedEndpoints: ['/accounts/:id'],
      })

      // Track usage
      analyticsManager.recordRequest('1.0.0', 'user-1', true, 100)
      analyticsManager.recordDeprecatedFeatureUsage('old-account-format', 'Old Account Format', 'user-1')

      // Verify
      const endpoint = versionManager.getEndpoint('/accounts/:id', 'GET')
      const deprecation = deprecationManager.getDeprecatedFeature('old-account-format')
      const metrics = analyticsManager.getVersionMetrics('1.0.0')

      expect(endpoint).toBeDefined()
      expect(deprecation).toBeDefined()
      expect(metrics?.requestCount).toBe(1)
    })
  })
})
