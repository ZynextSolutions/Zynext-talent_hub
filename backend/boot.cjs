const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
process.chdir(root);

function encryptionKeyStatus(raw) {
  if (!raw) return 'MISSING';
  const n = Buffer.from(raw, 'base64').length;
  return n === 32 ? 'set (32-byte)' : `INVALID (${n}-byte, need openssl rand -base64 32)`;
}

const keys = [
  'PORT',
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ISS',
  'JWT_AUD',
  'CORS_ORIGINS',
  'REDIS_URL',
  'JOB_SECRET',
];

console.log(
  '[boot]',
  Object.fromEntries(keys.map((key) => [key, process.env[key] ? 'set' : 'MISSING'])),
  { ENCRYPTION_KEY: encryptionKeyStatus(process.env.ENCRYPTION_KEY) },
);

const prismaCli = path.join(root, 'node_modules/prisma/build/index.js');
if (!fs.existsSync(prismaCli)) {
  console.error('[boot] prisma CLI missing at', prismaCli);
  process.exit(1);
}

console.log('[boot] running prisma migrate deploy');
const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
});

if (migrate.status !== 0) {
  console.error('[boot] prisma migrate deploy failed', migrate.status);
  console.error('[boot] P3009 (failed migration row): wipe the Postgres database or run:');
  console.error('[boot]   DELETE FROM "_prisma_migrations" WHERE finished_at IS NULL;');
  console.error('[boot] If the DB used an older multi-file migration chain, reset Postgres and redeploy.');
  console.error('[boot] See docs/DEPLOYMENT.md');
  process.exit(migrate.status || 1);
}

console.log('[boot] migrations applied, starting API');
require('./dist/index.js');
