import type { EnrollmentStatus, Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import type { DataScope } from '../types/tenant';

export class EnrollmentRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new EnrollmentRepository(tx);
  }

  findById(organizationId: string, id: string) {
    return this.db.enrollment.findFirst({
      where: { id, organizationId },
      include: {
        progress: true,
        certificate: true,
        course: true,
        user: { include: { role: true } },
      },
    });
  }

  getById(organizationId: string, id: string) {
    return this.findById(organizationId, id);
  }

  findByUserCourse(organizationId: string, userId: string, courseId: string) {
    return this.db.enrollment.findFirst({
      where: { organizationId, userId, courseId },
    });
  }

  list(
    organizationId: string,
    params: {
      skip: number;
      take: number;
      userId?: string;
      courseId?: string;
      status?: EnrollmentStatus;
      q?: string;
      scope?: DataScope;
      instructorCourseIds?: string[];
    },
  ) {
    const q = params.q?.trim();
    const and: Prisma.EnrollmentWhereInput[] = [{ organizationId }];
    if (params.userId) and.push({ userId: params.userId });
    if (params.status) and.push({ status: params.status });
    if (params.instructorCourseIds) {
      and.push({
        courseId: params.courseId
          ? params.instructorCourseIds.includes(params.courseId)
            ? params.courseId
            : { in: [] }
          : { in: params.instructorCourseIds },
      });
    } else if (params.courseId) {
      and.push({ courseId: params.courseId });
    }
    if (params.scope?.kind === 'self' && params.scope.userId) {
      and.push({ userId: params.scope.userId });
    }
    if (params.scope?.kind === 'department' && params.scope.departmentId) {
      and.push({ user: { departmentId: params.scope.departmentId } });
    }
    if (q) {
      and.push({
        OR: [
          { user: { firstName: { contains: q, mode: 'insensitive' } } },
          { user: { lastName: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { course: { title: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.EnrollmentWhereInput = { AND: and };
    return Promise.all([
      this.db.enrollment.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { enrolledAt: 'desc' },
        include: {
          course: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.db.enrollment.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  listByUserIds(organizationId: string, userIds: string[]) {
    if (!userIds.length) return Promise.resolve([]);
    return this.db.enrollment.findMany({
      where: { organizationId, userId: { in: userIds } },
    });
  }

  listByUserCourseIds(organizationId: string, userId: string) {
    return this.db.enrollment.findMany({ where: { organizationId, userId } });
  }

  listByCourse(organizationId: string, courseId: string) {
    return this.db.enrollment.findMany({ where: { organizationId, courseId } });
  }

  listZeroProgressAssignable(organizationId: string, assignmentId: string) {
    return this.db.enrollment.findMany({
      where: { organizationId, assignmentId, status: 'ENROLLED', progressPct: 0 },
    });
  }

  create(data: Prisma.EnrollmentUncheckedCreateInput) {
    return this.db.enrollment.create({ data });
  }

  async upsertEnroll(organizationId: string, userId: string, courseId: string) {
    const existing = await this.findByUserCourse(organizationId, userId, courseId);
    if (!existing) {
      return {
        enrollment: await this.db.enrollment.create({
          data: { organizationId, userId, courseId, status: 'ENROLLED', progressPct: 0 },
        }),
        created: true,
      };
    }
    if (existing.status === 'REVOKED') {
      const enrollment = await this.db.enrollment.update({
        where: { id: existing.id },
        data: { status: 'ENROLLED', completedAt: null },
      });
      return { enrollment, created: true };
    }
    return { enrollment: existing, created: false };
  }

  update(a: string, b: string | Prisma.EnrollmentUncheckedUpdateInput, c?: Prisma.EnrollmentUncheckedUpdateInput) {
    if (c && typeof b === 'string') {
      return this.db.enrollment.update({ where: { id: b }, data: c });
    }
    return this.db.enrollment.update({ where: { id: a }, data: b as Prisma.EnrollmentUncheckedUpdateInput });
  }

  updateMany(
    organizationId: string,
    where: Prisma.EnrollmentWhereInput,
    data: Prisma.EnrollmentUncheckedUpdateManyInput,
  ) {
    return this.db.enrollment.updateMany({
      where: { organizationId, ...where },
      data,
    });
  }

  async requireById(organizationId: string, id: string) {
    const row = await this.findById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND', 'Enrollment not found.');
    return row;
  }
}

export const enrollmentRepository = new EnrollmentRepository();
