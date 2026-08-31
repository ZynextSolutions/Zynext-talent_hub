import type { NextFunction, Request, Response } from 'express';
import { integrationsService } from '../services/integrations.service';
import { AppError } from '../errors/app-error';

export async function authenticateApiKey(req: Request, _res: Response, next: NextFunction) {
  try {
    const raw = req.header('X-Api-Key') ?? req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!raw) {
      next(AppError.from('AUTH_MISSING_TOKEN'));
      return;
    }
    const key = await integrationsService.authenticateApiKey(raw);
    if (!key) {
      next(AppError.from('AUTH_INVALID_TOKEN'));
      return;
    }
    req.auth = {
      actorType: 'user',
      sub: key.createdByUserId ?? key.id,
      email: 'api-key@system',
      organizationId: key.organizationId,
      role: 'EMPLOYEE',
      permissions: key.scopes,
      tokenFamilyId: key.id,
      viaApiKey: true,
    };
    req.tenant = { organizationId: key.organizationId, isolation: 'strict' };
    next();
  } catch (err) {
    next(err);
  }
}
