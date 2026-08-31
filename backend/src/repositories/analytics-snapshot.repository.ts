import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

class AnalyticsSnapshotRepository {
  upsert(organizationId: string, date: Date, metrics: Prisma.InputJsonValue) {
    const day = startOfUtcDay(date);
    return prisma.analyticsDailySnapshot.upsert({
      where: { organizationId_date: { organizationId, date: day } },
      create: { organizationId, date: day, metrics },
      update: { metrics },
    });
  }

  listRecent(organizationId: string, limit = 30) {
    return prisma.analyticsDailySnapshot.findMany({
      where: { organizationId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }
}

export const analyticsSnapshotRepository = new AnalyticsSnapshotRepository();
