'use strict';

const { EntitySchema } = require('typeorm');

class AdminAudit {}

const AdminAuditSchema = new EntitySchema({
  name: 'AdminAudit',
  target: AdminAudit,
  tableName: 'admin_audit',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    actorId: { name: 'actor_id', type: 'uuid', nullable: true },
    action: { type: 'varchar', length: 80 },
    targetType: { name: 'target_type', type: 'varchar', length: 80 },
    targetId: { name: 'target_id', type: 'varchar', length: 120, nullable: true },
    metadata: { type: 'jsonb', default: () => "'{}'::jsonb" },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true }
  },
  indices: [{ name: 'idx_admin_audit_created', columns: ['createdAt'] }]
});

module.exports = { AdminAudit, AdminAuditSchema };
