import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class RefreshTokenRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new RefreshTokenRepository(tx);
  }

  create(data: Prisma.RefreshTokenCreateInput) {
    return this.db.refreshToken.create({ data });
  }

  findByHash(tokenHash: string) {
    return this.db.refreshToken.findFirst({ where: { tokenHash } });
  }

  markUsed(id: string, usedAt?: Date) {
    return this.db.refreshToken.update({
      where: { id },
      data: { usedAt: usedAt ?? new Date() },
    });
  }

  revokeFamily(familyId: string, revokedAt?: Date) {
    const now = revokedAt ?? new Date();
    return this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { usedAt: now, revokedAt: now },
    });
  }

  revokeAllForUser(userId: string, revokedAt?: Date, exceptFamilyId?: string) {
    const now = revokedAt ?? new Date();
    return this.db.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptFamilyId ? { familyId: { not: exceptFamilyId } } : {}),
      },
      data: { usedAt: now, revokedAt: now },
    });
  }

  revokeAllForPlatformAdmin(platformAdminId: string, revokedAt?: Date, exceptFamilyId?: string) {
    const now = revokedAt ?? new Date();
    return this.db.refreshToken.updateMany({
      where: {
        platformAdminId,
        revokedAt: null,
        ...(exceptFamilyId ? { familyId: { not: exceptFamilyId } } : {}),
      },
      data: { usedAt: now, revokedAt: now },
    });
  }

  revokeOtherFamilies(userId: string, keepFamilyId: string) {
    return this.db.refreshToken.updateMany({
      where: { userId, familyId: { not: keepFamilyId }, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
