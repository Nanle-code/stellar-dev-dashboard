import { Request, Response, NextFunction } from 'express';

export type EnvironmentType = 'development' | 'test' | 'production';

interface User {
  id: string;
  roles: string[];
  environment: EnvironmentType;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

const SUPPORTED_ENVIRONMENTS = new Set<EnvironmentType>(['development', 'test', 'production']);

export function getRuntimeEnvironment(environment: string = process.env.NODE_ENV || 'development'): EnvironmentType {
  const normalized = String(environment || '').trim().toLowerCase() as EnvironmentType;

  if (!normalized) {
    return 'development';
  }

  if (!SUPPORTED_ENVIRONMENTS.has(normalized)) {
    throw new Error(`Unsupported environment: '${environment}'. Supported values are: development, test, production.`);
  }

  return normalized;
}

export const oauthAuth = (req: Request, res: Response, next: NextFunction): Response | void => {
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

export const requireRole = (...requiredRoles: string[]) => (req: Request, res: Response, next: NextFunction): Response | void => {
  const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const roleList = new Set<string>([...userRoles, ...(req.user?.role ? [req.user.role] : [])]);

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

export const requireSelfOrAdmin = (userIdSelector: (req: Request) => string | undefined = (req) => req.params.userId || (req.query?.userId as string) || (req.body?.userId as string) || (req.headers['x-user-id'] as string)) => (req: Request, res: Response, next: NextFunction): Response | void => {
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
