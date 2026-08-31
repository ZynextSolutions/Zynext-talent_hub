import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error';
import { env } from '../config/env';
import { isExplicitAllJobScope, timingSafeSecretEqual } from '../lib/job-secret';
import { organizationRepository } from '../repositories/organization.repository';

const uuidSchema = z.string().uuid();

function expectedJobSecret(): string | undefined {
  return env.JOB_SECRET ?? (env.isDev ? 'dev-job-secret' : undefined);
}

export function isJobSecretRequest(req: Request): boolean {
  return timingSafeSecretEqual(req.get('X-Job-Secret') ?? undefined, expectedJobSecret());
}

export async function resolveJobOrg(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    if (!raw) {
      if (!isExplicitAllJobScope(req.get('X-Job-Scope') ?? undefined)) {
        throw AppError.from(
          'VALIDATION_ERROR',
          'organizationId is required unless X-Job-Scope is all.',
        );
      }
      req.jobAllOrganizations = true;
      next();
      return;
    }
    const parsed = uuidSchema.safeParse(raw);
    if (!parsed.success) throw AppError.from('VALIDATION_ERROR', 'organizationId must be a UUID');
    const org = await organizationRepository.findById(parsed.data);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
    req.tenant = { organizationId: org.id, isolation: 'job' };
    next();
  } catch (err) {
    next(err);
  }
}

export function jobAccess(req: Request, res: Response, next: NextFunction): void {
  if (!isJobSecretRequest(req)) {
    next(AppError.from('RBAC_FORBIDDEN'));
    return;
  }
  void resolveJobOrg(req, res, next);
}
