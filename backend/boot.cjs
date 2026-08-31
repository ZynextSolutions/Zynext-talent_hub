const { spawnSync } = require('node:child_process');

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
  'ENCRYPTION_KEY',
];

console.log(
  '[boot]',
  Object.fromEntries(keys.map((key) => [key, process.env[key] ? 'set' : 'MISSING'])),
);

const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
});
if (migrate.status !== 0) {
  console.error('[boot] prisma migrate deploy failed', migrate.status);
  process.exit(migrate.status || 1);
}

require('./dist/index.js');
