import { prisma } from '../lib/prisma';
import type { AnalyticsOrgFilters } from '../lib/analytics-query';
import { enrollmentWhere, userSearchFilter, userWhere } from '../lib/scope-filters';
import { loginEventRepository } from './login-event.repository';
import type { DataScope } from '../types/auth';
import type { EnrollmentStatus, Prisma } from '@prisma/client';
import type { ReportType } from '../validators/reports.schema';

const EXPIRING_CERT_DAYS = 90;

export type ReportQuery = AnalyticsOrgFilters & {
  from?: Date;
  to?: Date;
  status?: string;
  certStatus?: 'active' | 'revoked' | 'expiring' | 'expired';
  q?: string;
  skip: number;
  take: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
};

function learnerName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export class ReportsRepository {
  constructor(private db: Prisma.TransactionClient = prisma) {}

  async list(organizationId: string, type: ReportType, scope: DataScope | undefined, query: ReportQuery) {
    switch (type) {
      case 'enrollments':
        return this.enrollments(organizationId, scope, query);
      case 'completions':
        return this.completions(organizationId, scope, query);
      case 'progress':
        return this.progress(organizationId, scope, query);
      case 'assessments':
        return this.assessments(organizationId, scope, query);
      case 'certificates':
        return this.certificates(organizationId, scope, query);
      case 'overdue-training':
        return this.overdueTraining(organizationId, scope, query);
      case 'activity':
        return this.activity(organizationId, scope, query);
      default:
        return { items: [], total: 0 };
    }
  }

  private enrollmentBaseWhere(
    organizationId: string,
    scope: DataScope | undefined,
    query: ReportQuery,
    extra?: Prisma.EnrollmentWhereInput,
    dateField: 'enrolledAt' | 'none' = 'enrolledAt',
  ): Prisma.EnrollmentWhereInput {
    const base = enrollmentWhere(organizationId, scope, query);
    let userClause: Prisma.EnrollmentWhereInput = {};
    if (query.q) {
      const scopedUser =
        base.user && typeof base.user === 'object' ? base.user : {};
      userClause = { user: { AND: [scopedUser, userSearchFilter(query.q)] } };
      delete base.user;
    }
    return {
      ...base,
      ...userClause,
      ...(dateField === 'enrolledAt' && query.from && query.to
        ? { enrolledAt: { gte: query.from, lte: query.to } }
        : {}),
      ...(query.status ? { status: query.status as EnrollmentStatus } : {}),
      ...extra,
    };
  }

  private enrollmentOrderBy(query: ReportQuery): Prisma.EnrollmentOrderByWithRelationInput {
    const dir = query.sortDirection;
    switch (query.sortField) {
      case 'learnerName':
        return { user: { lastName: dir } };
      case 'courseTitle':
        return { course: { title: dir } };
      case 'status':
        return { status: dir };
      case 'progressPct':
        return { progressPct: dir };
      case 'dueAt':
        return { dueAt: dir };
      case 'completedAt':
        return { completedAt: dir };
      default:
        return { enrolledAt: dir };
    }
  }

  async enrollments(organizationId: string, scope: DataScope | undefined, query: ReportQuery) {
    const where = this.enrollmentBaseWhere(organizationId, scope, query, {
      ...(query.status ? {} : { status: { not: 'REVOKED' } }),
    });
    const [rows, total] = await Promise.all([
      this.db.enrollment.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: this.enrollmentOrderBy(query),
        select: {
          id: true,
          enrolledAt: true,
          status: true,
          progressPct: true,
          dueAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: { select: { name: true } },
            },
          },
          course: { select: { id: true, title: true } },
        },
      }),
      this.db.enrollment.count({ where }),
    ]);

    const items = rows.map((e) => ({
      enrollmentId: e.id,
      userId: e.user.id,
      learnerName: learnerName(e.user.firstName, e.user.lastName),
      learnerEmail: e.user.email,
      departmentName: e.user.department?.name ?? null,
      courseId: e.course.id,
      courseTitle: e.course.title,
      enrolledAt: e.enrolledAt.toISOString(),
      status: e.status,
      progressPercent: Math.floor(e.progressPct),
      dueAt: e.dueAt?.toISOString() ?? null,
    }));
    return { items, total };
  }

  async completions(organizationId: string, scope: DataScope | undefined, query: ReportQuery) {
    const where: Prisma.EnrollmentWhereInput = {
      ...this.enrollmentBaseWhere(organizationId, scope, query, undefined, 'none'),
      status: 'COMPLETED',
      completedAt: {
        not: null,
        ...(query.from && query.to ? { gte: query.from, lte: query.to } : {}),
      },
    };
    const orderBy =
      query.sortField === 'completedAt'
        ? { completedAt: query.sortDirection }
        : this.enrollmentOrderBy(query);

    const [rows, total] = await Promise.all([
      this.db.enrollment.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy,
        select: {
          enrolledAt: true,
          completedAt: true,
          user: {
            select: { firstName: true, lastName: true, email: true, department: { select: { name: true } } },
          },
          course: { select: { title: true } },
          certificate: { select: { certificateNumber: true } },
        },
      }),
      this.db.enrollment.count({ where }),
    ]);

    const items = rows.map((e) => ({
      learnerName: learnerName(e.user.firstName, e.user.lastName),
      learnerEmail: e.user.email,
      departmentName: e.user.department?.name ?? null,
      courseTitle: e.course.title,
      completedAt: e.completedAt!.toISOString(),
      daysToComplete: daysBetween(e.enrolledAt, e.completedAt!),
      certificateNumber: e.certificate?.certificateNumber ?? null,
    }));
    return { items, total };
  }

  async progress(organizationId: string, scope: DataScope | undefined, query: ReportQuery) {
    const where = this.enrollmentBaseWhere(organizationId, scope, query, {
      status: { not: 'REVOKED' },
    }, 'none');
    const [rows, total] = await Promise.all([
      this.db.enrollment.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: this.enrollmentOrderBy(query),
        select: {
          id: true,
          status: true,
          progressPct: true,
          updatedAt: true,
          user: { select: { firstName: true, lastName: true, email: true, department: { select: { name: true } } } },
          course: {
            select: {
              title: true,
              modules: { select: { lessons: { select: { id: true } } } },
            },
          },
          progress: { select: { completed: true } },
        },
      }),
      this.db.enrollment.count({ where }),
    ]);

    const items = rows.map((e) => {
      const lessonIds = new Set(
        e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)),
      );
      const lessonsTotal = lessonIds.size;
      const lessonsCompleted = e.progress.filter((p) => p.completed).length;
      return {
        enrollmentId: e.id,
        learnerName: learnerName(e.user.firstName, e.user.lastName),
        learnerEmail: e.user.email,
        departmentName: e.user.department?.name ?? null,
        courseTitle: e.course.title,
        progressPercent: Math.floor(e.progressPct),
        status: e.status,
        lastActivityAt: e.updatedAt.toISOString(),
        lessonsCompleted,
        lessonsTotal,
      };
    });
    return { items, total };
  }

  async assessments(organizationId: string, scope: DataScope | undefined, query: ReportQuery) {
    const userFilter: Prisma.UserWhereInput = {
      ...userWhere(organizationId, scope, query),
      ...(query.q ? userSearchFilter(query.q) : {}),
    };

    const where: Prisma.AssessmentAttemptWhereInput = {
      assessment: {
        organizationId,
        ...(query.courseId ? { courseId: query.courseId } : {}),
      },
      ...(query.from && query.to ? { createdAt: { gte: query.from, lte: query.to } } : {}),
      user: userFilter,
    };

    const orderBy: Prisma.AssessmentAttemptOrderByWithRelationInput =
      query.sortField === 'score'
        ? { score: query.sortDirection }
        : query.sortField === 'submittedAt'
          ? { createdAt: query.sortDirection }
          : { createdAt: query.sortDirection };

    const [rows, total] = await Promise.all([
      this.db.assessmentAttempt.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy,
        select: {
          attemptNumber: true,
          score: true,
          passed: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true, email: true, department: { select: { name: true } } } },
          assessment: { select: { title: true, course: { select: { title: true } } } },
        },
      }),
      this.db.assessmentAttempt.count({ where }),
    ]);

    const items = rows.map((a) => ({
      learnerName: learnerName(a.user.firstName, a.user.lastName),
      learnerEmail: a.user.email,
      departmentName: a.user.department?.name ?? null,
      courseTitle: a.assessment.course.title,
      assessmentTitle: a.assessment.title,
      attemptNumber: a.attemptNumber,
      score: a.score,
      passed: a.passed,
      submittedAt: a.createdAt.toISOString(),
    }));
    return { items, total };
  }

  async certificates(organizationId: string, scope: DataScope | undefined, query: ReportQuery) {
    const now = new Date();
    const expiringEnd = new Date(now.getTime() + EXPIRING_CERT_DAYS * 24 * 60 * 60 * 1000);

    const assignments = await this.db.courseAssignment.findMany({
      where: { organizationId, recertifyEveryDays: { not: null } },
      select: { courseId: true, recertifyEveryDays: true },
    });
    const recertifyByCourse = new Map<string, number>();
    for (const a of assignments) {
      if (a.recertifyEveryDays == null) continue;
      const prev = recertifyByCourse.get(a.courseId);
      if (prev == null || a.recertifyEveryDays < prev) {
        recertifyByCourse.set(a.courseId, a.recertifyEveryDays);
      }
    }

    const userFilter: Prisma.UserWhereInput = {
      ...userWhere(organizationId, scope, query),
      ...(query.q ? userSearchFilter(query.q) : {}),
    };

    let revokedFilter: Prisma.CertificateWhereInput = {};
    if (query.certStatus === 'revoked') revokedFilter = { revokedAt: { not: null } };
    else if (query.certStatus === 'active' || !query.certStatus) revokedFilter = { revokedAt: null };

    const where: Prisma.CertificateWhereInput = {
      organizationId,
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.from && query.to ? { issuedAt: { gte: query.from, lte: query.to } } : {}),
      user: userFilter,
      ...revokedFilter,
    };

    const [rows, totalBeforeFilter] = await Promise.all([
      this.db.certificate.findMany({
        where,
        skip: 0,
        take: 10_000,
        orderBy: { issuedAt: query.sortDirection },
        select: {
          id: true,
          certificateNumber: true,
          issuedAt: true,
          expiresAt: true,
          revokedAt: true,
          courseId: true,
          user: { select: { firstName: true, lastName: true, email: true, department: { select: { name: true } } } },
          course: { select: { title: true } },
        },
      }),
      this.db.certificate.count({ where }),
    ]);

    let mapped = rows.map((c) => {
      const days = recertifyByCourse.get(c.courseId);
      const expiresAt =
        c.expiresAt ??
        (days != null ? new Date(c.issuedAt.getTime() + days * 24 * 60 * 60 * 1000) : null);
      let status: 'active' | 'revoked' | 'expiring' | 'expired' = c.revokedAt ? 'revoked' : 'active';
      if (!c.revokedAt && expiresAt) {
        if (expiresAt < now) status = 'expired';
        else if (expiresAt <= expiringEnd) status = 'expiring';
      }
      return {
        certificateId: c.id,
        learnerName: learnerName(c.user.firstName, c.user.lastName),
        learnerEmail: c.user.email,
        departmentName: c.user.department?.name ?? null,
        courseTitle: c.course.title,
        certificateNumber: c.certificateNumber,
        issuedAt: c.issuedAt.toISOString(),
        expiresAt: expiresAt?.toISOString() ?? null,
        status,
      };
    });

    if (query.certStatus === 'expiring' || query.certStatus === 'expired') {
      mapped = mapped.filter((c) => c.status === query.certStatus);
    }

    const total = query.certStatus === 'expiring' || query.certStatus === 'expired' ? mapped.length : totalBeforeFilter;
    const items = mapped.slice(query.skip, query.skip + query.take);
    return { items, total };
  }

  async overdueTraining(organizationId: string, scope: DataScope | undefined, query: ReportQuery) {
    const now = new Date();
    const where: Prisma.EnrollmentWhereInput = {
      ...this.enrollmentBaseWhere(organizationId, scope, query, undefined, 'none'),
      status: { in: ['ENROLLED', 'IN_PROGRESS'] },
      dueAt: { not: null, lt: now },
    };

    const orderBy =
      query.sortField === 'dueAt' || query.sortField === 'daysOverdue'
        ? { dueAt: query.sortDirection }
        : { dueAt: 'asc' as const };

    const [rows, total] = await Promise.all([
      this.db.enrollment.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy,
        select: {
          progressPct: true,
          status: true,
          dueAt: true,
          user: { select: { firstName: true, lastName: true, email: true, department: { select: { name: true } } } },
          course: { select: { title: true } },
        },
      }),
      this.db.enrollment.count({ where }),
    ]);

    const items = rows.map((e) => ({
      learnerName: learnerName(e.user.firstName, e.user.lastName),
      learnerEmail: e.user.email,
      departmentName: e.user.department?.name ?? null,
      courseTitle: e.course.title,
      dueAt: e.dueAt!.toISOString(),
      daysOverdue: daysBetween(e.dueAt!, now),
      progressPercent: Math.floor(e.progressPct),
      status: e.status,
    }));
    return { items, total };
  }

  async activity(organizationId: string, scope: DataScope | undefined, query: ReportQuery) {
    const base = userWhere(organizationId, scope, query);
    const where: Prisma.UserWhereInput = query.q
      ? { AND: [base, userSearchFilter(query.q)] }
      : base;
    const orderBy: Prisma.UserOrderByWithRelationInput =
      query.sortField === 'lastLoginAt'
        ? { lastLoginAt: query.sortDirection }
        : query.sortField === 'learnerName'
          ? { lastName: query.sortDirection }
          : { lastName: 'asc' };

    const [users, total] = await Promise.all([
      this.db.user.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          lastLoginAt: true,
          department: { select: { name: true } },
          enrollments: {
            where: { status: { in: ['ENROLLED', 'IN_PROGRESS'] } },
            select: {
              id: true,
              progress: {
                select: {
                  positionSeconds: true,
                  completed: true,
                  lesson: { select: { durationSeconds: true } },
                },
              },
            },
          },
        },
      }),
      this.db.user.count({ where }),
    ]);

    const userIds = users.map((u) => u.id);
    const loginCounts =
      query.from && query.to
        ? await loginEventRepository.countByUsersInRange(
            organizationId,
            userIds,
            query.from,
            query.to,
          )
        : [];
    const loginCountByUser = new Map(loginCounts.map((r) => [r.userId, r.count]));
    const latestLogins = await loginEventRepository.latestByUsers(organizationId, userIds);

    const items = users.map((u) => {
      let seconds = 0;
      for (const enrollment of u.enrollments) {
        for (const p of enrollment.progress) {
          seconds += p.completed && p.lesson.durationSeconds ? p.lesson.durationSeconds : p.positionSeconds;
        }
      }
      const eventLogin = latestLogins.get(u.id);
      const lastLoginAt = eventLogin ?? u.lastLoginAt;
      return {
        userId: u.id,
        learnerName: learnerName(u.firstName, u.lastName),
        learnerEmail: u.email,
        departmentName: u.department?.name ?? null,
        lastLoginAt: lastLoginAt?.toISOString() ?? null,
        loginsInPeriod: query.from && query.to ? (loginCountByUser.get(u.id) ?? 0) : null,
        activeEnrollments: u.enrollments.length,
        estimatedHours: Math.round((seconds / 3600) * 10) / 10,
      };
    });
    return { items, total };
  }
}

export const reportsRepository = new ReportsRepository();
