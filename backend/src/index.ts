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

const port = env.PORT;
// Railway private networking is IPv6. Bind `::` there; keep `0.0.0.0` for local/CI
// so curl/fetch to 127.0.0.1 keeps working.
const host =
  process.env.LISTEN_HOST ??
  (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PRIVATE_DOMAIN ? '::' : '0.0.0.0');
const server = app.listen(port, host, () => {
  logger.info({ port, host }, 'api_listening');
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
