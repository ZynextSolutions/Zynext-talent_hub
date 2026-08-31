import type { OneTimeTokenPurpose } from '@prisma/client';

export function consumeWhere(tokenHash: string, purpose: OneTimeTokenPurpose, now: Date) {
  return {
    tokenHash,
    purpose,
    usedAt: null,
    expiresAt: { gt: now },
  };
}
