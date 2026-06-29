/**
 * API Version Manager
 * 
 * Handles API versioning strategy, routing, and version headers
 * Supports semantic versioning (major.minor.patch)
 */

export type VersionNumber = `${number}.${number}.${number}`
export type VersionStrategy = 'header' | 'url-path' | 'query-param' | 'hybrid'

export interface ApiEndpoint {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  versions: string[]
  currentVersion: VersionNumber
  deprecated?: boolean
  deprecatedAt?: string
  sunsetsAt?: string
}

export interface VersionedResponse<T = unknown> {
  data: T
  version: VersionNumber
  deprecated?: boolean
  deprecationWarning?: string
  migrationUrl?: string
}

export interface VersionConfig {
  apiVersion: VersionNumber
  minSupportedVersion: VersionNumber
  maxSupportedVersion: VersionNumber
  strategy: VersionStrategy
  headerName?: string
  urlPrefix?: string
  queryParamName?: string
}

const DEFAULT_VERSION_CONFIG: VersionConfig = {
  apiVersion: '1.0.0',
  minSupportedVersion: '1.0.0',
  maxSupportedVersion: '2.0.0',
  strategy: 'header',
  headerName: 'X-API-Version',
  urlPrefix: '/api/v',
  queryParamName: 'api_version',
}

/**
 * VersionManager: Core API versioning system
 */
export class VersionManager {
  private config: VersionConfig
  private endpoints: Map<string, ApiEndpoint> = new Map()
  private versionHistory: Map<string, VersionNumber[]> = new Map()

  constructor(config: Partial<VersionConfig> = {}) {
    this.config = { ...DEFAULT_VERSION_CONFIG, ...config }
  }

  /**
   * Register an API endpoint with version information
   */
  registerEndpoint(endpoint: ApiEndpoint): void {
    const key = `${endpoint.method}:${endpoint.path}`
    this.endpoints.set(key, endpoint)
    
    // Track version history
    if (!this.versionHistory.has(endpoint.path)) {
      this.versionHistory.set(endpoint.path, [])
    }
    const history = this.versionHistory.get(endpoint.path)!
    endpoint.versions.forEach(version => {
      if (!history.includes(version as VersionNumber)) {
        history.push(version as VersionNumber)
      }
    })
  }

  /**
   * Get endpoint by path and method
   */
  getEndpoint(path: string, method: string): ApiEndpoint | undefined {
    const key = `${method}:${path}`
    return this.endpoints.get(key)
  }

  /**
   * Extract version from request based on strategy
   */
  extractVersion(request: {
    headers?: Record<string, string>
    url?: string
  }): VersionNumber | null {
    switch (this.config.strategy) {
      case 'header':
        return this.extractFromHeader(request.headers)
      case 'url-path':
        return this.extractFromUrlPath(request.url)
      case 'query-param':
        return this.extractFromQueryParam(request.url)
      case 'hybrid':
        return (
          this.extractFromHeader(request.headers) ||
          this.extractFromUrlPath(request.url) ||
          this.extractFromQueryParam(request.url) ||
          this.config.apiVersion
        )
      default:
        return this.config.apiVersion
    }
  }

  /**
   * Extract version from X-API-Version header
   */
  private extractFromHeader(headers?: Record<string, string>): VersionNumber | null {
    if (!headers || !this.config.headerName) return null
    const version = headers[this.config.headerName]
    return this.isValidVersion(version) ? (version as VersionNumber) : null
  }

  /**
   * Extract version from URL path (e.g., /api/v1/users)
   */
  private extractFromUrlPath(url?: string): VersionNumber | null {
    if (!url || !this.config.urlPrefix) return null
    const match = url.match(new RegExp(`${this.config.urlPrefix}(\\d+\\.\\d+\\.\\d+)`))
    return match ? (match[1] as VersionNumber) : null
  }

  /**
   * Extract version from query parameter
   */
  private extractFromQueryParam(url?: string): VersionNumber | null {
    if (!url || !this.config.queryParamName) return null
    const urlObj = new URL(url, 'http://localhost')
    const version = urlObj.searchParams.get(this.config.queryParamName)
    return version && this.isValidVersion(version) ? (version as VersionNumber) : null
  }

  /**
   * Check if version string is valid semantic version
   */
  isValidVersion(version: unknown): boolean {
    if (typeof version !== 'string') return false
    return /^\d+\.\d+\.\d+$/.test(version)
  }

  /**
   * Check if version is supported
   */
  isSupportedVersion(version: VersionNumber): boolean {
    return this.compareVersions(version, this.config.minSupportedVersion) >= 0 &&
           this.compareVersions(version, this.config.maxSupportedVersion) <= 0
  }

  /**
   * Compare two semantic versions
   * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
   */
  compareVersions(v1: VersionNumber, v2: VersionNumber): number {
    const [major1, minor1, patch1] = v1.split('.').map(Number)
    const [major2, minor2, patch2] = v2.split('.').map(Number)

    if (major1 !== major2) return major1 > major2 ? 1 : -1
    if (minor1 !== minor2) return minor1 > minor2 ? 1 : -1
    if (patch1 !== patch2) return patch1 > patch2 ? 1 : -1
    return 0
  }

  /**
   * Get next version
   */
  getNextVersion(version: VersionNumber, type: 'major' | 'minor' | 'patch'): VersionNumber {
    const [major, minor, patch] = version.split('.').map(Number)

    switch (type) {
      case 'major':
        return `${major + 1}.0.0` as VersionNumber
      case 'minor':
        return `${major}.${minor + 1}.0` as VersionNumber
      case 'patch':
        return `${major}.${minor}.${patch + 1}` as VersionNumber
    }
  }

  /**
   * Format URL with version
   */
  formatUrl(path: string, version: VersionNumber): string {
    switch (this.config.strategy) {
      case 'url-path':
        return `${this.config.urlPrefix}${version.split('.')[0]}${path}`
      case 'query-param':
        const separator = path.includes('?') ? '&' : '?'
        return `${path}${separator}${this.config.queryParamName}=${version}`
      default:
        return path
    }
  }

  /**
   * Create versioned response with metadata
   */
  createVersionedResponse<T>(
    data: T,
    version: VersionNumber,
    deprecated?: boolean,
    deprecationWarning?: string
  ): VersionedResponse<T> {
    return {
      data,
      version,
      ...(deprecated && { deprecated: true }),
      ...(deprecationWarning && { deprecationWarning }),
    }
  }

  /**
   * Get version headers for request
   */
  getVersionHeaders(version: VersionNumber): Record<string, string> {
    if (this.config.strategy === 'header' && this.config.headerName) {
      return {
        [this.config.headerName]: version,
      }
    }
    return {}
  }

  /**
   * Get all registered endpoints
   */
  getAllEndpoints(): ApiEndpoint[] {
    return Array.from(this.endpoints.values())
  }

  /**
   * Get version history for endpoint
   */
  getVersionHistory(path: string): VersionNumber[] | undefined {
    return this.versionHistory.get(path)
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VersionConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): VersionConfig {
    return { ...this.config }
  }
}

/**
 * Global version manager instance
 */
export const globalVersionManager = new VersionManager({
  apiVersion: '1.0.0',
  minSupportedVersion: '1.0.0',
  maxSupportedVersion: '2.0.0',
  strategy: 'header',
})
