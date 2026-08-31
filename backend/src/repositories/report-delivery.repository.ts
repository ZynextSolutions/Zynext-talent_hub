import type { Prisma } from '@prisma/client';
import { Prisma as PrismaNS } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class ReportDeliveryRepository {
  constructor(private db: DbClient = prisma) {}

  async tryClaim(input: {
    scheduledReportId: string;
    organizationId: string;
    sentOnDate: Date;
    status: string;
    filePath?: string | null;
    errorMessage?: string | null;
  }): Promise<boolean> {
    try {
      await this.db.reportDelivery.create({
        data: {
          scheduledReportId: input.scheduledReportId,
          organizationId: input.organizationId,
          sentOnDate: input.sentOnDate,
          status: input.status,
          filePath: input.filePath ?? null,
          errorMessage: input.errorMessage ?? null,
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

  update(
    scheduledReportId: string,
    sentOnDate: Date,
    data: Prisma.ReportDeliveryUpdateInput,
  ) {
    return this.db.reportDelivery.update({
      where: {
        scheduledReportId_sentOnDate: { scheduledReportId, sentOnDate },
      },
      data,
    });
  }
}

export const reportDeliveryRepository = new ReportDeliveryRepository();
