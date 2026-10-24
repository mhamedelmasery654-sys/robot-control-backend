'use strict';

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ at: row.occurredAt.toISOString(), id: String(row._id) })).toString('base64url');
}

function decodeCursor(cursor) {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const at = new Date(value.at);
    if (!value.id || Number.isNaN(at.getTime())) return null;
    return { at, id: value.id };
  } catch {
    return null;
  }
}

class EventRepository {
  constructor(model) {
    this.model = model;
  }

  async append(values) {
    try {
      const document = await this.model.create(values);
      return { event: document.toObject(), duplicate: false };
    } catch (error) {
      if (error?.code === 11000 && values.eventId) {
        const document = await this.model.findOne({ sessionId: values.sessionId, eventId: values.eventId }).lean();
        if (document) return { event: document, duplicate: true };
      }
      throw error;
    }
  }

  async listBySession(sessionId, limit, cursor) {
    const filter = { sessionId };
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (!decoded) {
        const error = new Error('Pagination cursor is invalid.');
        error.statusCode = 400;
        error.code = 'INVALID_CURSOR';
        throw error;
      }
      filter.$or = [
        { occurredAt: { $lt: decoded.at } },
        { occurredAt: decoded.at, _id: { $lt: decoded.id } }
      ];
    }
    const rows = await this.model.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null };
  }
}

module.exports = { EventRepository, decodeCursor };
