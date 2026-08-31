import { prisma, type DbClient } from '../lib/prisma';

export class PlatformAdminRepository {
  constructor(private db: DbClient = prisma) {}

  findByEmail(email: string) {
    return this.db.platformAdmin.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string) {
    return this.db.platformAdmin.findUnique({ where: { id } });
  }

  update(id: string, data: { mfaEnabled?: boolean; mfaSecret?: string | null; mfaSecretPending?: string | null }) {
    return this.db.platformAdmin.update({ where: { id }, data });
  }
}

export const platformAdminRepository = new PlatformAdminRepository();
