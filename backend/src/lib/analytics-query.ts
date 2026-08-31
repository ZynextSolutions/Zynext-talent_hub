import { AppError } from '../errors/app-error';
import type { DataScope } from '../types/auth';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;

export type AnalyticsOrgFilters = {
  divisionId?: string;
  departmentId?: string;
  teamId?: string;
  courseId?: string;
  userId?: string;
};

export type AnalyticsDateRange = { from: Date; to: Date };

function parseIsoDate(value: string, field: 'from' | 'to'): Date {
  if (!ISO_DATE_RE.test(value)) {
    throw AppError.from('VALIDATION_ERROR', `${field} must be YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T${field === 'from' ? '00:00:00.000' : '23:59:59.999'}Z`);
  if (Number.isNaN(date.getTime())) {
    throw AppError.from('VALIDATION_ERROR', `${field} is not a valid date.`);
  }
  return date;
}

export function parseAnalyticsRange(query: { from?: string; to?: string }): AnalyticsDateRange {
  const to = query.to ? parseIsoDate(query.to, 'to') : new Date();
  const from = query.from
    ? parseIsoDate(query.from, 'from')
    : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

  if (from.getTime() > to.getTime()) {
    throw AppError.from('VALIDATION_ERROR', 'from must be on or before to.');
  }

  const spanDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays > MAX_RANGE_DAYS) {
    throw AppError.from('VALIDATION_ERROR', `Date range cannot exceed ${MAX_RANGE_DAYS} days.`);
  }

  return { from, to };
}

export function pickOrgFilters(query: {
  divisionId?: string;
  departmentId?: string;
  teamId?: string;
  courseId?: string;
  userId?: string;
}): AnalyticsOrgFilters {
  return {
    ...(query.divisionId ? { divisionId: query.divisionId } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.teamId ? { teamId: query.teamId } : {}),
    ...(query.courseId ? { courseId: query.courseId } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
  };
}

export function assertFiltersInScope(scope: DataScope | undefined, filters: AnalyticsOrgFilters): void {
  if (scope?.kind === 'department' && scope.departmentId) {
    if (filters.departmentId && filters.departmentId !== scope.departmentId) {
      throw AppError.from('RBAC_SCOPE_VIOLATION');
    }
    if (filters.divisionId) {
      throw AppError.from('RBAC_SCOPE_VIOLATION');
    }
  }

  if (scope?.kind === 'self' && scope.userId) {
    if (filters.userId && filters.userId !== scope.userId) {
      throw AppError.from('RBAC_SCOPE_VIOLATION');
    }
    if (filters.divisionId || filters.departmentId || filters.teamId) {
      throw AppError.from('RBAC_SCOPE_VIOLATION');
    }
  }
}

export function assertOrgLevelAllowed(
  scope: DataScope | undefined,
  level: 'DIVISION' | 'DEPARTMENT' | 'TEAM',
): void {
  if (scope?.kind === 'self') {
    throw AppError.from('RBAC_SCOPE_VIOLATION');
  }
  if (scope?.kind === 'department' && level === 'DIVISION') {
    throw AppError.from('RBAC_SCOPE_VIOLATION');
  }
}

export function assertUserAnalyticsAccess(
  scope: DataScope | undefined,
  targetUserId: string,
  targetDepartmentId: string | null | undefined,
): void {
  if (scope?.kind === 'self') {
    if (targetUserId !== scope.userId) {
      throw AppError.from('NOT_FOUND');
    }
    return;
  }
  if (scope?.kind === 'department' && scope.departmentId) {
    if (targetDepartmentId !== scope.departmentId) {
      throw AppError.from('NOT_FOUND');
    }
  }
}
