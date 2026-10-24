'use strict';

const express = require('express');
const { createSessionController } = require('../controllers/session.controller');
const { validate } = require('../middleware/validate');
const { requirePasswordChange } = require('../middleware/requirePasswordChange');
const { createSessionSchema, sessionIdParamsSchema, listSessionsQuerySchema } = require('../validators/session.validator');

function createSessionRoutes({ sessionService, authMiddleware }) {
  const router = express.Router();
  const controller = createSessionController(sessionService);
  router.use(authMiddleware, requirePasswordChange);
  router.get('/', validate(listSessionsQuerySchema, 'query'), controller.list);
  router.post('/', validate(createSessionSchema), controller.create);
  router.get('/:sessionId', validate(sessionIdParamsSchema, 'params'), controller.get);
  router.post('/:sessionId/close', validate(sessionIdParamsSchema, 'params'), controller.close);
  return router;
}

module.exports = { createSessionRoutes };
