import { Prisma } from '@prisma/client';
import type { AnalyticsOrgFilters } from '../lib/analytics-query';
import { fillTrendGaps, formatTrendPeriod, type TrendGranularity } from '../lib/trends-bucket';
import { prisma } from '../lib/prisma';
import type { DataScope } from '../types/tenant';

type ScopeFilter = {
  userIds: string[] | null;
  departmentId?: string;
};

export class TrendsRepository {
  constructor(private db: Prisma.TransactionClient = prisma) {}

  private async resolveScope(
    organizationId: string,
    scope?: DataScope,
    filters?: AnalyticsOrgFilters,
  ): Promise<ScopeFilter> {
    const where: Prisma.UserWhereInput = {
      organizationId,
      deletedAt: null,
      ...(scope?.kind === 'department' && scope.departmentId ? { departmentId: scope.departmentId } : {}),
      ...(scope?.kind === 'self' && scope.userId ? { id: scope.userId } : {}),
      ...(filters?.divisionId ? { divisionId: filters.divisionId } : {}),
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters?.teamId ? { teamId: filters.teamId } : {}),
      ...(filters?.userId ? { id: filters.userId } : {}),
    };

    const hasExtraFilter =
      scope?.kind === 'self' ||
      scope?.kind === 'department' ||
      filters?.divisionId ||
      filters?.departmentId ||
      filters?.teamId ||
      filters?.userId;

    if (!hasExtraFilter) {
      return { userIds: null, departmentId: scope?.kind === 'department' ? scope.departmentId : undefined };
    }

    const users = await this.db.user.findMany({ where, select: { id: true } });
    return { userIds: users.map((u) => u.id) };
  }

  private userFilterSql(scope: ScopeFilter) {
    if (scope.userIds === null) return Prisma.empty;
    if (!scope.userIds.length) return Prisma.sql`AND FALSE`;
    return Prisma.sql`AND e.user_id IN (${Prisma.join(scope.userIds)})`;
  }

  private loginUserFilterSql(scope: ScopeFilter) {
    if (scope.userIds === null) return Prisma.empty;
    if (!scope.userIds.length) return Prisma.sql`AND FALSE`;
    return Prisma.sql`AND le.user_id IN (${Prisma.join(scope.userIds)})`;
  }

  async trends(
    organizationId: string,
    from: Date,
    to: Date,
    granularity: TrendGranularity,
    scope?: DataScope,
    filters?: AnalyticsOrgFilters,
    courseId?: string,
  ) {
    const scopeFilter = await this.resolveScope(organizationId, scope, filters);
    const trunc = granularity;
    const courseSql = courseId ? Prisma.sql`AND e.course_id = ${courseId}` : Prisma.empty;

    const [enrollmentRows, completionRows, engagementRows, cohortRows, trailingCompletions] =
      await Promise.all([
        this.db.$queryRaw<Array<{ period: Date; count: bigint }>>`
          SELECT date_trunc(${trunc}, e.enrolled_at) AS period, COUNT(*)::bigint AS count
          FROM enrollments e
          WHERE e.organization_id = ${organizationId}
            AND e.enrolled_at >= ${from}
            AND e.enrolled_at <= ${to}
            AND e.status <> 'REVOKED'
            ${this.userFilterSql(scopeFilter)}
            ${courseSql}
          GROUP BY 1
          ORDER BY 1
        `,
        this.db.$queryRaw<Array<{ period: Date; count: bigint }>>`
          SELECT date_trunc(${trunc}, e.completed_at) AS period, COUNT(*)::bigint AS count
          FROM enrollments e
          WHERE e.organization_id = ${organizationId}
            AND e.completed_at IS NOT NULL
            AND e.completed_at >= ${from}
            AND e.completed_at <= ${to}
            AND e.status = 'COMPLETED'
            ${this.userFilterSql(scopeFilter)}
            ${courseSql}
          GROUP BY 1
          ORDER BY 1
        `,
        this.db.$queryRaw<Array<{ period: Date; logins: bigint; users: bigint }>>`
          SELECT date_trunc(${trunc}, le.created_at) AS period,
                 COUNT(*)::bigint AS logins,
                 COUNT(DISTINCT le.user_id)::bigint AS users
          FROM login_events le
          WHERE le.organization_id = ${organizationId}
            AND le.created_at >= ${from}
            AND le.created_at <= ${to}
            ${this.loginUserFilterSql(scopeFilter)}
          GROUP BY 1
          ORDER BY 1
        `,
        this.db.$queryRaw<Array<{ cohort: Date; enrolled: bigint; completed: bigint }>>`
          SELECT date_trunc('month', e.enrolled_at) AS cohort,
                 COUNT(*)::bigint AS enrolled,
                 COUNT(*) FILTER (WHERE e.status = 'COMPLETED')::bigint AS completed
          FROM enrollments e
          WHERE e.organization_id = ${organizationId}
            AND e.enrolled_at >= ${from}
            AND e.enrolled_at <= ${to}
            AND e.status <> 'REVOKED'
            ${this.userFilterSql(scopeFilter)}
            ${courseSql}
          GROUP BY 1
          ORDER BY 1
        `,
        this.db.enrollment.count({
          where: {
            organizationId,
            status: 'COMPLETED',
            completedAt: {
              gte: new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000),
              lte: to,
            },
            ...(courseId ? { courseId } : {}),
            ...(scopeFilter.userIds
              ? { userId: { in: scopeFilter.userIds } }
              : scope?.kind === 'self' && scope.userId
                ? { userId: scope.userId }
                : {}),
          },
        }),
      ]);

    const enrollments = fillTrendGaps(
      enrollmentRows.map((r) => ({ period: r.period, value: Number(r.count) })),
      from,
      to,
      granularity,
    );
    const completions = fillTrendGaps(
      completionRows.map((r) => ({ period: r.period, value: Number(r.count) })),
      from,
      to,
      granularity,
    );
    const engagementByPeriod = new Map(
      engagementRows.map((r) => [
        formatTrendPeriod(r.period, granularity),
        { logins: Number(r.logins), activeUsers: Number(r.users) },
      ]),
    );
    const engagement = fillTrendGaps(
      engagementRows.map((r) => ({ period: r.period, value: Number(r.users) })),
      from,
      to,
      granularity,
    ).map((row) => ({
      period: row.period,
      activeUsers: engagementByPeriod.get(row.period)?.activeUsers ?? 0,
      logins: engagementByPeriod.get(row.period)?.logins ?? 0,
    }));

    const cohorts = cohortRows.map((r) => ({
      month: r.cohort.toISOString().slice(0, 7),
      enrolled: Number(r.enrolled),
      completed: Number(r.completed),
      completionRate: Number(r.enrolled) ? roundRate(Number(r.completed) / Number(r.enrolled)) : 0,
    }));

    const velocityPerWeek = roundRate(trailingCompletions / (90 / 7));
    const projectedCompletions30d = Math.round(trailingCompletions * (30 / 90));

    return {
      granularity,
      series: { enrollments, completions, engagement },
      cohorts,
      forecast: {
        trailing90dCompletions: trailingCompletions,
        velocityPerWeek,
        projectedCompletions30d,
      },
    };
  }
}

function roundRate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export const trendsRepository = new TrendsRepository();
