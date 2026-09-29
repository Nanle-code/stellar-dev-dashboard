import { Request, Response, NextFunction } from 'express';

export const CURRENT_API_VERSION = '1.0.0';

export const SUPPORTED_API_VERSIONS = ['1.0', '1.0.0', 'v1'];

export interface DeprecatedRoute {
  prefix: string;
  deprecatedAt: string;
  sunset: string;
  successor: string;
  message: string;
}

export const DEPRECATED_ROUTES: DeprecatedRoute[] = [
  {
    prefix: '/api/v1/behavior',
    deprecatedAt: 'Sat, 01 Jun 2026 00:00:00 GMT',
    sunset: 'Thu, 31 Dec 2026 00:00:00 GMT',
    successor: '/api/v2/behavior',
    message: 'Behavior endpoints are deprecated; migrate to /api/v2/behavior.',
  },
];

// Version usage analytics store
interface VersionUsageMetrics {
  version: string;
  count: number;
  lastSeen: string;
  endpoints: Map<string, number>;
}

const versionUsageMap = new Map<string, VersionUsageMetrics>();
const deprecatedRouteUsageMap = new Map<string, { count: number; lastSeen: string }>();

function trackVersionUsage(version: string, endpoint: string): void {
  const key = version || 'unversioned';
  const existing = versionUsageMap.get(key);
  
  if (existing) {
    existing.count++;
    existing.lastSeen = new Date().toISOString();
    existing.endpoints.set(endpoint, (existing.endpoints.get(endpoint) || 0) + 1);
  } else {
    const endpoints = new Map<string, number>();
    endpoints.set(endpoint, 1);
    versionUsageMap.set(key, {
      version: key,
      count: 1,
      lastSeen: new Date().toISOString(),
      endpoints,
    });
  }
}

function trackDeprecatedRouteUsage(route: string): void {
  const existing = deprecatedRouteUsageMap.get(route);
  
  if (existing) {
    existing.count++;
    existing.lastSeen = new Date().toISOString();
  } else {
    deprecatedRouteUsageMap.set(route, {
      count: 1,
      lastSeen: new Date().toISOString(),
    });
  }
}

export function getVersionUsageMetrics(): Record<string, unknown> {
  const metrics: Record<string, unknown> = {};
  
  versionUsageMap.forEach((value, key) => {
    const endpointsObj: Record<string, number> = {};
    value.endpoints.forEach((count, endpoint) => {
      endpointsObj[endpoint] = count;
    });
    
    metrics[key] = {
      count: value.count,
      lastSeen: value.lastSeen,
      endpoints: endpointsObj,
    };
  });
  
  return metrics;
}

export function getDeprecatedRouteMetrics(): Record<string, unknown> {
  const metrics: Record<string, unknown> = {};
  
  deprecatedRouteUsageMap.forEach((value, key) => {
    metrics[key] = value;
  });
  
  return metrics;
}

function findDeprecatedRoute(pathname: string): DeprecatedRoute | null {
  if (typeof pathname !== 'string' || !pathname) {
    return null;
  }

  return DEPRECATED_ROUTES.find((route) => pathname.startsWith(route.prefix)) || null;
}

function isSunset(sunsetDate: string): boolean {
  try {
    const sunset = new Date(sunsetDate);
    return new Date() >= sunset;
  } catch {
    return false;
  }
}

export function apiVersioningMiddleware(req: Request, res: Response, next: NextFunction): Response | void {
  res.setHeader('API-Version', CURRENT_API_VERSION);
  res.setHeader('X-API-Version', CURRENT_API_VERSION);

  const acceptVersion = req.headers['accept-version'];
  const versionForTracking = acceptVersion ? String(acceptVersion) : CURRENT_API_VERSION;
  
  trackVersionUsage(versionForTracking, req.path);

  if (acceptVersion && !SUPPORTED_API_VERSIONS.includes(String(acceptVersion))) {
    return res.status(400).json({
      error: 'Unsupported API version',
      message: `Accept-Version "${acceptVersion}" is not supported.`,
      supportedVersions: SUPPORTED_API_VERSIONS,
      currentVersion: CURRENT_API_VERSION,
    });
  }

  const deprecatedRoute = findDeprecatedRoute(req.path);
  if (deprecatedRoute) {
    trackDeprecatedRouteUsage(req.path);
    
    // Check if route is past sunset date
    if (isSunset(deprecatedRoute.sunset)) {
      return res.status(410).json({
        error: 'Endpoint removed',
        message: deprecatedRoute.message,
        successor: deprecatedRoute.successor,
        sunsetDate: deprecatedRoute.sunset,
      });
    }
    
    res.setHeader('Deprecation', deprecatedRoute.deprecatedAt);
    res.setHeader('Sunset', deprecatedRoute.sunset);
    res.setHeader('Link', `<${deprecatedRoute.successor}>; rel="successor-version"`);
    res.setHeader('Warning', `299 - "${deprecatedRoute.message}"`);
  }

  return next();
}

export interface WithApiVersionOptions {
  deprecated?: boolean;
  successor?: string;
}

export function withApiVersion(payload: Record<string, unknown>, options: WithApiVersionOptions = {}): Record<string, unknown> {
  const response: Record<string, unknown> = {
    apiVersion: CURRENT_API_VERSION,
    ...payload,
  };

  if (options.deprecated) {
    response.deprecated = true;
    response.successor = options.successor;
  }

  return response;
}
