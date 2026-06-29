/**
 * API Versioning Index
 * 
 * Exports all versioning modules
 */

export { VersionManager, globalVersionManager } from './versionManager'
export type { VersionNumber, VersionStrategy, ApiEndpoint, VersionedResponse, VersionConfig } from './versionManager'

export { DeprecationManager, globalDeprecationManager } from './deprecationWarnings'
export type { DeprecatedFeature, DeprecationWarning, MigrationPath } from './deprecationWarnings'

export { CompatibilityManager, globalCompatibilityManager } from './compatibilityLayer'
export type { TransformRule, CompatibilityAdapter } from './compatibilityLayer'

export { AnalyticsManager, globalAnalyticsManager } from './analytics'
export type { VersionUsageMetric, DeprecationMetric, AdoptionMetric } from './analytics'

export { MigrationManager, globalMigrationManager } from './migrations'
export type { MigrationStep, MigrationScript, MigrationReport } from './migrations'

export { SunsetManager, globalSunsetManager } from './sunsetManager'
export type { SunsetPolicy, CommunicationPhase, DecommissioningStep } from './sunsetManager'
