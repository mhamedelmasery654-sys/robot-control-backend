'use strict';

require('dotenv').config();
const http = require('node:http');
const mongoose = require('mongoose');
const { loadConfig } = require('./config');
const { createDataSource } = require('./db');
const { ControlEvent } = require('./entities/ControlEvent');
const { UserRepository } = require('./repositories/user.repository');
const { SessionRepository } = require('./repositories/session.repository');
const { AdminAuditRepository } = require('./repositories/adminAudit.repository');
const { EventRepository } = require('./repositories/event.repository');
const { AuthService } = require('./services/auth.service');
const { SessionService } = require('./services/session.service');
const { EventService } = require('./services/event.service');
const { HealthService } = require('./services/health.service');
const { AdminService } = require('./services/admin.service');
const { createApp } = require('./app');
const { attachWebSocketServer } = require('./websocket');

async function start() {
  const config = loadConfig();
  const dataSource = createDataSource(config);
  try {
  await dataSource.initialize();
  if (config.RUN_MIGRATIONS) await dataSource.runMigrations();
  await mongoose.connect(config.MONGODB_URI, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  await ControlEvent.createIndexes();
  await ControlEvent.collection.createIndex({ receivedAt: 1 }, {
    expireAfterSeconds: config.eventRetentionDays * 24 * 60 * 60,
    name: 'ttl_control_events_received'
  });

  const userRepository = new UserRepository(dataSource);
  const sessionRepository = new SessionRepository(dataSource);
  const auditRepository = new AdminAuditRepository(dataSource);
  const eventRepository = new EventRepository(ControlEvent);
  const authService = new AuthService({ userRepository, jwtSecret: config.JWT_SECRET, jwtExpiresIn: config.JWT_EXPIRES_IN, bcryptRounds: config.BCRYPT_ROUNDS });
  const sessionService = new SessionService({ sessionRepository, auditRepository });
  const eventService = new EventService({ eventRepository, sessionService, maxPageSize: config.maxEventPageSize });
  const healthService = new HealthService({ dataSource, mongoose });
  const adminService = new AdminService({ userRepository, auditRepository });
  const app = createApp({ config, authService, userRepository, sessionService, eventService, healthService, adminService });
  const server = http.createServer(app);
  const websocketServer = attachWebSocketServer(server, { authService, userRepository, sessionService, eventService, publicOrigins: config.publicOrigins });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.PORT, config.HOST, resolve);
  });
  process.stdout.write(JSON.stringify({ level: 'info', message: 'robot-control-backend listening', host: config.HOST, port: config.PORT, websocketPath: '/api/v1/ws' }) + '\n');

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write(JSON.stringify({ level: 'info', message: 'shutdown started', signal }) + '\n');
    const forceTimer = setTimeout(() => process.exit(1), 10000).unref();
    for (const client of websocketServer.clients) client.close(1001, 'Server shutting down');
    server.close(async () => {
      clearTimeout(forceTimer);
      await Promise.allSettled([mongoose.disconnect(), dataSource.destroy()]);
      process.exit(0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return { server, dataSource };
  } catch (error) {
    await Promise.allSettled([
      mongoose.disconnect(),
      dataSource.isInitialized ? dataSource.destroy() : Promise.resolve()
    ]);
    throw error;
  }
}

if (require.main === module) {
  start().catch((error) => {
    process.stderr.write(JSON.stringify({ level: 'fatal', code: error.code || 'STARTUP_FAILED', message: error.message }) + '\n');
    process.exit(1);
  });
}

module.exports = { start };
