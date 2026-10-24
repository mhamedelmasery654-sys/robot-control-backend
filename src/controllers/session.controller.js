'use strict';

function createSessionController(sessionService) {
  return {
    create: async (req, res) => res.status(201).json({ data: await sessionService.create(req.user, req.body), requestId: req.requestId }),
    list: async (req, res) => res.json({ data: await sessionService.list(req.user, req.query.page, req.query.limit), requestId: req.requestId }),
    get: async (req, res) => res.json({ data: await sessionService.getAccessible(req.user, req.params.sessionId), requestId: req.requestId }),
    close: async (req, res) => res.json({ data: await sessionService.close(req.user, req.params.sessionId), requestId: req.requestId })
  };
}

module.exports = { createSessionController };
