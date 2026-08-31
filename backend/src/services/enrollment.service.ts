import type { EnrollmentSource, Prisma } from '@prisma/client';
import { Prisma as PrismaNS } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { TX_DEFAULT, TX_SERIALIZABLE, ENROLLMENT_CHUNK } from '../config/constants';
import { prisma } from '../repositories/prisma';
import { courseRepository } from '../repositories/course.repository';
import { assignmentRepository } from '../repositories/assignment.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { userRepository } from '../repositories/user.repository';
import { isPrismaWriteConflict } from '../errors/prisma-map';
import { hierarchyService } from './hierarchy.service';
import { toAssignmentDto, toEnrollmentDto, toProgressDto } from '../lib/mappers';
import type { AssignmentTargetType } from '../domain/assignment-targets';
import type { AuthPrincipal, DataScope } from '../types/auth';
import { parsePagination, paginationMeta, toSkipTake } from '../lib/pagination';
import type { EnrollmentStatus } from '@prisma/client';
import { notificationService } from './notification.service';
import { storeIdempotent, takeIdempotent } from '../lib/idempotency';

class EnrollmentService {
  async assignCourse(input: {
    organizationId: string;
    courseId: string;
    targetType: AssignmentTargetType;
    targetId: string;
    actor: AuthPrincipal;
    scope?: DataScope;
    idempotencyKey?: string;
    dueAt?: string | null;
    recertifyEveryDays?: number | null;
    reminderDaysBefore?: number | null;
  }) {
    const fingerprint = `${input.organizationId}:${input.courseId}:${input.targetType}:${input.targetId}`;
    const cached = await takeIdempotent(input.organizationId, input.idempotencyKey, fingerprint);
    if (cached) return { replay: true as const, data: cached };

    const run = async () => {
      const result = await prisma.$transaction(
        async (tx) => {
          const courses = courseRepository.withTx(tx);
          const assignments = assignmentRepository.withTx(tx);
          const enrollments = enrollmentRepository.withTx(tx);

          const course = await courses.getById(input.organizationId, input.courseId);
          if (!course) throw AppError.from('NOT_FOUND');
          if (course.status !== 'PUBLISHED') throw AppError.from('COURSE_NOT_PUBLISHED');

          const meta = await hierarchyService.loadTargetMeta(
            input.organizationId,
            input.targetType,
            input.targetId,
          );
          hierarchyService.assertTargetInScope(input.scope, input.targetType, meta);

          let assignment = await assignments.findExisting(
            input.organizationId,
            input.courseId,
            input.targetType,
            input.targetId,
          );
          const dueAt = input.dueAt ? new Date(input.dueAt) : null;
          const created = !assignment;
          if (!assignment) {
            assignment = await assignments.create({
              organizationId: input.organizationId,
              courseId: input.courseId,
              targetType: input.targetType,
              targetId: input.targetId,
              createdByUserId: input.actor.actorType === 'user' ? input.actor.sub : null,
              dueAt,
              recertifyEveryDays: input.recertifyEveryDays ?? null,
              reminderDaysBefore: input.reminderDaysBefore ?? 7,
            });
          } else if (dueAt || input.recertifyEveryDays != null || input.reminderDaysBefore != null) {
            await assignments.update(input.organizationId, assignment.id, {
              ...(dueAt !== undefined ? { dueAt } : {}),
              ...(input.recertifyEveryDays !== undefined
                ? { recertifyEveryDays: input.recertifyEveryDays }
                : {}),
              ...(input.reminderDaysBefore !== undefined
                ? { reminderDaysBefore: input.reminderDaysBefore }
                : {}),
            });
            assignment = (await assignments.getById(input.organizationId, assignment.id))!;
          }

          const users = await hierarchyService.usersUnder(
            input.organizationId,
            input.targetType,
            input.targetId,
          );
          let enrolledCount = 0;
          let alreadyEnrolledCount = 0;
          let skippedInactiveCount = 0;
          const newlyEnrolledUserIds: string[] = [];

          const active = users.filter((u) => u.status === 'ACTIVE' || u.status === 'INVITED');
          skippedInactiveCount = users.length - active.length;

          for (let i = 0; i < active.length; i += ENROLLMENT_CHUNK) {
            const chunk = active.slice(i, i + ENROLLMENT_CHUNK);
            for (const u of chunk) {
              const existing = await enrollments.findByUserCourse(
                input.organizationId,
                u.id,
                input.courseId,
              );
              if (!existing) {
                await enrollments.create({
                  organizationId: input.organizationId,
                  userId: u.id,
                  courseId: input.courseId,
                  status: 'ENROLLED',
                  source: 'ASSIGNMENT',
                  assignmentId: assignment.id,
                  dueAt: assignment.dueAt,
                  progressPct: 0,
                });
                newlyEnrolledUserIds.push(u.id);
                enrolledCount += 1;
              } else if (existing.status === 'REVOKED') {
                await enrollments.update(input.organizationId, existing.id, {
                  status: 'ENROLLED',
                  source: 'ASSIGNMENT',
                  assignmentId: assignment.id,
                  dueAt: assignment.dueAt,
                });
                newlyEnrolledUserIds.push(u.id);
                enrolledCount += 1;
              } else {
                alreadyEnrolledCount += 1;
              }
            }
          }

          return {
            assignment: toAssignmentDto(assignment),
            enrolledCount,
            alreadyEnrolledCount,
            skippedInactiveCount,
            created,
            newlyEnrolledUserIds,
            courseTitle: course.title,
          };
        },
        TX_SERIALIZABLE,
      );
      return result;
    };

    try {
      const data = await run();
      await storeIdempotent(input.organizationId, input.idempotencyKey!, fingerprint, data);
      await Promise.all(
        data.newlyEnrolledUserIds.map((userId) =>
          notificationService.create({
            organizationId: input.organizationId,
            userId,
            kind: 'ASSIGNED',
            title: `New course assigned: ${data.courseTitle}`,
            body: data.assignment.dueAt
              ? `${data.courseTitle} is due on ${data.assignment.dueAt.slice(0, 10)}.`
              : `You have been assigned ${data.courseTitle}.`,
            href: notificationService.courseHref(input.courseId),
            courseId: input.courseId,
          }),
        ),
      );
      return { replay: false as const, data };
    } catch (err) {
      if (isPrismaWriteConflict(err)) {
        try {
          const data = await run();
          await storeIdempotent(input.organizationId, input.idempotencyKey!, fingerprint, data);
          return { replay: false as const, data };
        } catch (retryErr) {
          if (isPrismaWriteConflict(retryErr)) throw AppError.from('TX_WRITE_CONFLICT');
          throw retryErr;
        }
      }
      throw err;
    }
  }

