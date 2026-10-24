'use strict';

require('reflect-metadata');
const path = require('node:path');
const { DataSource } = require('typeorm');
const { UserSchema } = require('./entities/User');
const { ControlSessionSchema } = require('./entities/ControlSession');
const { AdminAuditSchema } = require('./entities/AdminAudit');
const { InitialRobotControlSchema1761000000000 } = require('./migrations/1761000000000-InitialRobotControlSchema');

function createDataSource(config) {
  const connection = config.DATABASE_URL
    ? { url: config.DATABASE_URL }
    : {
        host: config.DB_HOST,
        port: config.DB_PORT,
        username: config.DB_USERNAME,
        password: config.DB_PASSWORD,
        database: config.DB_NAME
      };
  return new DataSource({
    type: 'postgres',
    ...connection,
    entities: [UserSchema, ControlSessionSchema, AdminAuditSchema],
    migrations: [InitialRobotControlSchema1761000000000],
    migrationsTableName: 'robot_control_migrations',
    synchronize: false,
    migrationsRun: false,
    logging: config.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
  });
}

module.exports = { createDataSource };
