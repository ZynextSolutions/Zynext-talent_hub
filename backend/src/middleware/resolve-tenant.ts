import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error';
import { organizationRepository } from '../repositories/organization.repository';
import { auditService } from '../services/audit.service';

const uuidSchema = z.string().uuid();

export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) throw AppError.from('AUTH_MISSING_TOKEN');

    if (auth.actorType === 'user') {
      if (!auth.organizationId) throw AppError.from('AUTH_PRINCIPAL_INVALID');
      const queryOrg = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
      const bodyOrg =
        req.body && typeof req.body === 'object' && 'organizationId' in req.body
          ? (req.body as { organizationId?: unknown }).organizationId
          : undefined;
      if (
        (queryOrg && queryOrg !== auth.organizationId) ||
        (typeof bodyOrg === 'string' && bodyOrg !== auth.organizationId)
      ) {
        // eslint-disable-next-line no-console
        console.warn(
          JSON.stringify({
            level: 'warn',
            event: 'TENANT_OVERRIDE_ATTEMPT',
            requestId: req.requestId,
            actorId: auth.sub,
          }),
        );
      }
      req.tenant = { organizationId: auth.organizationId, isolation: 'strict' };
      next();
      return;
    }

    if (req.baseUrl.includes('/platform') || req.path.startsWith('/platform')) {
      next();
      return;
    }

    const raw = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    if (!raw) throw AppError.from('TENANT_REQUIRED');
    const parsed = uuidSchema.safeParse(raw);
    if (!parsed.success) throw AppError.from('VALIDATION_ERROR', 'organizationId must be a UUID');
    const org = await organizationRepository.findById(parsed.data);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
    req.tenant = { organizationId: org.id, isolation: 'platform' };
    void auditService.record({
      organizationId: org.id,
      actorType: 'platform',
      actorId: auth.sub,
      action: 'PLATFORM_TENANT_ACCESS',
      resourceType: 'Organization',
      resourceId: org.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    });
    next();
  } catch (err) {
    next(err);
  }
}
