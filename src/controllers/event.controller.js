'use strict';

function createEventController(eventService) {
  return {
    append: async (req, res) => {
      const result = await eventService.append(req.user, req.params.sessionId, req.body, req.requestId);
      return res.status(result.duplicate ? 200 : 201).json({ data: { eventId: result.event.eventId, category: result.event.category, occurredAt: result.event.occurredAt, receivedAt: result.event.receivedAt || null, duplicate: result.duplicate }, requestId: req.requestId });
    },
    list: async (req, res) => res.json({ data: await eventService.list(req.user, req.params.sessionId, req.query), requestId: req.requestId })
  };
}

module.exports = { createEventController };
