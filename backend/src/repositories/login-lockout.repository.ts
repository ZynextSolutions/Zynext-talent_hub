import { AppError } from '../errors/app-error';
import { LOGIN_MAX_FAILURES } from '../config/constants';
import { prisma, type DbClient } from '../lib/prisma';

const LOCK_MS = 15 * 60 * 1000;

class LoginLockoutRepository {
  constructor(private db: DbClient = prisma) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async assertNotLocked(organizationId: string, email: string): Promise<void> {
    const row = await this.db.loginLockout.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email: this.normalizeEmail(email),
        },
      },
    });
    if (row?.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
      throw AppError.from('AUTH_ACCOUNT_LOCKED');
    }
  }

  async recordFailure(organizationId: string, email: string): Promise<void> {
    const normalized = this.normalizeEmail(email);
    const existing = await this.db.loginLockout.findUnique({
      where: { organizationId_email: { organizationId, email: normalized } },
    });
    const failCount = (existing?.failCount ?? 0) + 1;
    const lockedUntil =
      failCount >= LOGIN_MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null;
    await this.db.loginLockout.upsert({
      where: { organizationId_email: { organizationId, email: normalized } },
      create: {
        organizationId,
        email: normalized,
        failCount,
        lockedUntil,
      },
      update: { failCount, lockedUntil },
    });
  }

  async clear(organizationId: string, email: string): Promise<void> {
    await this.db.loginLockout.deleteMany({
      where: { organizationId, email: this.normalizeEmail(email) },
    });
  }
}

export const loginLockoutRepository = new LoginLockoutRepository();
