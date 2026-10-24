'use strict';

const { EntitySchema } = require('typeorm');

class ControlSession {}

const ControlSessionSchema = new EntitySchema({
  name: 'ControlSession',
  target: ControlSession,
  tableName: 'control_sessions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    ownerId: { name: 'owner_id', type: 'uuid' },
    label: { type: 'varchar', length: 120, nullable: true },
    status: { type: 'varchar', length: 16, default: 'active' },
    startedAt: { name: 'started_at', type: 'timestamptz', createDate: true },
    endedAt: { name: 'ended_at', type: 'timestamptz', nullable: true },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true }
  },
  indices: [{ name: 'idx_control_sessions_owner_started', columns: ['ownerId', 'startedAt'] }]
});

module.exports = { ControlSession, ControlSessionSchema };
