'use strict';

const { z } = require('zod');

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(12).max(72);

const registerSchema = z.object({ email, password }).strict();
const loginSchema = z.object({ email, password: z.string().min(1).max(72) }).strict();
const userListQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) }).strict();

module.exports = { registerSchema, loginSchema, userListQuerySchema };
