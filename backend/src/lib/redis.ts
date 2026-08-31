import Redis from 'ioredis';
import { env } from '../config/env';

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    client.on('error', (err) => {
      console.error(JSON.stringify({ level: 'error', msg: 'redis_error', err: String(err) }));
    });
    void client.connect().catch((err) => {
      console.error(JSON.stringify({ level: 'error', msg: 'redis_connect_failed', err: String(err) }));
    });
  }
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return;
  await client.quit();
  client = null;
}
