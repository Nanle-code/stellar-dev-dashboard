/**
 * Public dashboard API versioning and deprecation headers.
 */

export const CURRENT_API_VERSION = '1.0.0';

export const SUPPORTED_API_VERSIONS = ['1.0', '1.0.0', 'v1'];

/**
 * Routes scheduled for removal. Prefix matching is applied to req.path.
 */
export const DEPRECATED_ROUTES = [
  {
    prefix: '/api/v1/behavior',
    deprecatedAt: 'Sat, 01 Jun 2026 00:00:00 GMT',
    sunset: 'Thu, 31 Dec 2026 00:00:00 GMT',
    successor: '/api/v2/behavior',
    message: 'Behavior endpoints are deprecated; migrate to /api/v2/behavior.',
  },
];

function findDeprecatedRoute(pathname) {
  if (typeof pathname !== 'string' || !pathname) {
    return null;
  }

  return DEPRECATED_ROUTES.find((route) => pathname.startsWith(route.prefix)) || null;
}

/**
 * Attach version metadata and deprecation headers to every API response.
 */
export function apiVersioningMiddleware(req, res, next) {
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

/**
 * Wrap JSON payloads with explicit API version metadata.
 */
export function withApiVersion(payload, options = {}) {
  const response = {
    apiVersion: CURRENT_API_VERSION,
    ...payload,
  };

  if (options.deprecated) {
    response.deprecated = true;
    response.successor = options.successor;
  }

  return response;
}
