const SUPPORTED_ENVIRONMENTS = new Set(['development', 'test', 'production']);

export function getRuntimeEnvironment(environment = process.env.NODE_ENV || 'development') {
  const normalized = String(environment || '').trim().toLowerCase();

  if (!normalized) {
    return 'development';
  }

  if (!SUPPORTED_ENVIRONMENTS.has(normalized)) {
    throw new Error(`Unsupported environment: '${environment}'. Supported values are: development, test, production.`);
  }

  return normalized;
}

export const oauthAuth = (req, res, next) => {
  const authHeader = req.headers?.authorization;

  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token || token.length < 10 || !/^[A-Za-z0-9._~+/=-]+$/.test(token)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  getRuntimeEnvironment();

  req.user = {
    id: 'user-1',
    roles: ['api_user'],
    environment: getRuntimeEnvironment(),
  };

  return next();
};

export const requireRole = (...requiredRoles) => (req, res, next) => {
  const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const roleList = new Set([...userRoles, ...(req.user?.role ? [req.user.role] : [])]);

  if (!req.user || requiredRoles.length === 0) {
    return next();
  }

  if (!requiredRoles.some((role) => roleList.has(role))) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `Requires one of: ${requiredRoles.join(', ')}`,
    });
  }

  return next();
};

export const requireSelfOrAdmin = (userIdSelector = (req) => req.params.userId || req.query.userId || req.body.userId || req.headers['x-user-id']) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const requestedUserId = userIdSelector(req);
  const currentUserId = req.user.id;
  const roles = Array.isArray(req.user.roles) ? req.user.roles : [];

  if (!requestedUserId) {
    req.userId = currentUserId;
    return next();
  }

  if (requestedUserId === currentUserId || roles.includes('admin')) {
    req.userId = requestedUserId;
    return next();
  }

  return res.status(403).json({
    error: 'Forbidden',
    message: 'You do not have access to this user-scoped resource.',
  });
};
