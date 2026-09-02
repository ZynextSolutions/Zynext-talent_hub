import type { Prisma } from '@prisma/client';
import { INVITE_TTL_MS, MFA_LOGIN_TTL_MS, PLATFORM_LOCKOUT_ORG_ID, RESET_TTL_MS } from '../config/constants';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { sha256, randomToken } from '../lib/crypto';
import { toOrganizationDto, toUserDto } from '../lib/mappers';
import { prisma } from '../lib/prisma';
import { oneTimeTokenRepository } from '../repositories/one-time-token.repository';
import { organizationRepository } from '../repositories/organization.repository';
import { platformAdminRepository } from '../repositories/platform-admin.repository';
import { roleRepository } from '../repositories/role.repository';
import { userRepository } from '../repositories/user.repository';
import type { AuthPrincipal } from '../types/auth';
import { saveAvatar } from '../lib/uploads';
import { mailService } from './mail.service';
import { mfaService } from './mfa.service';
import { passwordService } from './password.service';
import { tokenService } from './token.service';
import { loginEventService } from './login-event.service';
import { loginLockoutRepository } from '../repositories/login-lockout.repository';
import { auditService } from './audit.service';

type RegisterInput = {
  organizationName: string;
  organizationSlug: string;
  admin?: { email: string; password: string; firstName: string; lastName: string };
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  userAgent?: string | null;
  ip?: string | null;
};

type LoginInput = {
  email: string;
  password: string;
  organizationSlug: string;
  userAgent?: string | null;
  ip?: string | null;
};

type OneTimePurpose = 'INVITE' | 'PASSWORD_RESET' | 'MFA_LOGIN';

