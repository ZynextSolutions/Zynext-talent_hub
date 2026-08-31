import type { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { prisma } from '../repositories/prisma';
import { learningPathRepository } from '../repositories/learning-path.repository';
import { pathAssignmentRepository } from '../repositories/path-assignment.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { courseRepository } from '../repositories/course.repository';
import { hierarchyService } from './hierarchy.service';
import {
  toLearningPathDto,
  toPathAssignmentDto,
  toPathCourseDto,
  toPathEnrollmentDto,
} from '../lib/mappers';
import { pathCertificateService } from './path-certificate.service';
import { notificationService } from './notification.service';
import type { AuthPrincipal, DataScope } from '../types/auth';
import type { AssignmentTargetType } from '../domain/assignment-targets';

class LearningPathService {
  private canManagePaths(actor: AuthPrincipal) {
    return actor.permissions.includes('learning-path:write');
  }

  list(organizationId: string, actor: AuthPrincipal, status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') {
    const effectiveStatus = this.canManagePaths(actor) ? status : (status ?? 'PUBLISHED');
    if (!this.canManagePaths(actor) && effectiveStatus !== 'PUBLISHED') {
      return Promise.resolve([]);
    }
    return learningPathRepository.list(organizationId, effectiveStatus).then((rows) =>
      rows.map((r) => toLearningPathDto(r, r._count.courses)),
    );
  }

  async get(organizationId: string, id: string, actor: AuthPrincipal) {
    const row = await learningPathRepository.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    if (!this.canManagePaths(actor) && row.status !== 'PUBLISHED') {
      throw AppError.from('NOT_FOUND');
    }
    return {
      ...toLearningPathDto(row, row._count.courses),
      courses: row.courses.map((c) => toPathCourseDto(c as Parameters<typeof toPathCourseDto>[0])),
    };
  }

  create(organizationId: string, body: { title: string; description?: string }) {
    return learningPathRepository
      .create({ organizationId, title: body.title, description: body.description ?? '' })
      .then((r) => toLearningPathDto(r, r._count.courses));
  }

  async update(
    organizationId: string,
    id: string,
    body: { title?: string; description?: string; status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' },
  ) {
    const row = await learningPathRepository.update(organizationId, id, body);
    return {
      ...toLearningPathDto(row, row._count.courses),
      courses: row.courses.map((c) => toPathCourseDto(c as Parameters<typeof toPathCourseDto>[0])),
    };
  }

  remove(organizationId: string, id: string) {
    return learningPathRepository.delete(organizationId, id);
  }

  async setCourses(
    organizationId: string,
    pathId: string,
    courses: Array<{ courseId: string; orderIndex: number; required?: boolean }>,
    actor: AuthPrincipal,
  ) {
    const path = await learningPathRepository.getById(organizationId, pathId);
    if (!path) throw AppError.from('NOT_FOUND');
    for (const c of courses) {
      const course = await courseRepository.getById(organizationId, c.courseId);
      if (!course) throw AppError.from('NOT_FOUND', `Course ${c.courseId} not found`);
    }
    await learningPathRepository.replaceCourses(
      pathId,
      courses.map((c) => ({ ...c, required: c.required ?? true })),
    );
    return this.get(organizationId, pathId, actor);
  }

  async publish(organizationId: string, id: string) {
    const path = await learningPathRepository.getById(organizationId, id);
    if (!path) throw AppError.from('NOT_FOUND');
    if (!path.courses.length) throw AppError.from('VALIDATION_ERROR', 'Path must have courses');
    return this.update(organizationId, id, { status: 'PUBLISHED' });
  }

  async enroll(organizationId: string, pathId: string, userId: string) {
    const path = await learningPathRepository.getById(organizationId, pathId);
    if (!path) throw AppError.from('NOT_FOUND');
    if (path.status !== 'PUBLISHED') throw AppError.from('PATH_NOT_PUBLISHED');

    const existing = await learningPathRepository.findEnrollment(organizationId, pathId, userId);
    if (existing) return toPathEnrollmentDto(existing);

    const first = path.courses[0];
    if (!first) throw AppError.from('VALIDATION_ERROR', 'Path has no courses');

    return prisma.$transaction(async (tx) => {
      const paths = learningPathRepository.withTx(tx);
      const enrollments = enrollmentRepository.withTx(tx);

      const pathEnrollment = await paths.createEnrollment({
        organizationId,
        pathId,
        userId,
        status: 'IN_PROGRESS',
        progressPct: 0,
      });

      const courseEnrollment = await enrollments.findByUserCourse(organizationId, userId, first.courseId);
      if (!courseEnrollment) {
        await enrollments.create({
          organizationId,
          userId,
          courseId: first.courseId,
          status: 'ENROLLED',
          source: 'PATH',
          pathEnrollmentId: pathEnrollment.id,
          progressPct: 0,
        });
      } else if (courseEnrollment.status === 'REVOKED') {
        await enrollments.update(organizationId, courseEnrollment.id, {
          status: 'ENROLLED',
          source: 'PATH',
          pathEnrollmentId: pathEnrollment.id,
        });
      }

      return toPathEnrollmentDto(pathEnrollment);
    });
  }

  listEnrollments(organizationId: string, pathId: string) {
    return learningPathRepository
      .listEnrollments(organizationId, pathId)
      .then((rows) => rows.map(toPathEnrollmentDto));
  }

  listAssignments(organizationId: string, pathId: string) {
    return pathAssignmentRepository
      .listByPath(organizationId, pathId)
      .then((rows) => rows.map(toPathAssignmentDto));
  }

  async assign(input: {
    organizationId: string;
    pathId: string;
    targetType: AssignmentTargetType;
    targetId: string;
    actor: AuthPrincipal;
    scope?: DataScope;
  }) {
    const path = await learningPathRepository.getById(input.organizationId, input.pathId);
    if (!path) throw AppError.from('NOT_FOUND');
    if (path.status !== 'PUBLISHED') throw AppError.from('PATH_NOT_PUBLISHED');
    if (!path.courses.length) {
      throw AppError.from('VALIDATION_ERROR', 'Path must include at least one course.');
    }

    const meta = await hierarchyService.loadTargetMeta(
      input.organizationId,
      input.targetType,
      input.targetId,
    );
    hierarchyService.assertTargetInScope(input.scope, input.targetType, meta);

    let assignment = await pathAssignmentRepository.findExisting(
      input.organizationId,
      input.pathId,
      input.targetType,
      input.targetId,
    );
    const created = !assignment;
    if (!assignment) {
      assignment = await pathAssignmentRepository.create({
        organizationId: input.organizationId,
        pathId: input.pathId,
        targetType: input.targetType,
        targetId: input.targetId,
        createdByUserId: input.actor.actorType === 'user' ? input.actor.sub : null,
      });
    }

    const users = await hierarchyService.usersUnder(
      input.organizationId,
      input.targetType,
      input.targetId,
    );
    const active = users.filter((user) => user.status === 'ACTIVE' || user.status === 'INVITED');
    let enrolledCount = 0;
    let alreadyEnrolledCount = 0;

    for (const user of active) {
      const existing = await learningPathRepository.findEnrollment(
        input.organizationId,
        input.pathId,
        user.id,
      );
      if (existing) {
        alreadyEnrolledCount += 1;
        continue;
      }
      await this.enroll(input.organizationId, input.pathId, user.id);
      enrolledCount += 1;
    }

    return {
      assignment: toPathAssignmentDto(assignment),
      enrolledCount,
      alreadyEnrolledCount,
      skippedInactiveCount: users.length - active.length,
      created,
    };
  }

  listMyEnrollments(organizationId: string, userId: string) {
    return learningPathRepository
      .listUserEnrollments(organizationId, userId)
      .then((rows) =>
        rows.map((r) => ({
          ...toPathEnrollmentDto(r),
          path: { id: r.path.id, title: r.path.title, status: r.path.status },
        })),
      );
  }

  async getLearnerProgress(
    organizationId: string,
    pathId: string,
    userId: string,
    actor: AuthPrincipal,
  ) {
    const path = await learningPathRepository.getById(organizationId, pathId);
    if (!path) throw AppError.from('NOT_FOUND');
    if (!this.canManagePaths(actor) && path.status !== 'PUBLISHED') {
      throw AppError.from('NOT_FOUND');
    }

    const pathEnrollment = await learningPathRepository.findEnrollment(organizationId, pathId, userId);
    const courseEnrollments = await enrollmentRepository.listByUserCourseIds(organizationId, userId);
    const enrollmentByCourseId = new Map(courseEnrollments.map((row) => [row.courseId, row]));

    const courses = [...path.courses]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((pathCourse) => {
        const enrollment = enrollmentByCourseId.get(pathCourse.courseId);
        let state: 'LOCKED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' = 'LOCKED';
        let progressPercent = 0;

        if (pathEnrollment && enrollment && enrollment.status !== 'REVOKED') {
          progressPercent = Math.floor(enrollment.progressPct);
          if (enrollment.status === 'COMPLETED' || progressPercent >= 100) {
            state = 'COMPLETED';
          } else if (progressPercent > 0 || enrollment.status === 'IN_PROGRESS') {
            state = 'IN_PROGRESS';
          } else {
            state = 'NOT_STARTED';
          }
        }

        return {
          courseId: pathCourse.courseId,
          title: pathCourse.course?.title ?? pathCourse.courseId,
          orderIndex: pathCourse.orderIndex,
          required: pathCourse.required,
          state,
          progressPercent,
          enrollmentId: enrollment?.id ?? null,
        };
      });

    return {
      path: {
        id: path.id,
        title: path.title,
        description: path.description,
        status: path.status,
      },
      pathEnrollment: pathEnrollment ? toPathEnrollmentDto(pathEnrollment) : null,
      courses,
    };
  }

  async onCourseCompleted(
    organizationId: string,
    enrollmentId: string,
    tx: Prisma.TransactionClient,
  ) {
    const enrollment = await enrollmentRepository.withTx(tx).getById(organizationId, enrollmentId);
    if (!enrollment?.pathEnrollmentId) return null;

    const pathEnrollment = await tx.pathEnrollment.findFirst({
      where: { id: enrollment.pathEnrollmentId, organizationId },
      include: {
        path: { include: { courses: { orderBy: { orderIndex: 'asc' } } } },
        courseEnrolls: true,
      },
    });
    if (!pathEnrollment) return null;

    const pathCourses = pathEnrollment.path.courses;
    const requiredCourses = pathCourses.filter((pc) => pc.required);
    const progressDenominator = requiredCourses.length > 0 ? requiredCourses : pathCourses;
    const completedIds = new Set(
      pathEnrollment.courseEnrolls.filter((e) => e.status === 'COMPLETED').map((e) => e.courseId),
    );
    completedIds.add(enrollment.courseId);

    const completedInDenominator = progressDenominator.filter((pc) =>
      completedIds.has(pc.courseId),
    ).length;
    const progressPct =
      progressDenominator.length === 0
        ? 0
        : Math.floor((completedInDenominator / progressDenominator.length) * 100);

    await learningPathRepository.withTx(tx).updateEnrollment(pathEnrollment.id, { progressPct });

    const next = pathCourses.find((pc) => !completedIds.has(pc.courseId));
    if (next) {
      const enrollments = enrollmentRepository.withTx(tx);
      const existing = await enrollments.findByUserCourse(
        organizationId,
        pathEnrollment.userId,
        next.courseId,
      );
      let unlocked = false;
      if (!existing) {
        await enrollments.create({
          organizationId,
          userId: pathEnrollment.userId,
          courseId: next.courseId,
          status: 'ENROLLED',
          source: 'PATH',
          pathEnrollmentId: pathEnrollment.id,
          progressPct: 0,
        });
        unlocked = true;
      } else if (existing.status === 'REVOKED') {
        await enrollments.update(organizationId, existing.id, {
          status: 'ENROLLED',
          source: 'PATH',
          pathEnrollmentId: pathEnrollment.id,
        });
        unlocked = true;
      }
      if (unlocked) {
        const nextCourse = await courseRepository.withTx(tx).getById(organizationId, next.courseId);
        if (nextCourse) {
          void notificationService.create({
            organizationId,
            userId: pathEnrollment.userId,
            kind: 'PATH_COURSE_UNLOCKED',
            title: `Next path course unlocked: ${nextCourse.title}`,
            body: `Continue ${pathEnrollment.path.title} with ${nextCourse.title}.`,
            href: notificationService.courseHref(next.courseId),
            courseId: next.courseId,
          });
        }
      }
    }

    return pathCertificateService.issueIfEligible(organizationId, pathEnrollment.id, tx);
  }
}

export const learningPathService = new LearningPathService();
