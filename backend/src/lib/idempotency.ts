import { AppError } from '../errors/app-error';
import { env } from '../config/env';
import { getRedis } from './redis';

const memory = new Map<string, { expires: number; body: string }>();
const TTL_SEC = 24 * 60 * 60;

function cacheKey(organizationId: string, key: string, fingerprint: string): string {
  return `idem:${organizationId}:${key}:${fingerprint}`;
}

export async function takeIdempotent(
  organizationId: string,
  key: string | undefined,
  fingerprint: string,
): Promise<unknown | null> {
  if (!key) throw AppError.from('IDEMPOTENCY_KEY_REQUIRED');
  const redisKey = cacheKey(organizationId, key, fingerprint);
  const redis = getRedis();
  if (redis) {
    const hit = await redis.get(redisKey);
    if (hit) return JSON.parse(hit) as unknown;
    return null;
  }
  if (env.isProd) return null;
  const hit = memory.get(redisKey);
  if (hit && hit.expires > Date.now()) return JSON.parse(hit.body) as unknown;
  return null;
}

export async function storeIdempotent(
  organizationId: string,
  key: string,
  fingerprint: string,
  body: unknown,
): Promise<void> {
  const redisKey = cacheKey(organizationId, key, fingerprint);
  const payload = JSON.stringify(body);
  const redis = getRedis();
  if (redis) {
    await redis.set(redisKey, payload, 'EX', TTL_SEC);
    return;
  }
  if (env.isProd) return;
  memory.set(redisKey, { expires: Date.now() + TTL_SEC * 1000, body: payload });
}
