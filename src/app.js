'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { requestContext } = require('./middleware/requestContext');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { createAuthMiddleware } = require('./middleware/authMiddleware');
const { createHealthRoutes } = require('./routes/health.routes');
const { createAuthRoutes } = require('./routes/auth.routes');
const { createSessionRoutes } = require('./routes/session.routes');
const { createEventRoutes } = require('./routes/event.routes');
const { createAdminRoutes } = require('./routes/admin.routes');

function createApp({ config, authService, userRepository, sessionService, eventService, healthService, adminService }) {
  const app = express();
  const jwt = { verify: (token) => authService.verifyToken(token) };
  const authMiddleware = createAuthMiddleware(userRepository, jwt);
  const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false });

  app.disable('x-powered-by');
  app.set('trust proxy', config.NODE_ENV === 'production' ? 1 : false);
  app.use(requestContext);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.publicOrigins.includes(origin)) return callback(null, true);
      const error = new Error('CORS origin not allowed.');
      error.statusCode = 403;
      error.code = 'CORS_FORBIDDEN';
      return callback(error);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    credentials: false,
    maxAge: 600
  }));
  app.use(express.json({ limit: '64kb', strict: true }));
  app.use('/api/v1', apiLimiter);
  app.use('/api/v1/health', createHealthRoutes(healthService));
  app.use('/api/v1/auth', createAuthRoutes({ authService, authMiddleware }));
  app.use('/api/v1/sessions', createSessionRoutes({ sessionService, authMiddleware }));
  app.use('/api/v1/sessions/:sessionId/events', createEventRoutes({ eventService, authMiddleware }));
  app.use('/api/v1/admin', createAdminRoutes({ adminService, authMiddleware }));
  app.get('/openapi.yaml', (req, res) => res.sendFile(path.join(__dirname, '..', 'postman', 'specs', 'openapi.yaml')));
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html', maxAge: config.NODE_ENV === 'production' ? '1h' : 0 }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
