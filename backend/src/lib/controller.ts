import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';

export function tenantOrgId(req: Request): string {
  if (!req.tenant?.organizationId) throw AppError.from('TENANT_REQUIRED');
  return req.tenant.organizationId;
}

export function validated<T>(req: Request): T {
  return (req.validated?.body ?? req.body) as T;
}

export function validatedQuery<T>(req: Request): T {
  return (req.validated?.query ?? req.query) as T;
}

export function validatedParams<T>(req: Request): T {
  return (req.validated?.params ?? req.params) as T;
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };
}
