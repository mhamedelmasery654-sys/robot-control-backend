'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { createAuthController } = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth.validator');

function createAuthRoutes({ authService, authMiddleware }) {
  const router = express.Router();
  const controller = createAuthController(authService);
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'LOGIN_RATE_LIMIT', message: 'Too many sign-in attempts. Try again later.' } } });
  const registrationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'REGISTRATION_RATE_LIMIT', message: 'Too many account creation attempts. Try again later.' } } });
  router.post('/register', registrationLimiter, validate(registerSchema), controller.register);
  router.post('/login', loginLimiter, validate(loginSchema), controller.login);
  router.get('/me', authMiddleware, controller.profile);
  return router;
}

module.exports = { createAuthRoutes };
