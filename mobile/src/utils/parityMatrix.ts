export type Platform = 'web' | 'mobile';

export interface FeatureSupport {
  featureName: string;
  supportedPlatforms: Platform[];
  sharedLogicSafely: boolean;
  notes?: string;
}

const parityMatrix: Record<string, FeatureSupport> = {
  authentication: {
    featureName: 'Authentication',
    supportedPlatforms: ['web', 'mobile'],
    sharedLogicSafely: true,
    notes: 'Uses shared JWT and session management logic.'
  },
  biometrics: {
    featureName: 'Biometrics',
    supportedPlatforms: ['mobile'],
    sharedLogicSafely: false,
    notes: 'Mobile-specific feature utilizing native device APIs.'
  },
  hardwarewallet: {
    featureName: 'Hardware Wallet',
    supportedPlatforms: ['web'],
    sharedLogicSafely: false,
    notes: 'Requires WebUSB which is unsupported in React Native.'
  },
  pushnotifications: {
    featureName: 'Push Notifications',
    supportedPlatforms: ['mobile', 'web'],
    sharedLogicSafely: false,
    notes: 'Different implementations (FCM on mobile, Web Push API on web).'
  },
  transactionbuilder: {
    featureName: 'Transaction Builder',
    supportedPlatforms: ['web', 'mobile'],
    sharedLogicSafely: true,
    notes: 'Core transaction logic is shared via common SDK.'
  }
};

/**
 * Validates feature parity across supported platforms.
 * @param feature The name of the feature to check.
 * @param platform The platform environment (web or mobile).
 * @returns boolean indicating if the feature is supported on the given platform.
 */
export function checkFeatureParity(feature: string, platform: Platform): boolean {
  if (!feature || typeof feature !== 'string') {
    throw new Error('Invalid input: Feature name must be a non-empty string.');
  }

  if (platform !== 'web' && platform !== 'mobile') {
    throw new Error(`Unsupported environment: Platform '${platform}' is not supported.`);
  }

  const normalizedFeature = feature.toLowerCase().replace(/\s+/g, '');
  const featureData = parityMatrix[normalizedFeature];
  
  if (!featureData) {
    throw new Error(`Failure path: Feature '${feature}' not found in the parity matrix.`);
  }

  return featureData.supportedPlatforms.includes(platform);
}

/**
 * Identifies which logic can be shared safely between web and mobile.
 * @returns Array of feature names that can share logic safely.
 */
export function getSharedLogicFeatures(): string[] {
  return Object.values(parityMatrix)
    .filter(f => f.sharedLogicSafely)
    .map(f => f.featureName);
}

/**
 * Returns the full parity matrix data.
 * @returns The parity matrix record.
 */
export function getParityMatrix(): Record<string, FeatureSupport> {
  return { ...parityMatrix };
}
