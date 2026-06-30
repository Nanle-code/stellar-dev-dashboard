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
