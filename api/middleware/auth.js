// Simple mock OAuth authentication middleware
export const oauthAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  
  const token = authHeader.split(' ')[1];
  // In a real scenario, we would validate the token with an OAuth provider
  // Here we just check if it's not empty and meets a minimum length
  if (token.length < 10) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  
  // Attach mock user object
  req.user = { id: 'user-1', roles: ['api_user'] };
  next();
};
