import rateLimit, { type Options, type RateLimitRequestHandler, type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request, Response } from 'express';
import { env } from './env';
import {
  AUTH_RATE_MAX,
  AUTH_RATE_WINDOW_MS,
  AUTHENTICATED_RATE_MAX,
  CERT_VERIFY_RATE_MAX,
  GLOBAL_RATE_MAX_DEV,
  GLOBAL_RATE_MAX_PROD,
  REFRESH_RATE_MAX,
} from './constants';
import { AppError } from '../errors/app-error';
import { getRedis } from '../lib/redis';

if (env.NODE_ENV !== 'production' && !env.REDIS_URL) {
  // eslint-disable-next-line no-console
  console.warn('[rate-limit] using in-memory store (set REDIS_URL in production)');
}

function redisStore(prefix: string): Store | undefined {
  const client = getRedis();
  if (!client) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => client.call(args[0]!, ...args.slice(1)) as Promise<unknown> as never,
  });
}

function limitHandler(_req: Request, _res: Response): void {
  throw AppError.from('RATE_LIMITED', 'Too many requests. Please retry later.');
}

const standardHeaders: Options['standardHeaders'] = 'draft-7';

export const globalRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: AUTH_RATE_WINDOW_MS,
  max: env.NODE_ENV === 'production' ? GLOBAL_RATE_MAX_PROD : GLOBAL_RATE_MAX_DEV,
  standardHeaders,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/ready',
  handler: limitHandler,
  store: redisStore('rl:global:'),
});

export const authRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: AUTH_RATE_WINDOW_MS,
  max: AUTH_RATE_MAX,
  standardHeaders,
  legacyHeaders: false,
  handler: limitHandler,
  store: redisStore('rl:auth:'),
});

export const refreshRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: AUTH_RATE_WINDOW_MS,
  max: REFRESH_RATE_MAX,
  standardHeaders,
  legacyHeaders: false,
  handler: limitHandler,
  store: redisStore('rl:refresh:'),
});

export const authenticatedRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: AUTH_RATE_WINDOW_MS,
  max: AUTHENTICATED_RATE_MAX,
  standardHeaders,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.sub ?? req.ip ?? 'anonymous',
  handler: limitHandler,
  store: redisStore('rl:authed:'),
});

export const certificateVerifyRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: CERT_VERIFY_RATE_MAX,
  standardHeaders,
  legacyHeaders: false,
  handler: limitHandler,
  store: redisStore('rl:cert:'),
});
