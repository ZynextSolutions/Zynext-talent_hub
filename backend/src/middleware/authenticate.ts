import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { AppError } from '../errors/app-error';
import { userRepository } from '../repositories/user.repository';
import { platformAdminRepository } from '../repositories/platform-admin.repository';
import { rbacService } from '../services/rbac.service';
import type { AuthPrincipal } from '../types/auth';
import { isRoleName } from '../domain/roles';

const PUBLIC_SUFFIXES = [
  '/health',
  '/ready',
  '/auth/login',
  '/auth/register',
  '/auth/registration-status',
  '/auth/refresh',
  '/auth/logout',
  '/auth/platform/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/accept-invite',
];

function isPublic(req: Request): boolean {
  if (req.method === 'OPTIONS') return true;
  const full = req.originalUrl.split('?')[0];
  if (PUBLIC_SUFFIXES.some((s) => full === s || full.endsWith(s) || req.path === s)) return true;
  if (full.includes('/certificates/number/') || req.path.startsWith('/certificates/number/')) return true;
  return false;
}

async function principalFromAccessToken(token: string): Promise<AuthPrincipal> {
  const payload = verifyAccessToken(token);

  if (payload.actorType === 'platform') {
    const admin = await platformAdminRepository.findById(payload.sub);
    if (!admin) throw AppError.from('AUTH_PRINCIPAL_INVALID');
    if (admin.status !== 'ACTIVE') throw AppError.from('AUTH_ACCOUNT_SUSPENDED');
    return {
      actorType: 'platform',
      sub: admin.id,
      email: admin.email,
      organizationId: null,
      role: 'SUPER_ADMIN',
      permissions: rbacService.getPermissions('SUPER_ADMIN'),
      tokenFamilyId: payload.fam,
    };
  }

  if (!payload.organizationId) throw AppError.from('AUTH_PRINCIPAL_INVALID');
  const user = await userRepository.findByIdAndOrg(payload.sub, payload.organizationId);
  if (!user) throw AppError.from('AUTH_PRINCIPAL_INVALID');
  if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
    throw AppError.from('AUTH_ACCOUNT_SUSPENDED');
  }
  if (user.status !== 'ACTIVE') throw AppError.from('AUTH_PRINCIPAL_INVALID');
  if (user.organization.status !== 'ACTIVE' || user.organization.deletedAt) {
    throw AppError.from('AUTH_ORG_SUSPENDED');
  }
  const roleName = isRoleName(user.role.name) ? user.role.name : 'EMPLOYEE';
  return {
    actorType: 'user',
    sub: user.id,
    email: user.email,
    organizationId: user.organizationId,
    role: roleName,
    permissions: rbacService.getPermissions(roleName),
    tokenFamilyId: payload.fam,
    departmentId: user.departmentId,
    teamId: user.teamId,
    divisionId: user.divisionId,
  };
}

/** Resolve Bearer access token if present and valid; return null on missing/expired/invalid. */
export async function tryResolveBearerAuth(req: Request): Promise<AuthPrincipal | null> {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    return await principalFromAccessToken(token);
  } catch {
    return null;
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (isPublic(req)) {
      next();
      return;
    }

    const header = req.header('authorization');
    if (!header || !header.startsWith('Bearer ')) {
      throw AppError.from('AUTH_MISSING_TOKEN');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw AppError.from('AUTH_MISSING_TOKEN');

    req.auth = await principalFromAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization');
  if (!header) {
    next();
    return;
  }
  await authenticate(req, res, next);
}