class AuthService {
  async register(input: RegisterInput) {
    const admin = input.admin ?? {
      email: input.email ?? '',
      password: input.password ?? '',
      firstName: input.firstName ?? '',
      lastName: input.lastName ?? '',
    };
    passwordService.assertPolicy(admin.password, { email: admin.email, orgSlug: input.organizationSlug });
    const slug = input.organizationSlug.toLowerCase();
    if (await organizationRepository.findBySlug(slug)) {
      throw AppError.from('ORGANIZATION_SLUG_TAKEN');
    }
    const email = admin.email.trim().toLowerCase();
    const passwordHash = await passwordService.hash(admin.password);

    const created = await prisma.$transaction(async (tx) => {
      const org = await organizationRepository.withTx(tx).create({
        name: input.organizationName.trim(),
        slug,
      });
      const roles = await roleRepository.withTx(tx).ensureOrgRoles(org.id);
      const division = await tx.division.create({
        data: { organizationId: org.id, name: 'Headquarters' },
      });
      const department = await tx.department.create({
        data: { organizationId: org.id, divisionId: division.id, name: 'Administration' },
      });
      const team = await tx.team.create({
        data: { organizationId: org.id, departmentId: department.id, name: 'Leadership' },
      });
      const user = await userRepository.withTx(tx).create({
        organization: { connect: { id: org.id } },
        role: { connect: { id: roles.ORG_ADMIN } },
        team: { connect: { id: team.id } },
        department: { connect: { id: department.id } },
        division: { connect: { id: division.id } },
        email,
        passwordHash,
        firstName: admin.firstName.trim(),
        lastName: admin.lastName.trim(),
        status: 'ACTIVE',
      });
      return { org, user };
    });

    const tokens = await tokenService.issuePair({
      sub: created.user.id,
      actorType: 'user',
      organizationId: created.org.id,
      role: 'ORG_ADMIN',
      userAgent: input.userAgent,
      ip: input.ip,
    });
    await auditService.record({
      organizationId: created.org.id,
      actorType: 'user',
      actorId: created.user.id,
      action: 'AUTH_REGISTER',
      resourceType: 'Organization',
      resourceId: created.org.id,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return {
      user: toUserDto(created.user),
      organization: toOrganizationDto(created.org),
      tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn },
    };
  }

  async login(emailOrInput: string | LoginInput, password?: string, organizationSlug?: string) {
    const input: LoginInput =
      typeof emailOrInput === 'string'
        ? { email: emailOrInput, password: password ?? '', organizationSlug: organizationSlug ?? '' }
        : emailOrInput;
    const email = input.email.trim().toLowerCase();
    const org = await organizationRepository.findBySlug(input.organizationSlug.toLowerCase());
    if (!org) {
      await passwordService.dummyCompare(input.password);
      throw AppError.from('AUTH_INVALID_CREDENTIALS');
    }
    if (org.status === 'SUSPENDED' || org.deletedAt) {
      throw AppError.from('AUTH_ORG_SUSPENDED');
    }
    await loginLockoutRepository.assertNotLocked(org.id, email);
    const user = await userRepository.findByEmail(org.id, email);
    if (!user) {
      await passwordService.dummyCompare(input.password);
      await loginLockoutRepository.recordFailure(org.id, email);
      throw AppError.from('AUTH_INVALID_CREDENTIALS');
    }
    const ok = await passwordService.verify(input.password, user.passwordHash);
    if (!ok) {
      await loginLockoutRepository.recordFailure(org.id, email);
      throw AppError.from('AUTH_INVALID_CREDENTIALS');
    }
    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      throw AppError.from('AUTH_ACCOUNT_SUSPENDED');
    }
    if (user.status !== 'ACTIVE') {
      throw AppError.from('AUTH_INVALID_CREDENTIALS');
    }
    await loginLockoutRepository.clear(org.id, email);
    if (user.mfaEnabled && user.mfaSecret) {
      const mfaToken = await this.issueOneTimeToken({
        organizationId: org.id,
        userId: user.id,
        purpose: 'MFA_LOGIN',
        ttlMs: MFA_LOGIN_TTL_MS,
      });
      return { mfaRequired: true, mfaToken };
    }
    await userRepository.update(org.id, user.id, { lastLoginAt: new Date() });
    loginEventService.recordLogin({
      organizationId: org.id,
      userId: user.id,
      method: 'password',
      ip: input.ip,
      userAgent: input.userAgent,
    });
    await auditService.record({
      organizationId: org.id,
      actorType: 'user',
      actorId: user.id,
      action: 'AUTH_LOGIN',
      resourceType: 'User',
      resourceId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    const tokens = await tokenService.issuePair({
      sub: user.id,
      actorType: 'user',
      organizationId: org.id,
      role: user.role.name as 'ORG_ADMIN' | 'MANAGER' | 'INSTRUCTOR' | 'EMPLOYEE',
      userAgent: input.userAgent,
      ip: input.ip,
    });
    return {
      user: toUserDto(user),
      organization: toOrganizationDto(org),
      tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn },
    };
  }

  async platformLogin(emailOrInput: string | { email: string; password: string; userAgent?: string | null; ip?: string | null }, password?: string) {
    const input =
      typeof emailOrInput === 'string'
        ? { email: emailOrInput, password: password ?? '' }
        : emailOrInput;
    const email = input.email.trim().toLowerCase();
    await loginLockoutRepository.assertNotLocked(PLATFORM_LOCKOUT_ORG_ID, email);
    const admin = await platformAdminRepository.findByEmail(email);
    if (!admin) {
      await passwordService.dummyCompare(input.password);
      await loginLockoutRepository.recordFailure(PLATFORM_LOCKOUT_ORG_ID, email);
      throw AppError.from('AUTH_INVALID_CREDENTIALS');
    }
    if (admin.status !== 'ACTIVE') throw AppError.from('AUTH_ACCOUNT_SUSPENDED');
    const ok = await passwordService.verify(input.password, admin.passwordHash);
    if (!ok) {
      await loginLockoutRepository.recordFailure(PLATFORM_LOCKOUT_ORG_ID, email);
      throw AppError.from('AUTH_INVALID_CREDENTIALS');
    }
    await loginLockoutRepository.clear(PLATFORM_LOCKOUT_ORG_ID, email);
    if (admin.mfaEnabled && admin.mfaSecret) {
      const mfaToken = await this.issueOneTimeToken({
        platformAdminId: admin.id,
        purpose: 'MFA_LOGIN',
        ttlMs: MFA_LOGIN_TTL_MS,
      });
      return { mfaRequired: true, mfaToken };
    }
    const tokens = await tokenService.issuePair({
      sub: admin.id,
      actorType: 'platform',
      organizationId: null,
      role: 'SUPER_ADMIN',
      userAgent: 'userAgent' in input ? input.userAgent : undefined,
      ip: 'ip' in input ? input.ip : undefined,
    });
    return {
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
      tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn },
    };
  }

  async refresh(refreshToken: string, meta?: { userAgent?: string | null; ip?: string | null }) {
    return tokenService.rotate(refreshToken, meta ?? {});
  }

  async logout(auth: AuthPrincipal | null, refreshToken?: string) {
    if (refreshToken) {
      const hash = tokenService.hashRaw(refreshToken);
      const row = await prisma.refreshToken.findFirst({ where: { tokenHash: hash } });
      if (row) {
        await tokenService.revokeFamily(row.familyId);
        const actorType =
          row.actorType === 'platform' || row.actorType === 'system' || row.actorType === 'user'
            ? row.actorType
            : (auth?.actorType ?? 'user');
        await auditService.record({
          organizationId: auth?.organizationId ?? null,
          actorType,
          actorId: row.userId ?? row.platformAdminId ?? auth?.sub ?? 'unknown',
          action: 'AUTH_LOGOUT',
          resourceType: 'User',
          resourceId: row.userId ?? row.platformAdminId ?? auth?.sub ?? undefined,
        });
        return { loggedOut: true };
      }
    }
    if (auth) {
      await tokenService.revokeFamily(auth.tokenFamilyId);
      await auditService.record({
        organizationId: auth.organizationId,
        actorType: auth.actorType,
        actorId: auth.sub,
        action: 'AUTH_LOGOUT',
        resourceType: 'User',
        resourceId: auth.sub,
      });
    }
    return { loggedOut: true };
  }

