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

function findDeprecatedRoute(pathname: string): DeprecatedRoute | null {
  if (typeof pathname !== 'string' || !pathname) {
    return null;
  }

  return DEPRECATED_ROUTES.find((route) => pathname.startsWith(route.prefix)) || null;
}

export function apiVersioningMiddleware(req: Request, res: Response, next: NextFunction): Response | void {
  res.setHeader('API-Version', CURRENT_API_VERSION);
  res.setHeader('X-API-Version', CURRENT_API_VERSION);

  const acceptVersion = req.headers['accept-version'];
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
