import type { Prisma } from '@prisma/client';
import { Prisma as PrismaNS } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class ReminderDeliveryRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new ReminderDeliveryRepository(tx);
  }

  async tryClaim(input: {
    organizationId: string;
    userId: string;
    enrollmentId: string;
    channel: string;
    kind: string;
    sentOnDate: Date;
  }): Promise<boolean> {
    try {
      await this.db.reminderDelivery.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          enrollmentId: input.enrollmentId,
          channel: input.channel,
          kind: input.kind,
          sentOnDate: input.sentOnDate,
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof PrismaNS.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }
}

export const reminderDeliveryRepository = new ReminderDeliveryRepository();
