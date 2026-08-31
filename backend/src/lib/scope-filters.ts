import type { AnalyticsOrgFilters } from './analytics-query';
import type { DataScope } from '../types/auth';
import type { Prisma } from '@prisma/client';

export function userWhere(
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

export function enrollmentWhere(
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

export function userSearchFilter(q: string): Prisma.UserWhereInput {
  return {
    OR: [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ],
  };
}
