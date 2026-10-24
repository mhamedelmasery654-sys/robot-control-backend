'use strict';

function createHealthController(healthService) {
  return {
    live: (req, res) => res.json({ status: 'ok', requestId: req.requestId }),
    ready: async (req, res) => {
      const result = await healthService.readiness();
      return res.status(result.ready ? 200 : 503).json({ status: result.ready ? 'ready' : 'not_ready', ...result, requestId: req.requestId });
    }
  };
}

module.exports = { createHealthController };
