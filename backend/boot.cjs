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
  Object.fromEntries(
    keys.map((key) => {
      const value = process.env[key];
      return [key, value ? `set(len=${value.length})` : 'MISSING'];
    }),
  ),
);

require('./dist/index.js');
