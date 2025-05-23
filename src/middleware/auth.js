// Placeholder for LIFF ID token verification
// In a real application, you would use a library like 'axios' to call LINE's token verification API:
// POST https://api.line.me/oauth2/v2.1/verify
// Body: id_token=<ID_TOKEN>&client_id=<YOUR_CHANNEL_ID>

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  // Simulated token verification
  if (token === 'TEST_VALID_TOKEN_USER') {
    req.user = { userId: 'mockUser123' };
    next();
  } else if (token === 'TEST_VALID_TOKEN_ADMIN') {
    req.user = { userId: 'mockAdmin789', isAdmin: true };
    next();
  } else {
    // In a real app, actual verification would happen here.
    // If verification fails, return 401.
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
};

module.exports = {
  authenticate,
  isAdmin,
};
