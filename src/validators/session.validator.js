'use strict';

const { z } = require('zod');

const createSessionSchema = z.object({ label: z.string().trim().min(1).max(120).optional() }).strict();
const sessionIdParamsSchema = z.object({ sessionId: z.string().uuid() }).strict();
const listSessionsQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) }).strict();

module.exports = { createSessionSchema, sessionIdParamsSchema, listSessionsQuerySchema };
