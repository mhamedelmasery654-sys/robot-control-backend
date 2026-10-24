'use strict';

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role.', requestId: req.requestId } });
    }
    return next();
  };
}

module.exports = { requireRole };
