'use strict';

const express = require('express');
const { createAdminController } = require('../controllers/admin.controller');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { userListQuerySchema } = require('../validators/auth.validator');

function createAdminRoutes({ adminService, authMiddleware }) {
  const router = express.Router();
  const controller = createAdminController(adminService);
  router.use(authMiddleware, requireRole('admin'));
  router.get('/users', validate(userListQuerySchema, 'query'), controller.users);
  router.get('/audit', validate(userListQuerySchema, 'query'), controller.audit);
  return router;
}

module.exports = { createAdminRoutes };
