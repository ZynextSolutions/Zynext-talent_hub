import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';
import { computeEnrollmentProgress } from '../lib/completion';

export class ProgressRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new ProgressRepository(tx);
  }

  find(enrollmentId: string, lessonId: string) {
    return this.db.progress.findUnique({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    });
  }

  listByEnrollment(enrollmentId: string) {
    return this.db.progress.findMany({ where: { enrollmentId } });
  }

  upsert(
    enrollmentId: string,
    lessonId: string,
    data: {
      completed: boolean;
      percentage: number;
      positionSeconds?: number;
      watchedSeconds?: number;
      openedAt?: Date | null;
      completedAt?: Date | null;
    },
  ) {
    return this.db.progress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      create: {
        enrollmentId,
        lessonId,
        completed: data.completed,
        percentage: data.percentage,
        positionSeconds: data.positionSeconds ?? 0,
        watchedSeconds: data.watchedSeconds ?? 0,
        openedAt: data.openedAt ?? null,
        completedAt: data.completedAt ?? null,
      },
      update: {
        completed: data.completed,
        percentage: data.percentage,
        ...(data.positionSeconds !== undefined ? { positionSeconds: data.positionSeconds } : {}),
        ...(data.watchedSeconds !== undefined ? { watchedSeconds: data.watchedSeconds } : {}),
        ...(data.openedAt !== undefined ? { openedAt: data.openedAt } : {}),
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
      },
    });
  }

  countCompleted(enrollmentId: string) {
    return this.db.progress.count({ where: { enrollmentId, completed: true } });
  }

  findLesson(enrollmentId: string, lessonId: string) {
    return this.find(enrollmentId, lessonId);
  }

  upsertLesson(
    enrollmentId: string,
    lessonId: string,
    data: {
      completed: boolean;
      percentage: number;
      positionSeconds?: number;
      watchedSeconds?: number;
      openedAt?: Date | null;
      completedAt?: Date | null;
    },
  ) {
    return this.upsert(enrollmentId, lessonId, data);
  }

  async recalcEnrollmentPercents(organizationId: string, courseId: string) {
    const course = await this.db.course.findFirst({ where: { id: courseId, organizationId } });
    const lessons = await this.db.lesson.findMany({ where: { organizationId, courseId } });
    const enrollments = await this.db.enrollment.findMany({
      where: { organizationId, courseId, status: { not: 'REVOKED' } },
      select: { id: true, status: true },
    });
    for (const enrollment of enrollments) {
      const progressRows = await this.listByEnrollment(enrollment.id);
      const completedIds = new Set(
        progressRows.filter((entry) => entry.completed).map((entry) => entry.lessonId),
      );
      const progressPct = course
        ? computeEnrollmentProgress(course.completionMode, course.completionPercent, lessons, completedIds)
        : 0;
      await this.db.enrollment.update({
        where: { id: enrollment.id },
        data: {
          progressPct,
          ...(enrollment.status === 'COMPLETED' && progressPct < 100
            ? { status: 'IN_PROGRESS' as const, completedAt: null }
            : {}),
        },
      });
    }
  }
}

export const progressRepository = new ProgressRepository();
