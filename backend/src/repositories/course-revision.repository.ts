import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class CourseRevisionRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new CourseRevisionRepository(tx);
  }

  nextVersionNumber(courseId: string) {
    return this.db.courseRevision
      .aggregate({
        where: { courseId },
        _max: { versionNumber: true },
      })
      .then((row) => (row._max.versionNumber ?? 0) + 1);
  }

  create(data: Prisma.CourseRevisionUncheckedCreateInput) {
    return this.db.courseRevision.create({ data });
  }

  listByCourse(organizationId: string, courseId: string) {
    return this.db.courseRevision.findMany({
      where: { courseId, organizationId },
      orderBy: { versionNumber: 'desc' },
      include: {
        publishedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  getById(organizationId: string, courseId: string, revisionId: string) {
    return this.db.courseRevision.findFirst({
      where: { id: revisionId, courseId, organizationId },
      include: {
        publishedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}

export const courseRevisionRepository = new CourseRevisionRepository();
