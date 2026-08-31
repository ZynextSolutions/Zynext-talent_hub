import {
  assertFiltersInScope,
  assertOrgLevelAllowed,
  assertUserAnalyticsAccess,
  parseAnalyticsRange,
  pickOrgFilters,
  type AnalyticsOrgFilters,
} from '../lib/analytics-query';
import { AppError } from '../errors/app-error';
import { analyticsSnapshotRepository } from '../repositories/analytics-snapshot.repository';
import { analyticsRepository } from '../repositories/analytics.repository';
import { trendsRepository } from '../repositories/trends.repository';
import { userRepository } from '../repositories/user.repository';
import { toEnrollmentDto } from '../lib/mappers';
import type { AuthPrincipal, DataScope } from '../types/auth';

type DateQuery = { from?: string; to?: string };
type FilterQuery = AnalyticsOrgFilters & DateQuery;

class AnalyticsService {
  private prepareQuery(scope: DataScope | undefined, query: FilterQuery) {
    const range = parseAnalyticsRange(query);
    const filters = pickOrgFilters(query);
    assertFiltersInScope(scope, filters);
    return { range, filters };
  }

  dashboard(
    organizationId: string,
    query: FilterQuery,
    _actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    const { range, filters } = this.prepareQuery(scope, query);
    return analyticsRepository.dashboard(organizationId, range.from, range.to, scope, filters);
  }

  byOrgLevel(
    organizationId: string,
    query: FilterQuery & { level: 'DIVISION' | 'DEPARTMENT' | 'TEAM' },
    _actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    assertOrgLevelAllowed(scope, query.level);
    const { range, filters } = this.prepareQuery(scope, query);
    return analyticsRepository.byOrgLevel(organizationId, query.level, scope, range, filters);
  }

  byRole(
    organizationId: string,
    query: FilterQuery,
    _actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    const { range, filters } = this.prepareQuery(scope, query);
    return analyticsRepository.byRole(organizationId, scope, range, filters);
  }

  async userAnalytics(organizationId: string, userId: string, _actor: AuthPrincipal, scope?: DataScope) {
    const user = await userRepository.getById(organizationId, userId);
    if (!user) throw AppError.from('NOT_FOUND');
    assertUserAnalyticsAccess(scope, userId, user.departmentId);
    const rows = await analyticsRepository.userCourses(organizationId, userId);
    return rows.map((e) => ({
      ...toEnrollmentDto(e),
      course: { id: e.course.id, title: e.course.title, status: e.course.status },
      certificate: e.certificate,
    }));
  }

  compliance(
    organizationId: string,
    _actor: AuthPrincipal,
    scope?: DataScope,
    query?: { userId?: string; page?: number; pageSize?: number },
  ) {
    const effectiveUserId =
      scope?.kind === 'self' && scope.userId ? scope.userId : query?.userId;
    if (scope?.kind === 'self' && query?.userId && query.userId !== scope.userId) {
      throw AppError.from('RBAC_SCOPE_VIOLATION');
    }
    return analyticsRepository.compliance(organizationId, scope, effectiveUserId, {
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 50,
    });
  }

  courses(
    organizationId: string,
    query: FilterQuery,
    _actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    const { range, filters } = this.prepareQuery(scope, query);
    return analyticsRepository.courses(organizationId, range.from, range.to, scope, filters);
  }

  learners(
    organizationId: string,
    query: FilterQuery,
    _actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    const { range, filters } = this.prepareQuery(scope, query);
    return analyticsRepository.learners(organizationId, range.from, range.to, scope, filters);
  }

  assessments(
    organizationId: string,
    query: FilterQuery,
    _actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    const { range, filters } = this.prepareQuery(scope, query);
    return analyticsRepository.assessments(organizationId, range.from, range.to, scope, filters);
  }

  engagement(
    organizationId: string,
    query: FilterQuery,
    _actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    const { range, filters } = this.prepareQuery(scope, query);
    return analyticsRepository.engagement(organizationId, range.from, range.to, scope, filters);
  }

  trends(
    organizationId: string,
    query: FilterQuery & { granularity?: 'day' | 'week' | 'month' },
    _actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    const { range, filters } = this.prepareQuery(scope, query);
    return trendsRepository.trends(
      organizationId,
      range.from,
      range.to,
      query.granularity ?? 'week',
      scope,
      filters,
      filters.courseId,
    );
  }

  roi(
    organizationId: string,
    query: FilterQuery,
    _actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    const { range, filters } = this.prepareQuery(scope, query);
    return analyticsRepository.roi(organizationId, range.from, range.to, scope, filters);
  }

  snapshots(organizationId: string, limit = 30) {
    return analyticsSnapshotRepository.listRecent(organizationId, limit);
  }
}

export const analyticsService = new AnalyticsService();
