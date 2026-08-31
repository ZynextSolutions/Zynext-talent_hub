import type { Prisma, ReportFormat, ReportScheduleFrequency } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class ScheduledReportRepository {
  constructor(private db: DbClient = prisma) {}

  list(organizationId: string) {
    return this.db.scheduledReport.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  findById(organizationId: string, id: string) {
    return this.db.scheduledReport.findFirst({
      where: { id, organizationId },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  create(data: {
    organizationId: string;
    createdByUserId?: string | null;
    reportType: string;
    filters: Prisma.InputJsonValue;
    format: ReportFormat;
    frequency: ReportScheduleFrequency;
    recipients: string[];
    nextRunAt: Date;
  }) {
    return this.db.scheduledReport.create({ data });
  }

  update(
    organizationId: string,
    id: string,
    data: Prisma.ScheduledReportUpdateInput,
  ) {
    return this.db.scheduledReport.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  delete(organizationId: string, id: string) {
    return this.db.scheduledReport.deleteMany({ where: { id, organizationId } });
  }

  dueSchedules(now: Date, organizationId?: string) {
    return this.db.scheduledReport.findMany({
      where: {
        enabled: true,
        ...(organizationId ? { organizationId } : {}),
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });
  }

  markRun(id: string, lastRunAt: Date, nextRunAt: Date) {
    return this.db.scheduledReport.update({
      where: { id },
      data: { lastRunAt, nextRunAt },
    });
  }
}

export const scheduledReportRepository = new ScheduledReportRepository();
