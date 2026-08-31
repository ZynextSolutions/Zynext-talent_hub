import type { NextFunction, Request, Response } from 'express';
import type { Permission } from '../domain/roles';
import { hasPermission } from '../lib/rbac';
import { AppError } from '../errors/app-error';

export function requirePermission(permission: Permission | Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      next(AppError.from('AUTH_MISSING_TOKEN'));
      return;
    }
    if (!hasPermission(auth.permissions, permission)) {
      next(AppError.from('RBAC_FORBIDDEN'));
      return;
    }
    next();
  };
}
