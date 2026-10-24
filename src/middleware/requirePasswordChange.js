'use strict';

function requirePasswordChange(req, res, next) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'Change the temporary password before continuing.', requestId: req.requestId } });
  }
  return next();
}

module.exports = { requirePasswordChange };
