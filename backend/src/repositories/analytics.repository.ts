import { prisma } from '../lib/prisma';
import { loginEventRepository } from './login-event.repository';
import { progressLearningSeconds } from '../lib/learning-time';
import { parseTrainingCurrency, resolveDefaultTrainingCostMinor, CURRENCY_MINOR_UNITS, type TrainingCurrency } from '../lib/money';
import type { AnalyticsOrgFilters } from '../lib/analytics-query';
import type { DataScope } from '../types/tenant';
import type { EnrollmentStatus, Prisma } from '@prisma/client';

const STALE_LOGIN_DAYS = 14;
const STALE_PROGRESS_DAYS = 14;
const DUE_SOON_DAYS = 7;
const EXPIRING_CERT_DAYS = 90;

type DateRange = { from: Date; to: Date };

function inRange(date: Date, range: DateRange): boolean {
  const t = date.getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

function daysBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

function roundRate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}

function dueAtOf(row: { dueAt?: Date | null }): Date | null {
  return row.dueAt instanceof Date ? row.dueAt : null;
}

type ComplianceEnrollment = {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  progressPct: number;
  dueAt: Date | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    departmentId: string | null;
    department: { id: string; name: string } | null;
  };
  course: { id: string; title: string };
};

export class AnalyticsRepository {
  constructor(private db: Prisma.TransactionClient = prisma) {}

