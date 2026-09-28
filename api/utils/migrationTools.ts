import { DEPRECATED_ROUTES, CURRENT_API_VERSION, SUPPORTED_API_VERSIONS } from '../middleware/apiVersioning.js';

export interface MigrationGuide {
  from: string;
  to: string;
  breaking_changes: string[];
  steps: string[];
  examples: Record<string, { before: string; after: string }>;
}

export const MIGRATION_GUIDES: MigrationGuide[] = [
  {
    from: 'v1',
    to: 'v2',
    breaking_changes: [
      'Behavior endpoints moved from /api/v1/behavior to /api/v2/behavior',
      'Response format includes additional metadata fields',
      'Authentication header format updated',
    ],
    steps: [
      'Update base URL from /api/v1 to /api/v2',
      'Update Accept-Version header to "2.0" or "v2"',
      'Review and update response parsing logic for new metadata fields',
      'Test integration in staging environment',
      'Monitor deprecation warnings in production',
    ],
    examples: {
      behavior: {
        before: 'GET /api/v1/behavior/analytics',
        after: 'GET /api/v2/behavior/analytics',
      },
    },
  },
];

export function getMigrationGuide(from: string, to: string): MigrationGuide | null {
  return (
    MIGRATION_GUIDES.find((guide) => guide.from === from && guide.to === to) || null
  );
}

export function getAllMigrationGuides(): MigrationGuide[] {
  return MIGRATION_GUIDES;
}

export interface CompatibilityCheck {
  version: string;
  supported: boolean;
  deprecated: boolean;
  sunsetDate?: string;
  successor?: string;
  message?: string;
}

export function checkVersionCompatibility(version: string): CompatibilityCheck {
  const supported = SUPPORTED_API_VERSIONS.includes(version);
  
  const deprecatedRoute = DEPRECATED_ROUTES.find((route) =>
    route.prefix.includes(version)
  );
  
  return {
    version,
    supported,
    deprecated: !!deprecatedRoute,
    sunsetDate: deprecatedRoute?.sunset,
    successor: deprecatedRoute?.successor,
    message: deprecatedRoute?.message,
  };
}

export interface BreakingChange {
  version: string;
  date: string;
  changes: string[];
  impact: 'low' | 'medium' | 'high';
}

export const BREAKING_CHANGES: BreakingChange[] = [
  {
    version: 'v2',
    date: '2027-01-01',
    changes: [
      'Behavior endpoints restructured',
      'New authentication mechanism',
      'Response pagination format changed',
    ],
    impact: 'high',
  },
];

export function getBreakingChanges(fromVersion?: string): BreakingChange[] {
  if (!fromVersion) {
    return BREAKING_CHANGES;
  }
  
  return BREAKING_CHANGES.filter((change) => change.version > fromVersion);
}

export interface SunsetPolicy {
  deprecationPeriod: string;
  sunsetWarning: string;
  gracePeriod: string;
  enforcement: string;
}

export const SUNSET_POLICY: SunsetPolicy = {
  deprecationPeriod: '6 months minimum before sunset date',
  sunsetWarning: 'Deprecation headers sent in all responses',
  gracePeriod: '30 days after sunset for critical bug fixes only',
  enforcement: 'After sunset, endpoints return HTTP 410 Gone',
};

export function getSunsetPolicy(): SunsetPolicy {
  return SUNSET_POLICY;
}

export interface VersionInfo {
  current: string;
  supported: string[];
  deprecated: string[];
  sunset: string[];
}

export function getVersionInfo(): VersionInfo {
  const now = new Date();
  const deprecated: string[] = [];
  const sunset: string[] = [];
  
  DEPRECATED_ROUTES.forEach((route) => {
    const sunsetDate = new Date(route.sunset);
    if (now >= sunsetDate) {
      sunset.push(route.prefix);
    } else {
      deprecated.push(route.prefix);
    }
  });
  
  return {
    current: CURRENT_API_VERSION,
    supported: SUPPORTED_API_VERSIONS,
    deprecated,
    sunset,
  };
}
