'use strict';

const { randomUUID } = require('node:crypto');
const { appError } = require('../errors');

class EventService {
  constructor({ eventRepository, sessionService, maxPageSize }) {
    this.eventRepository = eventRepository;
    this.sessionService = sessionService;
    this.maxPageSize = maxPageSize;
  }

  async append(user, sessionId, input, requestId) {
    const session = await this.sessionService.getAccessible(user, sessionId);
    if (session.status !== 'active') throw appError(409, 'SESSION_CLOSED', 'Events can only be added to an active session.');
    const document = {
      eventId: input.eventId || randomUUID(),
      sessionId,
      actorId: user.id,
      requestId,
      source: input.source,
      category: input.category,
      eventName: input.eventName,
      outcome: input.outcome || null,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      data: input.data
    };
    return this.eventRepository.append(document);
  }

  async list(user, sessionId, { limit, cursor }) {
    await this.sessionService.getAccessible(user, sessionId);
    if (limit > this.maxPageSize) limit = this.maxPageSize;
    return this.eventRepository.listBySession(sessionId, limit, cursor);
  }
}

module.exports = { EventService };
