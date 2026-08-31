import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class AnnouncementRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new AnnouncementRepository(tx);
  }

  create(data: Prisma.AnnouncementUncheckedCreateInput) {
    return this.db.announcement.create({ data });
  }

  findById(organizationId: string, id: string) {
    return this.db.announcement.findFirst({
      where: { id, organizationId },
      include: { course: { select: { id: true, title: true } } },
    });
  }

  update(organizationId: string, id: string, data: Prisma.AnnouncementUncheckedUpdateInput) {
    return this.db.announcement.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  delete(organizationId: string, id: string) {
    return this.db.announcement.deleteMany({ where: { id, organizationId } });
  }

  list(
    organizationId: string,
    params: { skip: number; take: number; courseId?: string },
  ) {
    return this.db.announcement.findMany({
      where: {
        organizationId,
        ...(params.courseId !== undefined ? { courseId: params.courseId } : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: params.skip,
      take: params.take,
      include: { course: { select: { id: true, title: true } } },
    });
  }

  count(organizationId: string, courseId?: string) {
    return this.db.announcement.count({
      where: {
        organizationId,
        ...(courseId !== undefined ? { courseId } : {}),
      },
    });
  }

  listActive(organizationId: string, enrolledCourseIds: string[], now: Date) {
    return this.db.announcement.findMany({
      where: {
        organizationId,
        OR: [{ courseId: null }, { courseId: { in: enrolledCourseIds } }],
        AND: [
          { OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
      include: { course: { select: { id: true, title: true } } },
    });
  }
}

export const announcementRepository = new AnnouncementRepository();
