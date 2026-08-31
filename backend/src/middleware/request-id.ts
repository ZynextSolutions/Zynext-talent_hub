import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { REQUEST_ID_RE } from '../config/constants';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && REQUEST_ID_RE.test(incoming) ? incoming : randomUUID().replace(/-/g, '');
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
