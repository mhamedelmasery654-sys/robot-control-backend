'use strict';

const { appError } = require('../errors');
const { sessionOwnerCondition } = require('../middleware/postOwnerCondition');

class SessionService {
  constructor({ sessionRepository, auditRepository }) {
    this.sessionRepository = sessionRepository;
    this.auditRepository = auditRepository;
  }

  async create(user, { label }) {
    const session = await this.sessionRepository.create({ ownerId: user.id, label: label || null, status: 'active', endedAt: null });
    await this.auditRepository.record({ actorId: user.id, action: 'session.created', targetType: 'control_session', targetId: session.id, metadata: {} });
    return session;
  }

  list(user, page, limit) {
    const skip = (page - 1) * limit;
    return this.sessionRepository.listForOwner(user.id, { take: limit, skip });
  }

  async getAccessible(user, sessionId) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session || !sessionOwnerCondition(session, user)) throw appError(404, 'SESSION_NOT_FOUND', 'Control session was not found.');
    return session;
  }

  async close(user, sessionId) {
    const session = await this.getAccessible(user, sessionId);
    if (session.status === 'closed') return session;
    const closed = await this.sessionRepository.close(sessionId, new Date());
    await this.auditRepository.record({ actorId: user.id, action: 'session.closed', targetType: 'control_session', targetId: sessionId, metadata: {} });
    return closed;
  }
}

module.exports = { SessionService };