  async me(auth: AuthPrincipal) {
    if (auth.actorType === 'platform') {
      const admin = await platformAdminRepository.findById(auth.sub);
      if (!admin) throw AppError.from('AUTH_PRINCIPAL_INVALID');
      return {
        type: 'platform' as const,
        admin: {
          id: admin.id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          mfaEnabled: admin.mfaEnabled,
        },
        permissions: auth.permissions,
      };
    }
    if (!auth.organizationId) throw AppError.from('AUTH_PRINCIPAL_INVALID');
    const user = await userRepository.findByIdAndOrg(auth.sub, auth.organizationId);
    if (!user) throw AppError.from('AUTH_PRINCIPAL_INVALID');
    return {
      type: 'user' as const,
      user: toUserDto(user),
      organization: toOrganizationDto(user.organization),
      permissions: auth.permissions,
    };
  }

  async updateMe(auth: AuthPrincipal, body: { firstName?: string; lastName?: string; avatarUrl?: string | null }) {
    if (auth.actorType !== 'user' || !auth.organizationId) throw AppError.from('RBAC_FORBIDDEN');
    const updated = await userRepository.update(auth.organizationId, auth.sub, {
      ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
      ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
    });
    if (!updated) throw AppError.from('NOT_FOUND');
    return toUserDto(updated);
  }

  async uploadAvatar(auth: AuthPrincipal, filename: string, buffer: Buffer) {
    if (auth.actorType !== 'user' || !auth.organizationId) throw AppError.from('RBAC_FORBIDDEN');
    const avatarUrl = await saveAvatar(auth.organizationId, auth.sub, filename, buffer);
    const updated = await userRepository.update(auth.organizationId, auth.sub, { avatarUrl });
    if (!updated) throw AppError.from('NOT_FOUND');
    return { avatarUrl, user: toUserDto(updated) };
  }

  async changePassword(
    auth: AuthPrincipal,
    body: { currentPassword: string; newPassword: string; revokeOthers?: boolean },
  ) {
    if (auth.actorType !== 'user' || !auth.organizationId) throw AppError.from('RBAC_FORBIDDEN');
    const user = await userRepository.getById(auth.organizationId, auth.sub);
    if (!user) throw AppError.from('NOT_FOUND');
    const ok = await passwordService.verify(body.currentPassword, user.passwordHash);
    if (!ok) throw AppError.from('AUTH_INVALID_CREDENTIALS');
    passwordService.assertPolicy(body.newPassword, { email: user.email });
    const passwordHash = await passwordService.hash(body.newPassword);
    await userRepository.updatePassword(auth.organizationId, auth.sub, passwordHash);
    await tokenService.revokeAllForPrincipal('user', auth.sub);
    return { changed: true };
  }

  async completeMfaLogin(
    mfaToken: string,
    code: string,
    meta?: { userAgent?: string | null; ip?: string | null },
  ) {
    const row = await this.requireOneTimeToken(mfaToken, 'MFA_LOGIN');
    if (row.platformAdminId) {
      const admin = await platformAdminRepository.findById(row.platformAdminId);
      if (!admin?.mfaSecret || !admin.mfaEnabled) throw AppError.from('AUTH_TOKEN_INVALID');
      if (!(await mfaService.verifyCode(admin.mfaSecret, code))) {
        throw AppError.from('VALIDATION_ERROR', 'Invalid verification code.');
      }
      const tokens = await tokenService.issuePair({
        sub: admin.id,
        actorType: 'platform',
        organizationId: null,
        role: 'SUPER_ADMIN',
        userAgent: meta?.userAgent,
        ip: meta?.ip,
      });
      return {
        admin: {
          id: admin.id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
        },
        tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn },
      };
    }
    if (!row.userId || !row.organizationId) throw AppError.from('AUTH_TOKEN_INVALID');
    const user = await userRepository.getById(row.organizationId, row.userId);
    const org = await organizationRepository.findById(row.organizationId);
    if (!user || !org || !user.mfaSecret || !user.mfaEnabled) {
      throw AppError.from('AUTH_TOKEN_INVALID');
    }
    if (!(await mfaService.verifyCode(user.mfaSecret, code))) {
      throw AppError.from('VALIDATION_ERROR', 'Invalid verification code.');
    }
    await userRepository.update(org.id, user.id, { lastLoginAt: new Date() });
    loginEventService.recordLogin({
      organizationId: org.id,
      userId: user.id,
      method: 'mfa',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    const tokens = await tokenService.issuePair({
      sub: user.id,
      actorType: 'user',
      organizationId: org.id,
      role: user.role.name as 'ORG_ADMIN' | 'MANAGER' | 'INSTRUCTOR' | 'EMPLOYEE',
      userAgent: meta?.userAgent,
      ip: meta?.ip,
    });
    return {
      user: toUserDto(user),
      organization: toOrganizationDto(org),
      tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn },
    };
  }

