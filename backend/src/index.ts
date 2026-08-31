import { execSync } from 'node:child_process';
import app from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { disconnectRedis } from './lib/redis';

if (env.SENTRY_DSN) {
  void import('@sentry/node').then((Sentry) => {
    Sentry.init({ dsn: env.SENTRY_DSN });
  });
}

function runProductionMigrations() {
  if (!env.isProd) return;
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    logger.info('prisma_migrate_deploy_ok');
  } catch (err) {
    logger.error({ err }, 'prisma_migrate_deploy_failed');
    process.exit(1);
  }
}

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info({ port: env.PORT, host: '0.0.0.0' }, 'api_listening');
  runProductionMigrations();
});

function shutdown(signal: string) {
  logger.info({ signal }, 'shutting_down');
  server.close(() => {
    void prisma.$disconnect().finally(() => {
      void disconnectRedis().finally(() => process.exit(0));
    });
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