  async unassign(organizationId: string, courseId: string, assignmentId: string) {
    return prisma.$transaction(async (tx) => {
      const assignments = assignmentRepository.withTx(tx);
      const enrollments = enrollmentRepository.withTx(tx);
      const assignment = await assignments.getById(organizationId, assignmentId);
      if (!assignment || assignment.courseId !== courseId) throw AppError.from('NOT_FOUND');
      const zero = await enrollments.listZeroProgressAssignable(organizationId, assignmentId);
      for (const row of zero) {
        await enrollments.update(organizationId, row.id, { status: 'REVOKED' });
      }
      await assignments.delete(organizationId, courseId, assignmentId);
      const retained = await tx.enrollment.count({
        where: { organizationId, assignmentId, status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
      });
      return { revokedEnrollmentCount: zero.length, retainedEnrollmentCount: retained };
    }, TX_DEFAULT);
  }

  async reconcileAfterHierarchyChange(input: {
    organizationId: string;
    affectedUserIds: string[];
    tx: Prisma.TransactionClient;
  }): Promise<{ enrollmentsAdded: number; enrollmentsRetained: number }> {
    const enrollments = enrollmentRepository.withTx(input.tx);
    const assignments = assignmentRepository.withTx(input.tx);
    const users = await userRepository.withTx(input.tx).findByIds(input.organizationId, input.affectedUserIds);
    let enrollmentsAdded = 0;
    let enrollmentsRetained = 0;

    for (const user of users) {
      const covering = await assignments.listCoveringUser(input.organizationId, {
        id: user.id,
        divisionId: user.divisionId,
        departmentId: user.departmentId,
        teamId: user.teamId,
      });
      const desired = new Set(covering.map((a) => a.courseId));
      const existing = await enrollments.listByUserCourseIds(input.organizationId, user.id);

      for (const courseId of desired) {
        const row = existing.find((e) => e.courseId === courseId);
        const assignment = covering.find((a) => a.courseId === courseId);
        if (!row) {
          await enrollments.create({
            organizationId: input.organizationId,
            userId: user.id,
            courseId,
            status: 'ENROLLED',
            source: 'MOVE_RECONCILE',
            assignmentId: assignment?.id ?? null,
            progressPct: 0,
          });
          enrollmentsAdded += 1;
        } else if (row.status === 'REVOKED') {
          await enrollments.update(input.organizationId, row.id, {
            status: 'ENROLLED',
            source: 'MOVE_RECONCILE',
            assignmentId: assignment?.id ?? null,
          });
          enrollmentsAdded += 1;
        }
      }

      for (const row of existing) {
        if (desired.has(row.courseId)) continue;
        if (row.status === 'COMPLETED' || row.status === 'IN_PROGRESS') {
          enrollmentsRetained += 1;
          continue;
        }
        const full = await enrollments.findByUserCourse(input.organizationId, user.id, row.courseId);
        if (
          full &&
          full.status === 'ENROLLED' &&
          full.progressPct === 0 &&
          (full.source === 'ASSIGNMENT' || full.source === 'MOVE_RECONCILE')
        ) {
          await enrollments.update(input.organizationId, full.id, { status: 'REVOKED' });
        }
      }
    }

    return { enrollmentsAdded, enrollmentsRetained };
  }

  async list(
    organizationId: string,
    query: {
      page?: number;
      pageSize?: number;
      userId?: string;
      courseId?: string;
      status?: EnrollmentStatus;
      q?: string;
    },
    actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    const pg = parsePagination(query.page, query.pageSize);
    let userId = query.userId;
    if (actor.role === 'EMPLOYEE') userId = actor.sub;
    let instructorCourseIds: string[] | undefined;
    if (actor.role === 'INSTRUCTOR') {
      const courses = await prisma.course.findMany({
        where: { organizationId, deletedAt: null, createdByUserId: actor.sub },
        select: { id: true },
      });
      instructorCourseIds = courses.map((c) => c.id);
    }
    const { items, total } = await enrollmentRepository.list(organizationId, {
      ...toSkipTake(pg),
      userId,
      courseId: query.courseId,
      status: query.status,
      q: query.q,
      scope,
      instructorCourseIds,
    });
    return {
      items: items.map(toEnrollmentDto),
      pagination: paginationMeta(pg.page, pg.pageSize, total),
    };
  }

  async get(organizationId: string, id: string, actor: AuthPrincipal, scope?: DataScope) {
    const row = await enrollmentRepository.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    if (actor.role === 'EMPLOYEE' && row.userId !== actor.sub) throw AppError.from('NOT_FOUND');
    if (scope?.kind === 'department' && row.user.departmentId !== scope.departmentId) {
      throw AppError.from('NOT_FOUND');
    }
    return {
      ...toEnrollmentDto(row),
      progress: row.progress.map(toProgressDto),
      certificate: row.certificate,
      course: { id: row.course.id, title: row.course.title, status: row.course.status },
      user: {
        id: row.user.id,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        avatarUrl: row.user.avatarUrl,
        role: row.user.role.name,
      },
    };
  }

  async manualEnroll(
    organizationId: string,
    body: { userId: string; courseId: string; dueAt?: string | null },
    scope?: DataScope,
    idempotencyKey?: string,
  ) {
    const fingerprint = `manual:${organizationId}:${body.userId}:${body.courseId}`;
    const cached = await takeIdempotent(organizationId, idempotencyKey, fingerprint);
    if (cached) return cached;

    const user = await userRepository.getById(organizationId, body.userId);
    if (!user) throw AppError.from('NOT_FOUND');
    if (scope?.kind === 'department' && user.departmentId !== scope.departmentId) {
      throw AppError.from('RBAC_SCOPE_VIOLATION');
    }
    const course = await courseRepository.getById(organizationId, body.courseId);
    if (!course) throw AppError.from('NOT_FOUND');
    if (course.status !== 'PUBLISHED') throw AppError.from('COURSE_NOT_PUBLISHED');

    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    const existing = await enrollmentRepository.findByUserCourse(
      organizationId,
      body.userId,
      body.courseId,
    );
    let row;
    if (!existing) {
      row = await enrollmentRepository.create({
        organizationId,
        userId: body.userId,
        courseId: body.courseId,
        status: 'ENROLLED',
        source: 'MANUAL',
        progressPct: 0,
        dueAt,
      });
    } else if (existing.status === 'REVOKED') {
      row = await enrollmentRepository.update(organizationId, existing.id, {
        status: 'ENROLLED',
        source: 'MANUAL',
        dueAt,
      });
    } else {
      row = existing;
    }
    const dto = toEnrollmentDto(row!);
    await storeIdempotent(organizationId, idempotencyKey!, fingerprint, dto);
    return dto;
  }

  async revoke(organizationId: string, id: string, scope?: DataScope) {
    const row = await enrollmentRepository.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    if (scope?.kind === 'department' && row.user.departmentId !== scope.departmentId) {
      throw AppError.from('RBAC_SCOPE_VIOLATION');
    }
    const updated = await enrollmentRepository.update(organizationId, id, { status: 'REVOKED' });
    return toEnrollmentDto(updated!);
  }
}

void TX_DEFAULT;
export const enrollmentService = new EnrollmentService();
