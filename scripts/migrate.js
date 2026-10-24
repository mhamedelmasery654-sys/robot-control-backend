'use strict';

require('dotenv').config();
const { loadConfig } = require('../src/config');
const { createDataSource } = require('../src/db');

async function main() {
  const config = loadConfig();
  const dataSource = createDataSource(config);
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations();
    process.stdout.write(JSON.stringify({ appliedMigrations: applied.map((migration) => migration.name) }) + '\n');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  process.stderr.write(JSON.stringify({ code: error.code || 'MIGRATION_FAILED', message: error.message }) + '\n');
  process.exitCode = 1;
});
