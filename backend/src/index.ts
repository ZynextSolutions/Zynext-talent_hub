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

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info({ port: env.PORT }, 'api_listening');
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
