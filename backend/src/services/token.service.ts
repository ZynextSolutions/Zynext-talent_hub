import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { clock } from '../lib/clock';
import { sha256, newId, randomToken } from '../lib/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { refreshTokenRepository } from '../repositories/refresh-token.repository';
import { prisma } from '../repositories/prisma';
import { auditService } from './audit.service';
import type { ActorType } from '../types/auth';
import type { RoleName } from '../domain/roles';
import type { TokenBundle } from '../types/dto';
import { Prisma } from '@prisma/client';

class TokenService {
  async issuePair(input: {
    sub: string;
    actorType: ActorType;
    organizationId: string | null;
    role: RoleName | 'SUPER_ADMIN';
    familyId?: string;
    userAgent?: string | null;
    ip?: string | null;
    tx?: Prisma.TransactionClient;
  }): Promise<TokenBundle & { familyId: string }> {
    const familyId = input.familyId ?? newId();
    const accessJti = newId();
    const refreshJti = newId();
    const accessToken = signAccessToken({
      sub: input.sub,
      actorType: input.actorType,
      organizationId: input.organizationId,
      role: input.role,
      typ: 'access',
      fam: familyId,
      jti: accessJti,
    });
    const refreshToken = signRefreshToken({
      sub: input.sub,
      actorType: input.actorType,
      typ: 'refresh',
      fam: familyId,
      jti: refreshJti,
    });
    const expiresAt = new Date(clock.now().getTime() + env.JWT_REFRESH_TTL_SEC * 1000);
    const repo = input.tx ? refreshTokenRepository.withTx(input.tx) : refreshTokenRepository;
    await repo.create({
      tokenHash: sha256(refreshToken),
      familyId,
      actorType: input.actorType,
      expiresAt,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
      ...(input.actorType === 'platform'
        ? { platformAdmin: { connect: { id: input.sub } } }
        : { user: { connect: { id: input.sub } } }),
    });
    return { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL_SEC, familyId };
  }

  async rotate(rawRefresh: string, meta: { userAgent?: string | null; ip?: string | null }): Promise<TokenBundle> {
    const payload = verifyRefreshToken(rawRefresh);
    const hash = sha256(rawRefresh);

    return prisma.$transaction(async (tx) => {
      const repo = refreshTokenRepository.withTx(tx);
      const row = await repo.findByHash(hash);
      if (!row) throw AppError.from('AUTH_REFRESH_INVALID');
      if (row.revokedAt) throw AppError.from('AUTH_REFRESH_INVALID');
      if (row.expiresAt.getTime() <= clock.now().getTime()) throw AppError.from('AUTH_REFRESH_EXPIRED');

      if (row.usedAt) {
        await repo.revokeFamily(row.familyId, clock.now());
        await auditService.record({
          actorType: (row.actorType as ActorType) ?? 'user',
          actorId: row.userId ?? row.platformAdminId ?? payload.sub,
          action: 'TOKEN_REUSE_DETECTED',
          resourceType: 'RefreshToken',
          resourceId: row.familyId,
        });
        throw AppError.from('AUTH_REFRESH_REUSE');
      }

      await repo.markUsed(row.id, clock.now());

      const actorType = (row.actorType as ActorType) || payload.actorType;
      const sub = row.userId ?? row.platformAdminId ?? payload.sub;
      const userRow =
        actorType === 'user' && row.userId
          ? await tx.user.findUnique({
              where: { id: row.userId },
              select: {
                organizationId: true,
                status: true,
                role: { select: { name: true } },
                organization: { select: { status: true } },
              },
            })
          : null;

      if (actorType === 'user') {
        if (!userRow) throw AppError.from('AUTH_REFRESH_INVALID');
        if (userRow.organization.status === 'SUSPENDED') {
          throw AppError.from('AUTH_ORG_SUSPENDED');
        }
        if (userRow.status !== 'ACTIVE') throw AppError.from('AUTH_ACCOUNT_SUSPENDED');
      }

      const pair = await this.issuePair({
        sub,
        actorType,
        organizationId: userRow?.organizationId ?? null,
        role: actorType === 'platform' ? 'SUPER_ADMIN' : (userRow?.role.name as RoleName),
        familyId: row.familyId,
        userAgent: meta.userAgent,
        ip: meta.ip,
        tx,
      });
      return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, expiresIn: pair.expiresIn };
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await refreshTokenRepository.revokeFamily(familyId, clock.now());
  }

  async revokeAllForPrincipal(
    actorType: ActorType,
    id: string,
    exceptFamilyId?: string,
  ): Promise<void> {
    const now = clock.now();
    if (actorType === 'platform') {
      await refreshTokenRepository.revokeAllForPlatformAdmin(id, now, exceptFamilyId);
    } else {
      await refreshTokenRepository.revokeAllForUser(id, now, exceptFamilyId);
    }
  }

  hashRaw(token: string): string {
    return sha256(token);
  }

  randomInviteToken(): string {
    return randomToken(32);
  }
}

export const tokenService = new TokenService();