  async forgotPassword(email: string, organizationSlug: string) {
    const org = await organizationRepository.findBySlug(organizationSlug.toLowerCase());
    if (org) {
      const user = await userRepository.findByEmail(org.id, email.trim().toLowerCase());
      if (user && user.status === 'ACTIVE') {
        const token = await this.createPasswordResetToken(org.id, user.id);
        const url = `${env.PUBLIC_WEB_URL}/reset-password?token=${encodeURIComponent(token)}`;
        await mailService.sendPasswordReset(user.email, url);
      }
    }
    return { sent: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const row = await this.requireOneTimeToken(token, 'PASSWORD_RESET');
    if (!row.userId || !row.organizationId) throw AppError.from('AUTH_TOKEN_INVALID');
    const user = await userRepository.getById(row.organizationId, row.userId);
    if (!user) throw AppError.from('NOT_FOUND');
    passwordService.assertPolicy(newPassword, { email: user.email });
    await userRepository.updatePassword(row.organizationId, row.userId, await passwordService.hash(newPassword));
    await tokenService.revokeAllForPrincipal('user', row.userId);
    return { reset: true };
  }

  async acceptInvite(body: { token: string; password: string; firstName: string; lastName: string }) {
    const row = await this.requireOneTimeToken(body.token, 'INVITE');
    if (!row.userId || !row.organizationId) throw AppError.from('AUTH_TOKEN_INVALID');
    const user = await userRepository.getById(row.organizationId, row.userId);
    if (!user) throw AppError.from('NOT_FOUND');
    passwordService.assertPolicy(body.password, { email: user.email });
    const org = await organizationRepository.findById(row.organizationId);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
    const updated = await userRepository.update(row.organizationId, row.userId, {
      passwordHash: await passwordService.hash(body.password),
      firstName: body.firstName,
      lastName: body.lastName,
      status: 'ACTIVE',
    });
    const tokens = await tokenService.issuePair({
      sub: user.id,
      actorType: 'user',
      organizationId: row.organizationId,
      role: user.role.name as 'ORG_ADMIN' | 'MANAGER' | 'INSTRUCTOR' | 'EMPLOYEE',
    });
    return {
      user: toUserDto(updated!),
      organization: toOrganizationDto(org),
      tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn },
    };
  }

  async createInviteToken(organizationId: string, userId: string): Promise<string> {
    return this.issueOneTimeToken({ organizationId, userId, purpose: 'INVITE', ttlMs: INVITE_TTL_MS });
  }

  async storeInviteToken(userId: string, organizationId: string): Promise<string> {
    return this.issueOneTimeToken({ organizationId, userId, purpose: 'INVITE', ttlMs: INVITE_TTL_MS });
  }

  clearLock(organizationId: string, email: string): void {
    void loginLockoutRepository.clear(organizationId, email);
  }

  private async createPasswordResetToken(organizationId: string, userId: string): Promise<string> {
    return this.issueOneTimeToken({ organizationId, userId, purpose: 'PASSWORD_RESET', ttlMs: RESET_TTL_MS });
  }

  private async issueOneTimeToken(input: {
    organizationId?: string;
    userId?: string;
    platformAdminId?: string;
    purpose: OneTimePurpose;
    ttlMs: number;
  }): Promise<string> {
    const token = randomToken(32);
    await this.persistOneTimeToken(token, input);
    return token;
  }

  private persistOneTimeToken(
    token: string,
    input: {
      organizationId?: string;
      userId?: string;
      platformAdminId?: string;
      purpose: OneTimePurpose;
      ttlMs: number;
    },
  ) {
    return prisma.oneTimeToken.create({
      data: {
        organizationId: input.organizationId || null,
        userId: input.userId || null,
        platformAdminId: input.platformAdminId || null,
        purpose: input.purpose,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + input.ttlMs),
      },
    });
  }

  private async requireOneTimeToken(token: string, purpose: OneTimePurpose) {
    const row = await oneTimeTokenRepository.consume(sha256(token), purpose);
    if (!row) throw AppError.from('AUTH_TOKEN_INVALID');
    return row;
  }
}

void (0 as Prisma.JsonValue | undefined);
export const authService = new AuthService();
export const storeInviteToken = (userId: string, organizationId: string) =>
  authService.storeInviteToken(userId, organizationId);
