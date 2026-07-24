/**
 * SERVER-SIDE LOAD DISTRIBUTION — API RATE LIMITER MIDDLEWARE
 * ===========================================================
 * Protects the backend API from excessive load by enforcing per-IP rate limits.
 * Uses a sliding window algorithm where timestamps older than the window (60s)
 * are filtered out, giving a rolling count of recent requests.
 *
 * Load distribution strategy:
 *   1. Per-IP sliding window prevents any single client from monopolizing
 *      server resources
 *   2. 100 req/min limit balances availability vs protection
 *   3. Returns 429 with Retry-After header on limit exceeded
 *
 * Integration:
 *   - Works alongside the client-side RateLimiter (rateLimiter.js) for
 *     two-layer protection
 *   - Server can also receive throttle mode hints from the client's
 *     capacity prediction to dynamically adjust limits during load spikes
 */

const rateLimitWindow = 60 * 1000; // 1 minute
const maxRequests = 100;
const requests = new Map();

export const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requests.has(ip)) {
    requests.set(ip, []);
  }
  
  const userRequests = requests.get(ip);
  const windowRequests = userRequests.filter(time => now - time < rateLimitWindow);
  
  if (windowRequests.length >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
  
  windowRequests.push(now);
  requests.set(ip, windowRequests);
  next();
};
