const jwt = require('jsonwebtoken');

/**
 * Authentication middleware to protect private routes.
 * Reads and verifies the JWT from HTTP-only cookie.
 */
const requireAuth = (req, res, next) => {
  // 1. Read the token from req.cookies.token
  const token = req.cookies && req.cookies.token;

  // 2. If token does not exist: redirect to /auth/login
  if (!token) {
    return res.redirect('/auth/login');
  }

  try {
    // 3. Verify the token using jwt.verify() and process.env.JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Set req.user = { id: decoded.userId }
    req.user = {
      id: decoded.userId
    };

    // 5. Call next()
    return next();
  } catch (error) {
    // 7. If the JWT is invalid or expired:
    // clear the authentication cookie and redirect to /auth/login (do not crash)
    res.clearCookie('token');
    return res.redirect('/auth/login');
  }
};

module.exports = {
  requireAuth
};
