import path from 'node:path';
import type { Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { AppError } from '../errors/app-error';
import { asyncHandler } from '../lib/controller';
import { assertMediaAccess } from '../lib/media-access';
import { requestAccessToken } from '../lib/request-access-token';
import { getStorage, publicPathToKey } from '../storage/driver';
import { userRepository } from '../repositories/user.repository';
import { platformAdminRepository } from '../repositories/platform-admin.repository';
import { rbacService } from '../services/rbac.service';
import type { AuthPrincipal } from '../types/auth';
import { isRoleName } from '../domain/roles';

async function authFromRequest(req: Request): Promise<AuthPrincipal> {
  const token = requestAccessToken(req, { includeMediaCookie: true });
  if (!token) throw AppError.from('AUTH_MISSING_TOKEN');

  const payload = verifyAccessToken(token);
  if (payload.actorType === 'platform') {
    const admin = await platformAdminRepository.findById(payload.sub);
    if (!admin || admin.status !== 'ACTIVE') throw AppError.from('AUTH_PRINCIPAL_INVALID');
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
  if (!user || user.status !== 'ACTIVE') throw AppError.from('AUTH_PRINCIPAL_INVALID');
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

export const mediaController = {
  serve: asyncHandler(async (req: Request, res: Response) => {
    const suffix = (req.params[0] ?? '').replace(/^\/+/, '');
    if (!suffix || suffix.includes('..')) throw AppError.from('NOT_FOUND');
    const relativePath = suffix.startsWith('uploads/') ? `/${suffix}` : `/uploads/${suffix}`;
    const auth = await authFromRequest(req);
    await assertMediaAccess(auth, relativePath);
    const key = publicPathToKey(relativePath);
    const storage = getStorage();
    if (!(await storage.exists(key))) throw AppError.from('NOT_FOUND');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');
    const local = storage.localPath(key);
    if (local) {
      res.sendFile(path.resolve(local));
      return;
    }
    const stream = await storage.getStream(key);
    stream.pipe(res);
  }),
};
