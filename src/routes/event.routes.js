'use strict';

const express = require('express');
const { createEventController } = require('../controllers/event.controller');
const { validate } = require('../middleware/validate');
const { requirePasswordChange } = require('../middleware/requirePasswordChange');
const { sessionIdParamsSchema } = require('../validators/session.validator');
const { eventSchema, eventListQuerySchema } = require('../validators/event.validator');

function createEventRoutes({ eventService, authMiddleware }) {
  const router = express.Router({ mergeParams: true });
  const controller = createEventController(eventService);
  router.use(authMiddleware, requirePasswordChange, validate(sessionIdParamsSchema, 'params'));
  router.post('/', validate(eventSchema), controller.append);
  router.get('/', validate(eventListQuerySchema, 'query'), controller.list);
  return router;
}

module.exports = { createEventRoutes };
