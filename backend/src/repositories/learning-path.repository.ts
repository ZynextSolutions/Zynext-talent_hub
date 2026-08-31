import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';
import { AppError } from '../errors/app-error';
import type { DataScope } from '../types/tenant';

const withCourses = {
  courses: {
    orderBy: { orderIndex: 'asc' as const },
    include: { course: { select: { id: true, title: true, status: true } } },
  },
  _count: { select: { courses: true } },
};

export class LearningPathRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new LearningPathRepository(tx);
  }

  list(organizationId: string, status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') {
    return this.db.learningPath.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      include: { _count: { select: { courses: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  getById(organizationId: string, id: string) {
    return this.db.learningPath.findFirst({
      where: { id, organizationId },
      include: withCourses,
    });
  }

  create(data: Prisma.LearningPathUncheckedCreateInput) {
    return this.db.learningPath.create({ data, include: withCourses });
  }

  async update(organizationId: string, id: string, data: Prisma.LearningPathUncheckedUpdateInput) {
    const row = await this.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    return this.db.learningPath.update({ where: { id }, data, include: withCourses });
  }

  async delete(organizationId: string, id: string) {
    const res = await this.db.learningPath.deleteMany({ where: { id, organizationId } });
    if (res.count !== 1) throw AppError.from('NOT_FOUND');
    return { id };
  }

  findEnrollment(organizationId: string, pathId: string, userId: string) {
    return this.db.pathEnrollment.findFirst({
      where: { organizationId, pathId, userId },
      include: { courseEnrolls: true, certificate: true },
    });
  }

  createEnrollment(data: Prisma.PathEnrollmentUncheckedCreateInput) {
    return this.db.pathEnrollment.create({ data });
  }

  updateEnrollment(id: string, data: Prisma.PathEnrollmentUncheckedUpdateInput) {
    return this.db.pathEnrollment.update({ where: { id }, data });
  }

  listEnrollments(organizationId: string, pathId: string) {
    return this.db.pathEnrollment.findMany({
      where: { organizationId, pathId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  listUserEnrollments(organizationId: string, userId: string) {
    return this.db.pathEnrollment.findMany({
      where: { organizationId, userId },
      include: { path: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  replaceCourses(pathId: string, courses: Array<{ courseId: string; orderIndex: number; required: boolean }>) {
    return prisma.$transaction(async (tx) => {
      await tx.pathCourse.deleteMany({ where: { pathId } });
      for (const c of courses) {
        await tx.pathCourse.create({
          data: { pathId, courseId: c.courseId, orderIndex: c.orderIndex, required: c.required },
        });
      }
    });
  }

  findPathCertificate(pathEnrollmentId: string) {
    return this.db.pathCertificate.findUnique({ where: { pathEnrollmentId } });
  }

  findPathCertificateById(organizationId: string, id: string) {
    return this.db.pathCertificate.findFirst({
      where: { id, organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, departmentId: true } },
        path: { select: { id: true, title: true } },
        organization: { select: { name: true, settings: true } },
      },
    });
  }

  findPathCertificateByNumber(certificateNumber: string) {
    return this.db.pathCertificate.findUnique({
      where: { certificateNumber },
      include: {
        user: { select: { firstName: true, lastName: true } },
        path: { select: { title: true } },
        organization: { select: { name: true, settings: true } },
      },
    });
  }

  listPathCertificates(
    organizationId: string,
    params: {
      skip: number;
      take: number;
      userId?: string;
      scope?: DataScope;
    },
  ) {
    const where: Prisma.PathCertificateWhereInput = {
      organizationId,
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.scope?.kind === 'self' && params.scope.userId ? { userId: params.scope.userId } : {}),
      ...(params.scope?.kind === 'department' && params.scope.departmentId
        ? { user: { departmentId: params.scope.departmentId } }
        : {}),
    };
    return Promise.all([
      this.db.pathCertificate.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { issuedAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          path: { select: { id: true, title: true } },
          organization: { select: { name: true, settings: true } },
        },
      }),
      this.db.pathCertificate.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  createPathCertificate(data: Prisma.PathCertificateUncheckedCreateInput) {
    return this.db.pathCertificate.create({ data });
  }
}

export const learningPathRepository = new LearningPathRepository();
