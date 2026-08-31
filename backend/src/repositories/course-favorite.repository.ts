import { prisma, type DbClient } from '../lib/prisma';

export class CourseFavoriteRepository {
  constructor(private db: DbClient = prisma) {}

  listCourseIds(organizationId: string, userId: string) {
    return this.db.courseFavorite
      .findMany({
        where: { organizationId, userId },
        select: { courseId: true },
      })
      .then((rows) => rows.map((row) => row.courseId));
  }

  isFavorite(organizationId: string, userId: string, courseId: string) {
    return this.db.courseFavorite
      .findFirst({
        where: { organizationId, userId, courseId },
        select: { id: true },
      })
      .then((row) => !!row);
  }

  add(organizationId: string, userId: string, courseId: string) {
    return this.db.courseFavorite.create({
      data: { organizationId, userId, courseId },
    });
  }

  remove(organizationId: string, userId: string, courseId: string) {
    return this.db.courseFavorite.deleteMany({
      where: { organizationId, userId, courseId },
    });
  }
}

export const courseFavoriteRepository = new CourseFavoriteRepository();
