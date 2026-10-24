'use strict';

function createAuthMiddleware(userRepository, jwt) {
  return async function authMiddleware(req, res, next) {
    const header = req.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Bearer token required.', requestId: req.requestId } });

    try {
      const claims = jwt.verify(match[1]);
      const user = await userRepository.findById(claims.sub);
      if (!user) return res.status(401).json({ error: { code: 'AUTH_INVALID', message: 'The account is unavailable.', requestId: req.requestId } });
      req.user = { id: user.id, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword };
      return next();
    } catch (error) {
      if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
        return res.status(401).json({ error: { code: 'AUTH_INVALID', message: 'The token is invalid or expired.', requestId: req.requestId } });
      }
      return next(error);
    }
  };
}

module.exports = { createAuthMiddleware };
