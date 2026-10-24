'use strict';

const { EntitySchema } = require('typeorm');

class User {}

const UserSchema = new EntitySchema({
  name: 'User',
  target: User,
  tableName: 'users',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    email: { type: 'varchar', length: 254, unique: true },
    passwordHash: { name: 'password_hash', type: 'varchar', length: 255, select: false },
    role: { type: 'varchar', length: 20, default: 'operator' },
    mustChangePassword: { name: 'must_change_password', type: 'boolean', default: false },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true }
  }
});

module.exports = { User, UserSchema };
