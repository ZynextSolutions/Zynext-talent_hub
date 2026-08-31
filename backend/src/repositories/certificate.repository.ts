import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import type { DataScope } from '../types/tenant';

export class CertificateRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new CertificateRepository(tx);
  }

  findById(organizationId: string, id: string) {
    return this.db.certificate.findFirst({
      where: { id, organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, departmentId: true } },
        course: { select: { id: true, title: true } },
        organization: { select: { name: true, settings: true } },
      },
    });
  }

  getById(organizationId: string, id: string) {
    return this.findById(organizationId, id);
  }

  findByEnrollment(enrollmentId: string) {
    return this.db.certificate.findUnique({
      where: { enrollmentId },
    });
  }

  findLiveByEnrollment(organizationIdOrEnrollmentId: string, enrollmentId?: string) {
    const enrollment = enrollmentId ?? organizationIdOrEnrollmentId;
    const organizationId = enrollmentId ? organizationIdOrEnrollmentId : undefined;
    return this.db.certificate.findFirst({
      where: {
        enrollmentId: enrollment,
        revokedAt: null,
        ...(organizationId ? { organizationId } : {}),
      },
    });
  }

  findByNumber(certificateNumber: string) {
    return this.db.certificate.findUnique({
      where: { certificateNumber },
      include: {
        user: { select: { firstName: true, lastName: true } },
        course: { select: { title: true } },
        organization: { select: { name: true, settings: true } },
      },
    });
  }

  list(
    organizationId: string,
    params: {
      skip: number;
      take: number;
      userId?: string;
      courseId?: string;
      scope?: DataScope;
    },
  ) {
    const where: Prisma.CertificateWhereInput = {
      organizationId,
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.courseId ? { courseId: params.courseId } : {}),
      ...(params.scope?.kind === 'self' && params.scope.userId ? { userId: params.scope.userId } : {}),
      ...(params.scope?.kind === 'department' && params.scope.departmentId
        ? { user: { departmentId: params.scope.departmentId } }
        : {}),
    };
    return Promise.all([
      this.db.certificate.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { issuedAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          course: { select: { id: true, title: true } },
          organization: { select: { name: true, settings: true } },
        },
      }),
      this.db.certificate.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  create(data: Prisma.CertificateUncheckedCreateInput) {
    return this.db.certificate.create({ data });
  }

  async revoke(organizationId: string, id: string, revokedAt?: Date) {
    const existing = await this.findById(organizationId, id);
    if (!existing) throw AppError.from('NOT_FOUND', 'Certificate not found.');
    return this.db.certificate.update({
      where: { id },
      data: { revokedAt: revokedAt ?? new Date() },
    });
  }

  deleteByEnrollment(enrollmentId: string) {
    return this.db.certificate.deleteMany({ where: { enrollmentId } });
  }
}

export const certificateRepository = new CertificateRepository();
