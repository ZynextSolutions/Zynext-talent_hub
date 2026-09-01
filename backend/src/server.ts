import type { Server } from 'node:http';
import { env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';

export function startServer(): Server {
  const app = createApp();
  return app.listen(env.PORT, '::', () => {
    logger.info({ port: env.PORT, host: '::' }, `Zynext TalentHub API listening on ${env.API_PUBLIC_URL}/api/v1`);
  });
}
