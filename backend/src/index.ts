import { spawn } from 'node:child_process';
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

function runPrisma(args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['prisma', ...args], { stdio: 'inherit', env: process.env });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function runProductionMigrations() {
  if (!env.isProd) return;
  let code = await runPrisma(['migrate', 'deploy']);
  if (code !== 0) {
    logger.warn('prisma_p3009_resolving_scorm_mvp');
    await runPrisma(['migrate', 'resolve', '--rolled-back', '20250831220000_scorm_mvp']);
    code = await runPrisma(['migrate', 'deploy']);
  }
  if (code === 0) {
    logger.info('prisma_migrate_deploy_ok');
    return;
  }
  logger.error({ code }, 'prisma_migrate_deploy_failed');
  process.exit(1);
}

const port = env.PORT;
const server = app.listen(port, '0.0.0.0', () => {
  logger.info({ port, host: '0.0.0.0' }, 'api_listening');
  void runProductionMigrations();
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
