import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { JSON_BODY_LIMIT } from './config/constants';
import { requestId } from './middleware/request-id';
import { requestLog } from './middleware/request-log';
import { errorHandler } from './middleware/error-handler';
import { apiRouter, healthRouter } from './routes';
import { globalRateLimit } from './middleware/rate-limit';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(requestLog);
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      referrerPolicy: { policy: 'no-referrer' },
      hsts: env.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
    }),
  );
  app.use(
    '/uploads',
    (_req, res) => {
      res.status(403).json({
        success: false,
        error: {
          code: 'RBAC_FORBIDDEN',
          message: 'Use the authenticated media API to access uploaded files.',
        },
      });
    },
  );
  app.use(
    cors({
      origin: env.isDev
        ? true
        : env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'Idempotency-Key',
        'X-Request-Id',
        'If-Match',
        'X-Filename',
        'X-Asset-Kind',
      ],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(globalRateLimit);

  app.use(healthRouter);
  app.use('/api/v1', apiRouter);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
      meta: { requestId: res.getHeader('X-Request-Id') ?? 'unknown' },
    });
  });

  app.use(errorHandler);
  return app;
}

const app = createApp();
export default app;
