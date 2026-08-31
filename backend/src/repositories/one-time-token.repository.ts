import type { OneTimeTokenPurpose, Prisma } from '@prisma/client';
import { prisma, type DbClient } from './prisma';
import { consumeWhere } from '../lib/one-time-token';

export class OneTimeTokenRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient): OneTimeTokenRepository {
    return new OneTimeTokenRepository(tx);
  }

  create(data: Prisma.OneTimeTokenUncheckedCreateInput) {
    return this.db.oneTimeToken.create({ data });
  }

  findValid(tokenHash: string, purpose: OneTimeTokenPurpose) {
    return this.db.oneTimeToken.findFirst({
      where: {
        tokenHash,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async consume(tokenHash: string, purpose: OneTimeTokenPurpose) {
    const now = new Date();
    const result = await this.db.oneTimeToken.updateMany({
      where: consumeWhere(tokenHash, purpose, now),
      data: { usedAt: now },
    });
    if (result.count === 0) return null;
    return this.db.oneTimeToken.findFirst({ where: { tokenHash, purpose } });
  }

  markUsed(id: string, usedAt: Date) {
    return this.db.oneTimeToken.update({ where: { id }, data: { usedAt } });
  }
}

export const oneTimeTokenRepository = new OneTimeTokenRepository();