  private userWhere(
    organizationId: string,
    scope?: DataScope,
    filters?: AnalyticsOrgFilters,
  ): Prisma.UserWhereInput {
    return {
      organizationId,
      deletedAt: null,
      ...(scope?.kind === 'department' && scope.departmentId ? { departmentId: scope.departmentId } : {}),
      ...(scope?.kind === 'self' && scope.userId ? { id: scope.userId } : {}),
      ...(filters?.divisionId ? { divisionId: filters.divisionId } : {}),
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters?.teamId ? { teamId: filters.teamId } : {}),
      ...(filters?.userId ? { id: filters.userId } : {}),
    };
  }

  private enrollmentWhere(
    organizationId: string,
    scope?: DataScope,
    filters?: AnalyticsOrgFilters,
  ): Prisma.EnrollmentWhereInput {
    const userFilter: Prisma.UserWhereInput = {
      ...(scope?.kind === 'department' && scope.departmentId
        ? { departmentId: scope.departmentId }
        : {}),
      ...(scope?.kind === 'self' && scope.userId ? { id: scope.userId } : {}),
      ...(filters?.divisionId ? { divisionId: filters.divisionId } : {}),
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters?.teamId ? { teamId: filters.teamId } : {}),
      ...(filters?.userId ? { id: filters.userId } : {}),
    };
    const hasUserFilter = Object.keys(userFilter).length > 0;

    return {
      organizationId,
      ...(filters?.courseId ? { courseId: filters.courseId } : {}),
      ...(filters?.userId ? { userId: filters.userId } : {}),
      ...(scope?.kind === 'self' && scope.userId ? { userId: scope.userId } : {}),
      ...(hasUserFilter ? { user: userFilter } : {}),
    };
  }

  private certificateWhere(
    organizationId: string,
    scope?: DataScope,
    filters?: AnalyticsOrgFilters,
    range?: DateRange,
  ): Prisma.CertificateWhereInput {
    const userFilter: Prisma.UserWhereInput = {
      ...(scope?.kind === 'department' && scope.departmentId
        ? { departmentId: scope.departmentId }
        : {}),
      ...(scope?.kind === 'self' && scope.userId ? { id: scope.userId } : {}),
      ...(filters?.divisionId ? { divisionId: filters.divisionId } : {}),
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters?.teamId ? { teamId: filters.teamId } : {}),
      ...(filters?.userId ? { id: filters.userId } : {}),
    };
    const hasUserFilter = Object.keys(userFilter).length > 0;

    return {
      organizationId,
      revokedAt: null,
      ...(scope?.kind === 'self' && scope.userId ? { userId: scope.userId } : {}),
      ...(filters?.userId ? { userId: filters.userId } : {}),
      ...(filters?.courseId ? { courseId: filters.courseId } : {}),
      ...(range ? { issuedAt: { gte: range.from, lte: range.to } } : {}),
      ...(hasUserFilter ? { user: userFilter } : {}),
    };
  }

  private summarizeRows(
    users: Array<{ id: string }>,
    enrollments: Array<{ userId: string; status: string; progressPct: number; enrolledAt: Date }>,
    range?: DateRange,
  ) {
    const scoped = range
      ? enrollments.filter((e) => inRange(e.enrolledAt, range) && e.status !== 'REVOKED')
      : enrollments.filter((e) => e.status !== 'REVOKED');
    const completed = scoped.filter((e) => e.status === 'COMPLETED').length;
    const distinctUsers = new Set(scoped.map((e) => e.userId)).size;
    return {
      userCount: users.length,
      enrollmentCount: scoped.length,
      completionRate: scoped.length ? roundRate(completed / scoped.length) : 0,
      avgProgress: scoped.length
        ? Math.round(scoped.reduce((s, e) => s + e.progressPct, 0) / scoped.length)
        : 0,
      participationRate: users.length ? roundRate(distinctUsers / users.length) : 0,
    };
  }

  async dashboard(
    organizationId: string,
    from: Date,
    to: Date,
    scope?: DataScope,
    filters?: AnalyticsOrgFilters,
  ) {
    const userWhere = this.userWhere(organizationId, scope, filters);
    const enrollmentWhere = this.enrollmentWhere(organizationId, scope, filters);
    const range: DateRange = { from, to };
    const now = new Date();
    const dueSoonEnd = new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000);
    const staleLoginCutoff = new Date(now.getTime() - STALE_LOGIN_DAYS * 24 * 60 * 60 * 1000);

    const activeEnrollmentWhere: Prisma.EnrollmentWhereInput = {
      ...enrollmentWhere,
      status: { not: 'REVOKED' },
    };
    const incompleteWhere: Prisma.EnrollmentWhereInput = {
      ...enrollmentWhere,
      status: { notIn: ['REVOKED', 'COMPLETED'] },
      dueAt: { not: null },
    };

    const [
      userCount,
      activeUserCount,
      courseCount,
      publishedCourseCount,
      enrollmentAgg,
      statusGroups,
      enrolledUsers,
      mandatoryTotal,
      mandatoryCompleted,
      overdueCount,
      dueSoonCount,
      staleLoginCount,
      lifetimeCerts,
      periodCerts,
      periodEnrollmentCount,
      periodCompletionCount,
      periodLoginUsers,
      periodProgressUsers,
      lifetimeWatch,
      periodWatch,
      chartEnrollments,
      courseGroups,
    ] = await Promise.all([
      this.db.user.count({ where: userWhere }),
      this.db.user.count({ where: { ...userWhere, status: 'ACTIVE' } }),
      this.db.course.count({ where: { organizationId, deletedAt: null } }),
      this.db.course.count({ where: { organizationId, deletedAt: null, status: 'PUBLISHED' } }),
      this.db.enrollment.aggregate({
        where: activeEnrollmentWhere,
        _count: true,
        _avg: { progressPct: true },
      }),
      this.db.enrollment.groupBy({
        by: ['status'],
        where: activeEnrollmentWhere,
        _count: true,
      }),
      this.db.enrollment.groupBy({
        by: ['userId'],
        where: activeEnrollmentWhere,
        _count: true,
      }),
      this.db.enrollment.count({
        where: {
          ...activeEnrollmentWhere,
          OR: [{ dueAt: { not: null } }, { assignmentId: { not: null } }],
        },
      }),
      this.db.enrollment.count({
        where: {
          ...activeEnrollmentWhere,
          status: 'COMPLETED',
          OR: [{ dueAt: { not: null } }, { assignmentId: { not: null } }],
        },
      }),
      this.db.enrollment.count({
        where: { ...incompleteWhere, dueAt: { lt: now } },
      }),
      this.db.enrollment.count({
        where: { ...incompleteWhere, dueAt: { gte: now, lte: dueSoonEnd } },
      }),
      this.db.user.count({
        where: {
          ...userWhere,
          status: 'ACTIVE',
          OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: staleLoginCutoff } }],
        },
      }),
      this.db.certificate.count({
        where: this.certificateWhere(organizationId, scope, filters),
      }),
      this.db.certificate.count({
        where: this.certificateWhere(organizationId, scope, filters, range),
      }),
      this.db.enrollment.count({
        where: { ...activeEnrollmentWhere, enrolledAt: { gte: from, lte: to } },
      }),
      this.db.enrollment.count({
        where: {
          ...activeEnrollmentWhere,
          status: 'COMPLETED',
          completedAt: { gte: from, lte: to },
        },
      }),
      this.db.user.findMany({
        where: { ...userWhere, lastLoginAt: { gte: from, lte: to } },
        select: { id: true },
      }),
      this.db.progress.findMany({
        where: { enrollment: enrollmentWhere, updatedAt: { gte: from, lte: to } },
        distinct: ['enrollmentId'],
        select: { enrollment: { select: { userId: true } } },
      }),
      this.db.progress.aggregate({
        where: { enrollment: enrollmentWhere },
        _sum: { watchedSeconds: true },
      }),
      this.db.progress.aggregate({
        where: { enrollment: enrollmentWhere, updatedAt: { gte: from, lte: to } },
        _sum: { watchedSeconds: true },
      }),
      this.db.enrollment.findMany({
        where: {
          ...activeEnrollmentWhere,
          OR: [{ enrolledAt: { gte: from, lte: to } }, { completedAt: { gte: from, lte: to } }],
        },
        select: { enrolledAt: true, completedAt: true, status: true },
      }),
      this.db.enrollment.groupBy({
        by: ['courseId', 'status'],
        where: activeEnrollmentWhere,
        _count: true,
      }),
    ]);

    const completedCount = statusGroups.find((g) => g.status === 'COMPLETED')?._count ?? 0;
    const enrollmentCount = enrollmentAgg._count;
    const completionRate = enrollmentCount ? completedCount / enrollmentCount : 0;
    const averageProgressPercent = Math.round(enrollmentAgg._avg.progressPct ?? 0);
    const enrolledUserCount = enrolledUsers.length;
    const complianceRate = mandatoryTotal ? mandatoryCompleted / mandatoryTotal : 0;

    const activityUsers = new Set<string>();
    for (const row of periodLoginUsers) activityUsers.add(row.id);
    for (const row of periodProgressUsers) activityUsers.add(row.enrollment.userId);
    const periodActiveUserCount = activityUsers.size;

    const lifetimeLearningSeconds = lifetimeWatch._sum.watchedSeconds ?? 0;
    const periodLearningSeconds = periodWatch._sum.watchedSeconds ?? 0;

    const dayMap = new Map<string, { enrolled: number; completed: number }>();
    for (const e of chartEnrollments) {
      if (inRange(e.enrolledAt, range)) {
        const day = e.enrolledAt.toISOString().slice(0, 10);
        const slot = dayMap.get(day) ?? { enrolled: 0, completed: 0 };
        slot.enrolled += 1;
        dayMap.set(day, slot);
      }
      if (e.completedAt && inRange(e.completedAt, range)) {
        const day = e.completedAt.toISOString().slice(0, 10);
        const slot = dayMap.get(day) ?? { enrolled: 0, completed: 0 };
        slot.completed += 1;
        dayMap.set(day, slot);
      }
    }
    const enrollmentsOverTime = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    const courseStats = new Map<string, { enrolled: number; completed: number }>();
    for (const row of courseGroups) {
      const cur = courseStats.get(row.courseId) ?? { enrolled: 0, completed: 0 };
      cur.enrolled += row._count;
      if (row.status === 'COMPLETED') cur.completed += row._count;
      courseStats.set(row.courseId, cur);
    }
    const topCourseIds = [...courseStats.entries()]
      .sort((a, b) => b[1].enrolled - a[1].enrolled)
      .slice(0, 10)
      .map(([id]) => id);
    const courseTitles = topCourseIds.length
      ? await this.db.course.findMany({
          where: { organizationId, id: { in: topCourseIds } },
          select: { id: true, title: true },
        })
      : [];
    const titleById = new Map(courseTitles.map((c) => [c.id, c.title]));
    const topCourses = topCourseIds.map((courseId) => {
      const s = courseStats.get(courseId)!;
      return {
        courseId,
        title: titleById.get(courseId) ?? 'Course',
        enrolled: s.enrolled,
        completed: s.completed,
        completionRate: s.enrolled ? s.completed / s.enrolled : 0,
      };
    });

    const topDepartments = await this.topDepartments(organizationId, scope, filters, activeEnrollmentWhere);

    const riskAlerts: Array<{ severity: 'high' | 'medium' | 'low'; message: string }> = [];
    if (overdueCount > 0) {
      riskAlerts.push({
        severity: 'high',
        message: `${overdueCount} enrollment${overdueCount === 1 ? '' : 's'} overdue`,
      });
    }
    if (dueSoonCount > 0) {
      riskAlerts.push({
        severity: 'medium',
        message: `${dueSoonCount} enrollment${dueSoonCount === 1 ? '' : 's'} due within ${DUE_SOON_DAYS} days`,
      });
    }
    if (staleLoginCount > 0) {
      riskAlerts.push({
        severity: 'medium',
        message: `${staleLoginCount} active user${staleLoginCount === 1 ? '' : 's'} with no login in ${STALE_LOGIN_DAYS}+ days`,
      });
    }

    return {
      kpis: {
        lifetime: {
          userCount,
          activeUserCount,
          courseCount,
          publishedCourseCount,
          enrollmentCount,
          completionRate,
          certificatesIssued: lifetimeCerts,
          averageProgressPercent,
          enrolledUserCount,
          complianceRate,
          estimatedLearningHours: roundHours(lifetimeLearningSeconds),
          overdueCount,
          dueSoonCount,
          staleLoginCount,
        },
        period: {
          activeUserCount: periodActiveUserCount,
          enrollmentCount: periodEnrollmentCount,
          completionCount: periodCompletionCount,
          certificatesIssued: periodCerts,
          estimatedLearningHours: roundHours(periodLearningSeconds),
        },
      },
      enrollmentsOverTime,
      topCourses,
      topDepartments,
      riskAlerts,
    };
  }

  private async topDepartments(
    organizationId: string,
    scope: DataScope | undefined,
    filters: AnalyticsOrgFilters | undefined,
    activeEnrollmentWhere: Prisma.EnrollmentWhereInput,
  ) {
    const grouped = await this.db.enrollment.groupBy({
      by: ['userId', 'status'],
      where: activeEnrollmentWhere,
      _count: true,
    });
    if (!grouped.length) return [];
    const userIds = [...new Set(grouped.map((g) => g.userId))];
    const users = await this.db.user.findMany({
      where: {
        organizationId,
        id: { in: userIds },
        departmentId: { not: null },
        deletedAt: null,
        ...(scope?.kind === 'department' && scope.departmentId
          ? { departmentId: scope.departmentId }
          : {}),
        ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      },
      select: { id: true, department: { select: { id: true, name: true } } },
    });
    const deptByUser = new Map(users.map((u) => [u.id, u.department]));
    const deptStats = new Map<string, { name: string; enrollmentCount: number; completed: number }>();
    for (const row of grouped) {
      const dept = deptByUser.get(row.userId);
      if (!dept) continue;
      const cur = deptStats.get(dept.id) ?? { name: dept.name, enrollmentCount: 0, completed: 0 };
      cur.enrollmentCount += row._count;
      if (row.status === 'COMPLETED') cur.completed += row._count;
      deptStats.set(dept.id, cur);
    }
    return [...deptStats.entries()]
      .map(([id, s]) => ({
        id,
        name: s.name,
        enrollmentCount: s.enrollmentCount,
        completionRate: s.enrollmentCount ? s.completed / s.enrollmentCount : 0,
      }))
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
      .slice(0, 5);
  }

  async byOrgLevel(
    organizationId: string,
    level: 'DIVISION' | 'DEPARTMENT' | 'TEAM',
    scope?: DataScope,
    range?: DateRange,
    filters?: AnalyticsOrgFilters,
  ) {
    const field =
      level === 'DIVISION' ? 'divisionId' : level === 'DEPARTMENT' ? 'departmentId' : 'teamId';
    const units =
      level === 'DIVISION'
        ? await this.db.division.findMany({
            where: {
              organizationId,
              deletedAt: null,
              ...(filters?.divisionId ? { id: filters.divisionId } : {}),
            },
            select: { id: true, name: true },
          })
        : level === 'DEPARTMENT'
          ? await this.db.department.findMany({
              where: {
                organizationId,
                deletedAt: null,
                ...(scope?.kind === 'department' && scope.departmentId
                  ? { id: scope.departmentId }
                  : {}),
                ...(filters?.departmentId ? { id: filters.departmentId } : {}),
                ...(filters?.divisionId ? { divisionId: filters.divisionId } : {}),
              },
              select: { id: true, name: true },
            })
          : await this.db.team.findMany({
              where: {
                organizationId,
                deletedAt: null,
                ...(scope?.kind === 'department' && scope.departmentId
                  ? { departmentId: scope.departmentId }
                  : {}),
                ...(filters?.teamId ? { id: filters.teamId } : {}),
                ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
              },
              select: { id: true, name: true },
            });

    const [users, enrollments] = await Promise.all([
      this.db.user.findMany({
        where: this.userWhere(organizationId, scope, filters),
        select: { id: true, divisionId: true, departmentId: true, teamId: true },
      }),
      this.db.enrollment.findMany({
        where: {
          ...this.enrollmentWhere(organizationId, scope, filters),
          status: { not: 'REVOKED' },
        },
        select: { userId: true, status: true, progressPct: true, enrolledAt: true },
      }),
    ]);

    const usersByUnit = new Map<string, Array<{ id: string }>>();
    for (const u of users) {
      const key = u[field];
      if (!key) continue;
      const list = usersByUnit.get(key) ?? [];
      list.push({ id: u.id });
      usersByUnit.set(key, list);
    }
    const enrollmentsByUser = new Map<string, typeof enrollments>();
    for (const e of enrollments) {
      const list = enrollmentsByUser.get(e.userId) ?? [];
      list.push(e);
      enrollmentsByUser.set(e.userId, list);
    }

    const rows = units.map((unit) => {
      const unitUsers = usersByUnit.get(unit.id) ?? [];
      const unitEnrollments = unitUsers.flatMap((u) => enrollmentsByUser.get(u.id) ?? []);
      return { id: unit.id, name: unit.name, ...this.summarizeRows(unitUsers, unitEnrollments, range) };
    });
    return { rows };
  }

  async byRole(
    organizationId: string,
    scope?: DataScope,
    range?: DateRange,
    filters?: AnalyticsOrgFilters,
  ) {
    const users = await this.db.user.findMany({
      where: this.userWhere(organizationId, scope, filters),
      select: {
        id: true,
        roleId: true,
        role: { select: { id: true, name: true } },
      },
    });
    const roleGroups = new Map<string, { name: string; users: Array<{ id: string }> }>();
    for (const u of users) {
      const cur = roleGroups.get(u.roleId) ?? { name: u.role.name, users: [] };
      cur.users.push({ id: u.id });
      roleGroups.set(u.roleId, cur);
    }

    const rows = await Promise.all(
      [...roleGroups.entries()].map(async ([id, group]) => {
        const ids = group.users.map((u) => u.id);
        const enrollments = ids.length
          ? await this.db.enrollment.findMany({
              where: {
                organizationId,
                userId: { in: ids },
                status: { not: 'REVOKED' },
                ...(filters?.courseId ? { courseId: filters.courseId } : {}),
              },
              select: { userId: true, status: true, progressPct: true, enrolledAt: true },
            })
          : [];
        return { id, name: group.name, ...this.summarizeRows(group.users, enrollments, range) };
      }),
    );
    rows.sort((a, b) => b.enrollmentCount - a.enrollmentCount);
    return { rows };
  }

  async forUser(organizationId: string, userId: string) {
    const enrollments = await this.db.enrollment.findMany({
      where: { organizationId, userId },
      include: {
        course: { select: { id: true, title: true, status: true } },
        certificate: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });
    return {
      courses: enrollments.map((e) => ({
        courseId: e.courseId,
        title: e.course.title,
        progressPercent: Math.round(e.progressPct),
        status: e.status,
      })),
      enrollments,
    };
  }

  userCourses(organizationId: string, userId: string) {
    return this.forUser(organizationId, userId).then((r) => r.enrollments);
  }

  private complianceWhere(
    organizationId: string,
    scope?: DataScope,
    userId?: string,
  ): Prisma.EnrollmentWhereInput {
    return {
      organizationId,
      status: { in: ['ENROLLED', 'IN_PROGRESS'] },
      dueAt: { not: null },
      ...(userId ? { userId } : {}),
      ...(scope?.kind === 'department' && scope.departmentId
        ? { user: { departmentId: scope.departmentId } }
        : {}),
      ...(scope?.kind === 'self' && scope.userId ? { userId: scope.userId } : {}),
    };
  }

  private mandatoryWhere(
    organizationId: string,
    scope?: DataScope,
    userId?: string,
  ): Prisma.EnrollmentWhereInput {
    return {
      organizationId,
      status: { not: 'REVOKED' },
      OR: [{ dueAt: { not: null } }, { assignmentId: { not: null } }],
      ...(userId ? { userId } : {}),
      ...(scope?.kind === 'department' && scope.departmentId
        ? { user: { departmentId: scope.departmentId } }
        : {}),
      ...(scope?.kind === 'self' && scope.userId ? { userId: scope.userId } : {}),
    };
  }

  async compliance(
    organizationId: string,
    scope?: DataScope,
    userId?: string,
    pagination?: { page: number; pageSize: number },
  ) {
    const now = new Date();
    const dueSoonEnd = new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000);
    const expiringEnd = new Date(now.getTime() + EXPIRING_CERT_DAYS * 24 * 60 * 60 * 1000);
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const baseWhere = this.complianceWhere(organizationId, scope, userId);
    const mandatoryWhere = this.mandatoryWhere(organizationId, scope, userId);

    const [
      overdueCount,
      dueSoonCount,
      onTrackCount,
      totalItems,
      rows,
      mandatoryTotal,
      mandatoryCompleted,
      certificates,
      assignments,
      riskRows,
    ] = await Promise.all([
      this.db.enrollment.count({ where: { ...baseWhere, dueAt: { lt: now } } }),
      this.db.enrollment.count({
        where: { ...baseWhere, dueAt: { gte: now, lte: dueSoonEnd } },
      }),
      this.db.enrollment.count({ where: { ...baseWhere, dueAt: { gt: dueSoonEnd } } }),
      this.db.enrollment.count({ where: baseWhere }),
      this.db.enrollment.findMany({
        where: baseWhere,
        select: {
          id: true,
          userId: true,
          courseId: true,
          status: true,
          progressPct: true,
          dueAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              departmentId: true,
              department: { select: { id: true, name: true } },
            },
          },
          course: { select: { id: true, title: true } },
        } as Prisma.EnrollmentSelect,
        orderBy: { dueAt: 'asc' } as Prisma.EnrollmentOrderByWithRelationInput,
        skip,
        take: pageSize,
      }) as unknown as Promise<ComplianceEnrollment[]>,
      this.db.enrollment.count({ where: mandatoryWhere }),
      this.db.enrollment.count({ where: { ...mandatoryWhere, status: 'COMPLETED' } }),
      this.db.certificate.findMany({
        where: {
          organizationId,
          revokedAt: null,
          ...(userId ? { userId } : {}),
          ...(scope?.kind === 'department' && scope.departmentId
            ? { user: { departmentId: scope.departmentId } }
            : {}),
          ...(scope?.kind === 'self' && scope.userId ? { userId: scope.userId } : {}),
        },
        select: {
          id: true,
          issuedAt: true,
          expiresAt: true,
          courseId: true,
          user: { select: { firstName: true, lastName: true } },
          course: { select: { title: true } },
        },
      }),
      this.db.courseAssignment.findMany({
        where: { organizationId, recertifyEveryDays: { not: null } },
        select: { courseId: true, recertifyEveryDays: true },
      }),
      this.db.enrollment.findMany({
        where: {
          ...baseWhere,
          dueAt: { lte: dueSoonEnd },
        },
        select: {
          dueAt: true,
          user: {
            select: {
              departmentId: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    const items = rows.map((e) => {
      const dueAt = e.dueAt!;
      let complianceStatus: 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK' | 'COMPLETED' = 'ON_TRACK';
      if (dueAt < now) complianceStatus = 'OVERDUE';
      else if (dueAt <= dueSoonEnd) complianceStatus = 'DUE_SOON';
      return {
        enrollmentId: e.id,
        userId: e.userId,
        userName: `${e.user.firstName} ${e.user.lastName}`.trim(),
        courseId: e.courseId,
        courseTitle: e.course.title,
        dueAt: dueAt.toISOString(),
        status: e.status,
        progressPercent: Math.floor(e.progressPct),
        complianceStatus,
        departmentId: e.user.departmentId,
        departmentName: e.user.department?.name ?? null,
      };
    });

    const riskDeptMap = new Map<string, { name: string; overdueCount: number; dueSoonCount: number }>();
    for (const row of riskRows) {
      const dept = row.user.department;
      if (!dept || !row.dueAt) continue;
      const cur = riskDeptMap.get(dept.id) ?? { name: dept.name, overdueCount: 0, dueSoonCount: 0 };
      if (row.dueAt < now) cur.overdueCount += 1;
      else cur.dueSoonCount += 1;
      riskDeptMap.set(dept.id, cur);
    }
    const riskDepartments = [...riskDeptMap.entries()]
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => b.overdueCount + b.dueSoonCount - (a.overdueCount + a.dueSoonCount));

    const recertifyByCourse = new Map<string, number>();
    for (const a of assignments) {
      if (a.recertifyEveryDays == null) continue;
      const prev = recertifyByCourse.get(a.courseId);
      if (prev == null || a.recertifyEveryDays < prev) {
        recertifyByCourse.set(a.courseId, a.recertifyEveryDays);
      }
    }

    const expiringCerts = certificates
      .flatMap((c) => {
        const days = recertifyByCourse.get(c.courseId);
        const expiresAt =
          c.expiresAt ??
          (days != null ? new Date(c.issuedAt.getTime() + days * 24 * 60 * 60 * 1000) : null);
        if (!expiresAt || expiresAt > expiringEnd) return [];
        return [
          {
            certificateId: c.id,
            userName: `${c.user.firstName} ${c.user.lastName}`.trim(),
            courseTitle: c.course.title,
            issuedAt: c.issuedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            recertifyEveryDays: days ?? null,
          },
        ];
      })
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
      .slice(0, 50);

    return {
      overdueCount,
      dueSoonCount,
      onTrackCount,
      items,
      pagination: {
        page,
        pageSize,
        total: totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
      mandatoryTotal,
      mandatoryCompleted,
      mandatoryCompletionRate: mandatoryTotal ? mandatoryCompleted / mandatoryTotal : 0,
      riskDepartments,
      expiringCerts,
    };
  }

  async courses(
    organizationId: string,
    from: Date,
    to: Date,
    scope?: DataScope,
    filters?: AnalyticsOrgFilters,
  ) {
    const range: DateRange = { from, to };
    const staleCutoff = new Date(Date.now() - STALE_PROGRESS_DAYS * 24 * 60 * 60 * 1000);
    const enrollments = await this.db.enrollment.findMany({
      where: this.enrollmentWhere(organizationId, scope, filters),
      select: {
        status: true,
        progressPct: true,
        enrolledAt: true,
        completedAt: true,
        updatedAt: true,
        courseId: true,
        course: { select: { title: true } },
      },
    });

    const attempts = await this.db.assessmentAttempt.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        assessment: {
          organizationId,
          ...(filters?.courseId ? { courseId: filters.courseId } : {}),
        },
        ...(scope?.kind === 'department' && scope.departmentId
          ? { user: { departmentId: scope.departmentId } }
          : {}),
        ...(scope?.kind === 'self' && scope.userId ? { userId: scope.userId } : {}),
        ...(filters?.divisionId || filters?.departmentId || filters?.teamId || filters?.userId
          ? {
              user: {
                ...(filters.divisionId ? { divisionId: filters.divisionId } : {}),
                ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
                ...(filters.teamId ? { teamId: filters.teamId } : {}),
                ...(filters.userId ? { id: filters.userId } : {}),
                ...(scope?.kind === 'department' && scope.departmentId
                  ? { departmentId: scope.departmentId }
                  : {}),
              },
            }
          : {}),
      },
      select: { score: true, passed: true },
    });

    const nonRevoked = enrollments.filter((e) => e.status !== 'REVOKED');
    const completed = nonRevoked.filter((e) => e.status === 'COMPLETED' && e.completedAt);
    const completionDays = completed.map((e) => daysBetween(e.enrolledAt, e.completedAt!));
    const avgDaysToComplete = completionDays.length
      ? Math.round((completionDays.reduce((s, d) => s + d, 0) / completionDays.length) * 10) / 10
      : 0;

    const dropOff = nonRevoked.filter(
      (e) => e.status !== 'COMPLETED' && e.updatedAt < staleCutoff,
    ).length;
    const dropOffRate = nonRevoked.length ? dropOff / nonRevoked.length : 0;

    const scored = attempts.filter((a) => a.score != null);
    const passRate = attempts.length ? attempts.filter((a) => a.passed).length / attempts.length : 0;
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length)
      : 0;

    const byCourse = new Map<
      string,
      { title: string; enrolled: number; completed: number; dropOffCount: number; days: number[] }
    >();
    for (const e of nonRevoked) {
      const cur = byCourse.get(e.courseId) ?? {
        title: e.course.title,
        enrolled: 0,
        completed: 0,
        dropOffCount: 0,
        days: [],
      };
      cur.enrolled += 1;
      if (e.status === 'COMPLETED') {
        cur.completed += 1;
        if (e.completedAt) cur.days.push(daysBetween(e.enrolledAt, e.completedAt));
      } else if (e.updatedAt < staleCutoff) {
        cur.dropOffCount += 1;
      }
      byCourse.set(e.courseId, cur);
    }

    const courses = [...byCourse.entries()]
      .map(([courseId, s]) => ({
        courseId,
        title: s.title,
        enrolled: s.enrolled,
        completed: s.completed,
        completionRate: s.enrolled ? s.completed / s.enrolled : 0,
        avgDaysToComplete: s.days.length
          ? Math.round((s.days.reduce((a, b) => a + b, 0) / s.days.length) * 10) / 10
          : 0,
        dropOffCount: s.dropOffCount,
      }))
      .sort((a, b) => b.completed - a.completed);

    const inPeriod = nonRevoked.filter((e) => inRange(e.enrolledAt, range));
    const periodCompleted = inPeriod.filter((e) => e.status === 'COMPLETED').length;

    return {
      kpis: {
        lifetime: {
          enrollmentCount: nonRevoked.length,
          completionRate: nonRevoked.length ? completed.length / nonRevoked.length : 0,
          avgDaysToComplete,
          dropOffRate,
        },
        period: {
          enrollmentCount: inPeriod.length,
          completionRate: inPeriod.length ? periodCompleted / inPeriod.length : 0,
          passRate,
          avgScore,
        },
      },
      courses,
      mostCompleted: courses.slice(0, 5),
      leastCompleted: [...courses].sort((a, b) => a.completionRate - b.completionRate).slice(0, 5),
    };
  }

  async learners(
    organizationId: string,
    from: Date,
    to: Date,
    scope?: DataScope,
    filters?: AnalyticsOrgFilters,
  ) {
    const range: DateRange = { from, to };
    const now = new Date();
    const staleLoginCutoff = new Date(now.getTime() - STALE_LOGIN_DAYS * 24 * 60 * 60 * 1000);
    const userWhere = this.userWhere(organizationId, scope, filters);
    const enrollmentWhere = this.enrollmentWhere(organizationId, scope, filters);

    const [users, enrollments, progressRows] = await Promise.all([
      this.db.user.findMany({
        where: userWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          lastLoginAt: true,
        },
      }),
      this.db.enrollment.findMany({
        where: enrollmentWhere,
        select: {
          userId: true,
          status: true,
          progressPct: true,
          dueAt: true,
          enrolledAt: true,
        },
      }),
      this.db.progress.findMany({
        where: { enrollment: enrollmentWhere },
        select: {
          positionSeconds: true,
          watchedSeconds: true,
          completed: true,
          updatedAt: true,
          enrollment: { select: { userId: true } },
          lesson: { select: { durationSeconds: true } },
        },
      }),
    ]);

    const hoursByUser = new Map<string, number>();
    const periodHoursByUser = new Map<string, number>();
    const lastProgressByUser = new Map<string, Date>();
    for (const p of progressRows) {
      const uid = p.enrollment.userId;
      const seconds = progressLearningSeconds(p);
      hoursByUser.set(uid, (hoursByUser.get(uid) ?? 0) + seconds);
      if (inRange(p.updatedAt, range)) {
        periodHoursByUser.set(uid, (periodHoursByUser.get(uid) ?? 0) + seconds);
      }
      const prev = lastProgressByUser.get(uid);
      if (!prev || p.updatedAt > prev) lastProgressByUser.set(uid, p.updatedAt);
    }

    const enrollmentsByUser = new Map<string, typeof enrollments>();
    for (const e of enrollments) {
      if (e.status === 'REVOKED') continue;
      const list = enrollmentsByUser.get(e.userId) ?? [];
      list.push(e);
      enrollmentsByUser.set(e.userId, list);
    }

    let activeCount = 0;
    let last7 = 0;
    let last30 = 0;
    let staleLogin = 0;
    const sevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDays = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const learnerRows = users.map((u) => {
      const lastProgress = lastProgressByUser.get(u.id);
      const active =
        (u.lastLoginAt != null && inRange(u.lastLoginAt, range)) ||
        (lastProgress != null && inRange(lastProgress, range));
      if (active) activeCount += 1;
      if (u.lastLoginAt && u.lastLoginAt >= sevenDays) last7 += 1;
      if (u.lastLoginAt && u.lastLoginAt >= thirtyDays) last30 += 1;
      if (u.status === 'ACTIVE' && (!u.lastLoginAt || u.lastLoginAt < staleLoginCutoff)) {
        staleLogin += 1;
      }

      const mine = enrollmentsByUser.get(u.id) ?? [];
      const completedCount = mine.filter((e) => e.status === 'COMPLETED').length;
      const overdueCount = mine.filter((e) => {
        const dueAt = dueAtOf(e);
        return dueAt != null && dueAt < now && e.status !== 'COMPLETED';
      }).length;
      const avgProgress = mine.length
        ? Math.round(mine.reduce((s, e) => s + e.progressPct, 0) / mine.length)
        : 0;
      return {
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        completedCount,
        enrollmentCount: mine.length,
        avgProgress,
        overdueCount,
        estimatedHours: roundHours(hoursByUser.get(u.id) ?? 0),
        active,
      };
    });

    const nonRevoked = enrollments.filter((e) => e.status !== 'REVOKED');
    const bucketNotStarted = nonRevoked.filter((e) => e.status !== 'COMPLETED' && e.progressPct <= 0).length;
    const bucketInProgress = nonRevoked.filter((e) => e.status !== 'COMPLETED' && e.progressPct > 0).length;
    const bucketCompleted = nonRevoked.filter((e) => e.status === 'COMPLETED').length;

    const totalHours = learnerRows.reduce((s, r) => s + r.estimatedHours, 0);
    const periodHours = [...periodHoursByUser.values()].reduce((s, sec) => s + sec, 0) / 3600;

    const topPerformers = [...learnerRows]
      .filter((r) => r.enrollmentCount > 0)
      .sort((a, b) => b.completedCount - a.completedCount || b.avgProgress - a.avgProgress)
      .slice(0, 10)
      .map(({ active: _a, overdueCount: _o, ...rest }) => rest);

    const atRisk = learnerRows
      .filter(
        (r) =>
          r.overdueCount > 0 ||
          (!r.active && r.enrollmentCount > 0) ||
          (r.avgProgress > 0 && r.avgProgress < 30),
      )
      .map((r) => {
        const reasons: string[] = [];
        if (r.overdueCount > 0) reasons.push(`${r.overdueCount} overdue`);
        if (!r.active && r.enrollmentCount > 0) reasons.push('No login or progress in period');
        if (r.avgProgress > 0 && r.avgProgress < 30) reasons.push('Low progress');
        return {
          userId: r.userId,
          name: r.name,
          reason: reasons.join(' · '),
          overdueCount: r.overdueCount,
          lastLoginAt: r.lastLoginAt,
          progressPercent: r.avgProgress,
        };
      })
      .sort((a, b) => b.overdueCount - a.overdueCount)
      .slice(0, 15);

    return {
      kpis: {
        lifetime: {
          userCount: users.length,
          estimatedLearningHours: Math.round(totalHours * 10) / 10,
          avgHoursPerLearner: users.length ? Math.round((totalHours / users.length) * 10) / 10 : 0,
          lastLoginLast7Days: last7,
          lastLoginLast30Days: last30,
          staleLoginCount: staleLogin,
        },
        period: {
          activeCount,
          inactiveCount: users.length - activeCount,
          estimatedLearningHours: Math.round(periodHours * 10) / 10,
        },
      },
      buckets: {
        notStarted: bucketNotStarted,
        inProgress: bucketInProgress,
        completed: bucketCompleted,
      },
      topPerformers,
      atRisk,
    };
  }

  async assessments(
    organizationId: string,
    from: Date,
    to: Date,
    scope?: DataScope,
    filters?: AnalyticsOrgFilters,
  ) {
    const userFilter: Prisma.UserWhereInput = {
      ...(scope?.kind === 'department' && scope.departmentId
        ? { departmentId: scope.departmentId }
        : {}),
      ...(scope?.kind === 'self' && scope.userId ? { id: scope.userId } : {}),
      ...(filters?.divisionId ? { divisionId: filters.divisionId } : {}),
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters?.teamId ? { teamId: filters.teamId } : {}),
      ...(filters?.userId ? { id: filters.userId } : {}),
    };

    const attempts = await this.db.assessmentAttempt.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        assessment: {
          organizationId,
          ...(filters?.courseId ? { courseId: filters.courseId } : {}),
        },
        ...(scope?.kind === 'self' && scope.userId ? { userId: scope.userId } : {}),
        ...(filters?.userId ? { userId: filters.userId } : {}),
        ...(Object.keys(userFilter).length > 0 ? { user: userFilter } : {}),
      },
      select: {
        score: true,
        passed: true,
        attemptNumber: true,
        assessmentId: true,
        assessment: { select: { title: true } },
      },
    });

    const totalAttempts = attempts.length;
    const passed = attempts.filter((a) => a.passed).length;
    const failed = totalAttempts - passed;
    const scored = attempts.filter((a) => a.score != null);
    const retakes = attempts.filter((a) => a.attemptNumber > 1).length;

    const byAssessment = new Map<
      string,
      { title: string; attempts: number; passed: number; scoreSum: number; scored: number }
    >();
    for (const a of attempts) {
      const cur = byAssessment.get(a.assessmentId) ?? {
        title: a.assessment.title,
        attempts: 0,
        passed: 0,
        scoreSum: 0,
        scored: 0,
      };
      cur.attempts += 1;
      if (a.passed) cur.passed += 1;
      if (a.score != null) {
        cur.scoreSum += a.score;
        cur.scored += 1;
      }
      byAssessment.set(a.assessmentId, cur);
    }

    const hardest = [...byAssessment.entries()]
      .map(([assessmentId, s]) => ({
        assessmentId,
        title: s.title,
        attempts: s.attempts,
        passRate: s.attempts ? s.passed / s.attempts : 0,
        avgScore: s.scored ? Math.round(s.scoreSum / s.scored) : 0,
      }))
      .sort((a, b) => a.passRate - b.passRate || a.avgScore - b.avgScore)
      .slice(0, 8);

    return {
      kpis: {
        totalAttempts,
        passed,
        failed,
        passRate: totalAttempts ? passed / totalAttempts : 0,
        failRate: totalAttempts ? failed / totalAttempts : 0,
        avgScore: scored.length
          ? Math.round(scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length)
          : 0,
        retakeRate: totalAttempts ? retakes / totalAttempts : 0,
      },
      hardest,
    };
  }

  async engagement(
    organizationId: string,
    from: Date,
    to: Date,
    scope?: DataScope,
    filters?: AnalyticsOrgFilters,
  ) {
    const range: DateRange = { from, to };
    const userWhere = this.userWhere(organizationId, scope, filters);
    const enrollmentWhere = this.enrollmentWhere(organizationId, scope, filters);

    const users = await this.db.user.findMany({
      where: userWhere,
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (!userIds.length) {
      return {
        kpis: {
          period: { totalLogins: 0, activeUsers: 0, avgDailyActiveUsers: 0, estimatedLearningHours: 0 },
          wau: 0,
          mau: 0,
        },
        trend: [],
      };
    }

    const sevenDaysAgo = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const loginBase = { organizationId, userId: { in: userIds } as { in: string[] } };

    const [totalLogins, activeUsers, wau, mau, trend, progressRows] = await Promise.all([
      loginEventRepository.countLogins({ ...loginBase, createdAt: { gte: from, lte: to } }),
      loginEventRepository.countDistinctUsers({ ...loginBase, createdAt: { gte: from, lte: to } }),
      loginEventRepository.countDistinctUsers({ ...loginBase, createdAt: { gte: sevenDaysAgo, lte: to } }),
      loginEventRepository.countDistinctUsers({ ...loginBase, createdAt: { gte: thirtyDaysAgo, lte: to } }),
      loginEventRepository.dailyTrend(organizationId, userIds, from, to),
      this.db.progress.findMany({
        where: { enrollment: enrollmentWhere },
        select: {
          positionSeconds: true,
          watchedSeconds: true,
          completed: true,
          updatedAt: true,
          lesson: { select: { durationSeconds: true } },
        },
      }),
    ]);

    let periodLearningSeconds = 0;
    for (const p of progressRows) {
      if (!inRange(p.updatedAt, range)) continue;
      periodLearningSeconds += progressLearningSeconds(p);
    }

    const dayCount = Math.max(1, Math.ceil(daysBetween(from, to)));
    const avgDailyActiveUsers = Math.round((activeUsers / dayCount) * 10) / 10;

    return {
      kpis: {
        period: {
          totalLogins,
          activeUsers,
          avgDailyActiveUsers,
          estimatedLearningHours: roundHours(periodLearningSeconds),
        },
        wau,
        mau,
      },
      trend: trend.map((row) => ({
        date: row.day.toISOString().slice(0, 10),
        logins: row.logins,
        activeUsers: row.users,
      })),
    };
  }

  async roi(
    organizationId: string,
    from: Date,
    to: Date,
    scope?: DataScope,
    filters?: AnalyticsOrgFilters,
  ) {
    const enrollmentWhere = this.enrollmentWhere(organizationId, scope, filters);
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings = (org?.settings ?? {}) as Record<string, unknown>;
    const currency = parseTrainingCurrency(settings.trainingCurrency);
    const defaultCostCents = resolveDefaultTrainingCostMinor(settings);

    const completed = await this.db.enrollment.findMany({
      where: {
        ...enrollmentWhere,
        status: 'COMPLETED',
        completedAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        courseId: true,
        completedAt: true,
        course: { select: { id: true, title: true, costCents: true } },
      },
    });

    const byCourse = new Map<string, { courseId: string; title: string; completions: number; costCents: number; totalCents: number }>();
    let totalCostCents = 0;
    let pricedCompletions = 0;

    for (const row of completed) {
      const unitCost = row.course.costCents ?? defaultCostCents;
      if (unitCost > 0) pricedCompletions += 1;
      totalCostCents += unitCost;
      const existing = byCourse.get(row.courseId);
      if (existing) {
        existing.completions += 1;
        existing.totalCents += unitCost;
      } else {
        byCourse.set(row.courseId, {
          courseId: row.courseId,
          title: row.course.title,
          completions: 1,
          costCents: row.course.costCents ?? defaultCostCents,
          totalCents: unitCost,
        });
      }
    }

    const completions = completed.length;
    return {
      kpis: {
        completions,
        totalCostCents,
        costPerCompletionCents: completions ? Math.round(totalCostCents / completions) : 0,
        pricedCompletions,
        defaultCostCents,
        currency,
        currencyExponent: CURRENCY_MINOR_UNITS[currency as TrainingCurrency],
      },
      courses: [...byCourse.values()].sort((a, b) => b.totalCents - a.totalCents),
    };
  }
}

export const analyticsRepository = new AnalyticsRepository();
