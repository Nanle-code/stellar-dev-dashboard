import { Request, Response, NextFunction } from 'express';

// Simple in-memory cache for liquidity predictions
// Cache key: `${req.path}?${JSON.stringify(req.query)}`
// Value: { timestamp: number, data: any }

const cache: Map<string, { timestamp: number; data: any }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function cacheMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = `${req.path}?${JSON.stringify(req.query)}`;
  const entry = cache.get(key);
  const now = Date.now();

  if (entry && now - entry.timestamp < CACHE_TTL_MS) {
    // Return cached response
    return res.json(entry.data);
  }

  // Monkey-patch res.json to store the response in cache
  const originalJson = res.json.bind(res);
  const patchedJson = (body: any): Response => {
    cache.set(key, { timestamp: now, data: body });
    return originalJson(body);
  };
  (res.json as any) = patchedJson;

  next();
}
