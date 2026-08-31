import type { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { prisma } from '../repositories/prisma';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { lessonRepository } from '../repositories/lesson.repository';
import { progressRepository } from '../repositories/progress.repository';
import { courseRepository } from '../repositories/course.repository';
import { toEnrollmentDto, toProgressDto } from '../lib/mappers';
import { certificateService } from './certificate.service';
import { skillService } from './skill.service';
import { xapiService } from './xapi.service';
import { integrationsService } from './integrations.service';
import { computeEnrollmentProgress, isEnrollmentComplete } from '../lib/completion';
import { assertCourseAvailableNow } from '../lib/course-availability';
import { assertLessonPrerequisiteMet } from '../lib/course-prerequisites';
import { assertPreAssessmentPassed } from '../lib/pre-assessment-gate';
import type { AuthPrincipal } from '../types/auth';
import { accumulateWatchedSeconds } from '../lib/learning-time';
import { learnerMayCompleteLesson } from '../lib/lesson-completion';
import { env } from '../config/env';
import { clock } from '../lib/clock';

type EnrollmentRow = NonNullable<Awaited<ReturnType<typeof enrollmentRepository.getById>>>;

class ProgressService {
  async upsertLesson(
    organizationId: string,
    enrollmentId: string,
    lessonId: string,
    actor: AuthPrincipal,
    body: { completed?: boolean; positionSeconds?: number },
  ) {
    const enrollment = await enrollmentRepository.getById(organizationId, enrollmentId);
    if (!enrollment) throw AppError.from('NOT_FOUND');
    if (enrollment.userId !== actor.sub) throw AppError.from('RBAC_FORBIDDEN');
    if (enrollment.status === 'REVOKED') throw AppError.from('RBAC_FORBIDDEN');

    const accessCourse = await courseRepository.getById(organizationId, enrollment.courseId);
    if (accessCourse) assertCourseAvailableNow(accessCourse);

    const lesson = await lessonRepository.getById(organizationId, lessonId);
    if (!lesson || lesson.courseId !== enrollment.courseId) throw AppError.from('NOT_FOUND');

    const progressRows = await progressRepository.listByEnrollment(enrollmentId);
    const completedLessonIds = new Set(
      progressRows.filter((entry) => entry.completed).map((entry) => entry.lessonId),
    );
    assertLessonPrerequisiteMet(lesson, completedLessonIds);
    await assertPreAssessmentPassed(organizationId, enrollment.courseId, actor.sub);

    return prisma.$transaction(async (tx) =>
      this.applyLessonProgress(tx, organizationId, enrollmentId, lessonId, body, enrollment, {
        requestComplete: false,
      }),
    );
  }

  completeLesson(organizationId: string, enrollmentId: string, lessonId: string, actor: AuthPrincipal) {
    return this.upsertLessonComplete(organizationId, enrollmentId, lessonId, actor);
  }

  private async upsertLessonComplete(
    organizationId: string,
    enrollmentId: string,
    lessonId: string,
    actor: AuthPrincipal,
  ) {
    const enrollment = await enrollmentRepository.getById(organizationId, enrollmentId);
    if (!enrollment) throw AppError.from('NOT_FOUND');
    if (enrollment.userId !== actor.sub) throw AppError.from('RBAC_FORBIDDEN');
    if (enrollment.status === 'REVOKED') throw AppError.from('RBAC_FORBIDDEN');

    const accessCourse = await courseRepository.getById(organizationId, enrollment.courseId);
    if (accessCourse) assertCourseAvailableNow(accessCourse);

    const lesson = await lessonRepository.getById(organizationId, lessonId);
    if (!lesson || lesson.courseId !== enrollment.courseId) throw AppError.from('NOT_FOUND');

    const progressRows = await progressRepository.listByEnrollment(enrollmentId);
    const completedLessonIds = new Set(
      progressRows.filter((entry) => entry.completed).map((entry) => entry.lessonId),
    );
    assertLessonPrerequisiteMet(lesson, completedLessonIds);
    await assertPreAssessmentPassed(organizationId, enrollment.courseId, actor.sub);

    return prisma.$transaction(async (tx) =>
      this.applyLessonProgress(tx, organizationId, enrollmentId, lessonId, {}, enrollment, {
        requestComplete: true,
      }),
    );
  }

  /** Used when instructor marks session attendance or quiz completion — skips learner-only RBAC check. */
  async completeLessonByEnrollment(
    organizationId: string,
    enrollmentId: string,
    lessonId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const enrollments = tx ? enrollmentRepository.withTx(tx) : enrollmentRepository;
    const lessons = tx ? lessonRepository.withTx(tx) : lessonRepository;

    const enrollment = await enrollments.getById(organizationId, enrollmentId);
    if (!enrollment || enrollment.status === 'REVOKED') return null;

    const lesson = await lessons.getById(organizationId, lessonId);
    if (!lesson || lesson.courseId !== enrollment.courseId) return null;

    const body = { completed: true };
    if (tx) {
      return this.applyLessonProgress(tx, organizationId, enrollmentId, lessonId, body, enrollment, {
        trustedComplete: true,
      });
    }
    return prisma.$transaction(async (innerTx) =>
      this.applyLessonProgress(innerTx, organizationId, enrollmentId, lessonId, body, enrollment, {
        trustedComplete: true,
      }),
    );
  }

  private async applyLessonProgress(
    tx: Prisma.TransactionClient,
    organizationId: string,
    enrollmentId: string,
    lessonId: string,
    body: { completed?: boolean; positionSeconds?: number },
    enrollment: EnrollmentRow,
    opts: { requestComplete?: boolean; trustedComplete?: boolean } = {},
  ) {
    const lesson = await lessonRepository.withTx(tx).getById(organizationId, lessonId);
    if (!lesson) throw AppError.from('NOT_FOUND');

    const existing = await progressRepository.withTx(tx).findLesson(enrollmentId, lessonId);
    const now = clock.now();
    const prevPosition = existing?.positionSeconds ?? 0;
    const nextPosition =
      body.positionSeconds !== undefined
        ? lesson.durationSeconds != null
          ? Math.min(body.positionSeconds, lesson.durationSeconds)
          : body.positionSeconds
        : prevPosition;
    const watchedSeconds =
      body.positionSeconds !== undefined
        ? accumulateWatchedSeconds(existing?.watchedSeconds ?? 0, prevPosition, nextPosition)
        : (existing?.watchedSeconds ?? 0);

    let completed = Boolean(existing?.completed);
    if (opts.trustedComplete) {
      completed = true;
    } else if (opts.requestComplete) {
      const decision = learnerMayCompleteLesson({
        kind: lesson.kind,
        videoUrl: lesson.videoUrl,
        durationSeconds: lesson.durationSeconds,
        watchedSeconds,
        openedAt: existing?.openedAt ?? null,
        now,
        isProd: env.isProd,
      });
      if (!decision.ok) {
        throw AppError.from('LESSON_COMPLETION_NOT_READY', decision.reason);
      }
      completed = true;
    }

    const openedAt = existing?.openedAt ?? (opts.requestComplete ? existing?.openedAt ?? now : now);

    const row = await progressRepository.withTx(tx).upsertLesson(enrollmentId, lessonId, {
      completed,
      ...(body.positionSeconds !== undefined ? { positionSeconds: nextPosition } : {}),
      watchedSeconds,
      openedAt,
      completedAt: completed ? existing?.completedAt ?? now : null,
      percentage: completed ? 100 : 0,
    });

    if (body.positionSeconds !== undefined && existing) {
      const prevBucket = Math.floor(prevPosition / 60);
      const newBucket = Math.floor(nextPosition / 60);
      if (newBucket > prevBucket) {
        void xapiService.record({
          organizationId,
          userId: enrollment.userId,
          verb: 'progressed',
          objectType: 'lesson',
          objectId: lessonId,
          objectName: (await lessonRepository.withTx(tx).getById(organizationId, lessonId))?.title,
          result: { extensions: { positionSeconds: nextPosition } },
        });
      }
    }

    const course = await courseRepository.withTx(tx).getById(organizationId, enrollment.courseId);
    const lessons = await lessonRepository.withTx(tx).listByCourse(organizationId, enrollment.courseId);
    const progressRows = await progressRepository.withTx(tx).listByEnrollment(enrollmentId);
    const completedIds = new Set(
      progressRows.filter((entry) => entry.completed).map((entry) => entry.lessonId),
    );

    const progressPercent = course
      ? computeEnrollmentProgress(
          course.completionMode,
          course.completionPercent,
          lessons,
          completedIds,
        )
      : 0;

    let status = enrollment.status;
    const launchedNow = status === 'ENROLLED';
    if (status === 'ENROLLED') status = 'IN_PROGRESS';
    const completedNow =
      course &&
      isEnrollmentComplete(course.completionMode, course.completionPercent, lessons, completedIds);
    if (completedNow) status = 'COMPLETED';

    await enrollmentRepository.withTx(tx).update(organizationId, enrollmentId, {
      progressPct: progressPercent,
      status: status === 'COMPLETED' ? 'COMPLETED' : status,
      lastLessonId: lessonId,
      ...(completedNow ? { completedAt: clock.now() } : {}),
    });

    let certificate = null;
    if (completedNow) {
      certificate = await certificateService.issueIfEligible(organizationId, enrollmentId, tx);
      void skillService.onCourseCompleted(organizationId, enrollment.userId, enrollment.courseId);
      void xapiService.record({
        organizationId,
        userId: enrollment.userId,
        verb: 'completed',
        objectType: 'course',
        objectId: enrollment.courseId,
        objectName: course?.title,
      });
      void integrationsService.dispatchWebhook(organizationId, 'enrollment.completed', {
        enrollmentId,
        courseId: enrollment.courseId,
        userId: enrollment.userId,
      });
    } else if (launchedNow) {
      void xapiService.record({
        organizationId,
        userId: enrollment.userId,
        verb: 'launched',
        objectType: 'course',
        objectId: enrollment.courseId,
        objectName: course?.title,
      });
    }

    const updated = await enrollmentRepository.withTx(tx).getById(organizationId, enrollmentId);
    return {
      lessonProgress: toProgressDto(row),
      enrollment: {
        progressPercent,
        status: updated?.status ?? status,
      },
      certificate,
    };
  }
}

export const progressService = new ProgressService();
