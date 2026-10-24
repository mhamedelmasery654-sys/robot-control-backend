'use strict';

const express = require('express');
const { createHealthController } = require('../controllers/health.controller');

function createHealthRoutes(healthService) {
  const router = express.Router();
  const controller = createHealthController(healthService);
  router.get('/live', controller.live);
  router.get('/ready', controller.ready);
  return router;
}

module.exports = { createHealthRoutes };
