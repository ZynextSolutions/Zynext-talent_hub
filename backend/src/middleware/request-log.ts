import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';

export function requestLog(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(
      {
        requestId: req.requestId,
        orgId: req.auth?.organizationId ?? undefined,
        actorId: req.auth?.sub,
        method: req.method,
        path: req.originalUrl ?? req.path,
        status: res.statusCode,
        duration_ms: Date.now() - start,
      },
      'request',
    );
  });
  next();
}
