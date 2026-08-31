import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class CoursePrerequisiteRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new CoursePrerequisiteRepository(tx);
  }

  listByCourse(organizationId: string, courseId: string) {
    return this.db.coursePrerequisite.findMany({
      where: { organizationId, courseId },
      include: {
        prerequisiteCourse: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  listPrerequisiteMap(organizationId: string) {
    return this.db.coursePrerequisite.findMany({
      where: { organizationId },
      select: { courseId: true, prerequisiteCourseId: true },
    });
  }

  async replace(
    organizationId: string,
    courseId: string,
    prerequisiteCourseIds: string[],
  ) {
    const uniqueIds = [...new Set(prerequisiteCourseIds)];
    await this.db.coursePrerequisite.deleteMany({ where: { organizationId, courseId } });
    if (uniqueIds.length) {
      await this.db.coursePrerequisite.createMany({
        data: uniqueIds.map((prerequisiteCourseId) => ({
          organizationId,
          courseId,
          prerequisiteCourseId,
        })),
      });
    }
    return this.listByCourse(organizationId, courseId);
  }
}

export const coursePrerequisiteRepository = new CoursePrerequisiteRepository();
