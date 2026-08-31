import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';

export function requireOrgAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) {
    next(AppError.from('AUTH_MISSING_TOKEN'));
    return;
  }
  if (req.auth.role !== 'ORG_ADMIN' && req.auth.actorType !== 'platform') {
    next(AppError.from('RBAC_FORBIDDEN'));
    return;
  }
  next();
}
