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
// Always dual-stack in production so Railway private IPv6 + local IPv4 both work.
// Override with LISTEN_HOST (CI sets 0.0.0.0).
const host =
  process.env.LISTEN_HOST ?? (env.NODE_ENV === 'production' ? '::' : '0.0.0.0');
const server = app.listen({ port, host, ipv6Only: false }, () => {
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
