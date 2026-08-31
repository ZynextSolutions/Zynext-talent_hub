import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { userRepository } from '../repositories/user.repository';
import type { DataScope } from '../types/auth';

export async function scopeManager(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) throw AppError.from('AUTH_MISSING_TOKEN');

    if (auth.viaApiKey) {
      req.scope = { kind: 'org' };
      next();
      return;
    }

    if (auth.actorType === 'platform' || auth.role === 'ORG_ADMIN') {
      req.scope = { kind: 'org' };
      next();
      return;
    }

    if (auth.role === 'INSTRUCTOR') {
      if (!auth.organizationId) throw AppError.from('AUTH_PRINCIPAL_INVALID');
      const user = await userRepository.getById(auth.organizationId, auth.sub);
      if (!user?.departmentId) {
        req.scope = { kind: 'self', userId: auth.sub };
      } else {
        req.scope = { kind: 'department', departmentId: user.departmentId };
      }
      next();
      return;
    }

    if (auth.role === 'EMPLOYEE') {
      req.scope = { kind: 'self', userId: auth.sub };
      next();
      return;
    }

    if (auth.role === 'MANAGER') {
      if (!auth.organizationId) throw AppError.from('AUTH_PRINCIPAL_INVALID');
      const user = await userRepository.getById(auth.organizationId, auth.sub);
      if (!user?.departmentId) throw AppError.from('RBAC_SCOPE_MISSING');
      const scope: DataScope = { kind: 'department', departmentId: user.departmentId };
      req.scope = scope;
      next();
      return;
    }

    throw AppError.from('RBAC_FORBIDDEN');
  } catch (err) {
    next(err);
  }
}
