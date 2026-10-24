'use strict';

function createAdminController(adminService) {
  return {
    users: async (req, res) => res.json({ data: await adminService.listUsers(req.query.page, req.query.limit), requestId: req.requestId }),
    audit: async (req, res) => res.json({ data: await adminService.listAudit(req.query.page, req.query.limit), requestId: req.requestId })
  };
}

module.exports = { createAdminController };
