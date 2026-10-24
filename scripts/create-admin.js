'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { loadConfig } = require('../src/config');
const { createDataSource } = require('../src/db');
const { UserRepository } = require('../src/repositories/user.repository');
const { AdminAuditRepository } = require('../src/repositories/adminAudit.repository');

async function main() {
  const config = loadConfig();
  const input = z.object({ email: z.string().email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(12).max(72) }).safeParse({
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD
  });
  if (!input.success) throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters in the local environment.');

  const dataSource = createDataSource(config);
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
    const users = new UserRepository(dataSource);
    const audit = new AdminAuditRepository(dataSource);
    let user = await users.findByEmail(input.data.email, true);
    const passwordHash = await bcrypt.hash(input.data.password, config.BCRYPT_ROUNDS);
    if (!user) {
      user = await users.create({ email: input.data.email, passwordHash, role: 'admin', mustChangePassword: false });
    } else {
      await users.setAdmin(user.id, passwordHash);
    }
    await audit.record({ actorId: user.id, action: 'admin.bootstrap', targetType: 'user', targetId: user.id, metadata: { email: input.data.email } });
    process.stdout.write(JSON.stringify({ adminCreated: true, userId: user.id, email: input.data.email }) + '\n');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  process.stderr.write(JSON.stringify({ code: error.code || 'ADMIN_BOOTSTRAP_FAILED', message: error.message }) + '\n');
  process.exitCode = 1;
});
