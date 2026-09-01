import type { Server } from 'node:http';
import { env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';

export function startServer(): Server {
  const app = createApp();
  const host =
    process.env.LISTEN_HOST ??
    (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PRIVATE_DOMAIN ? '::' : '0.0.0.0');
  return app.listen(env.PORT, host, () => {
    logger.info({ port: env.PORT, host }, `Zynext TalentHub API listening on ${env.API_PUBLIC_URL}/api/v1`);
  });
}
