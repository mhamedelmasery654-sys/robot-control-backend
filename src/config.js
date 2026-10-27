'use strict';

const { z } = require('zod');

const PORTFOLIO_ORIGIN = 'https://mhamedelmasery654-sys.github.io';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  HOST: z.string().default('127.0.0.1'),
  PUBLIC_ORIGINS: z.string().default('http://localhost:8765,http://127.0.0.1:8765'),
  RUN_MIGRATIONS: z.enum(['true', 'false']).default('false'),
  DATABASE_URL: z.string().url().optional(),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5433),
  DB_USERNAME: z.string().default('postgres'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().regex(/^[A-Za-z0-9_]+$/).default('robot_control_backend'),
  MONGODB_URI: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('30m'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  EVENT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  MAX_EVENT_PAGE_SIZE: z.coerce.number().int().min(1).max(500).default(100)
});

function loadConfig(env = process.env) {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    const error = new Error(`Invalid or missing environment configuration: ${fields}`);
    error.code = 'INVALID_CONFIG';
    throw error;
  }
  const value = parsed.data;
  const origins = [...new Set([
    ...value.PUBLIC_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
    PORTFOLIO_ORIGIN
  ])];
  if (env.RENDER_EXTERNAL_URL) {
    try {
      origins.push(new URL(env.RENDER_EXTERNAL_URL).origin);
    } catch {
      const error = new Error('RENDER_EXTERNAL_URL must be a valid absolute URL.');
      error.code = 'INVALID_RENDER_URL';
      throw error;
    }
  }
  const hasPostgresCredentials = Boolean(value.DATABASE_URL || value.DB_PASSWORD);
  if (value.NODE_ENV === 'production' && (value.JWT_SECRET.startsWith('replace-') || !hasPostgresCredentials || origins.length === 0 || origins.includes('*'))) {
    const error = new Error('Production requires private PostgreSQL/JWT credentials and an explicit CORS origin allow-list.');
    error.code = 'UNSAFE_PRODUCTION_CONFIG';
    throw error;
  }
  return Object.freeze({
    ...value,
    RUN_MIGRATIONS: value.RUN_MIGRATIONS === 'true',
    publicOrigins: origins,
    eventRetentionDays: value.EVENT_RETENTION_DAYS,
    maxEventPageSize: value.MAX_EVENT_PAGE_SIZE
  });
}

module.exports = { loadConfig };

