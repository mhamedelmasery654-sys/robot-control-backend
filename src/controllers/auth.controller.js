'use strict';

function createAuthController(authService) {
  return {
    register: async (req, res) => res.status(201).json({ data: await authService.register(req.body), requestId: req.requestId }),
    login: async (req, res) => res.json({ data: await authService.login(req.body), requestId: req.requestId }),
    profile: async (req, res) => res.json({ data: await authService.getProfile(req.user.id), requestId: req.requestId })
  };
}

module.exports = { createAuthController };
