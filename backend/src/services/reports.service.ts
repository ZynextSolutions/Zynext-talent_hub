import { AppError } from '../errors/app-error';
import { toCsv } from '../lib/csv';
import { buildReportPdf } from '../lib/pdf-report';
import { buildReportXlsx } from '../lib/xlsx-report';
import {
  assertFiltersInScope,
  parseAnalyticsRange,
  pickOrgFilters,
} from '../lib/analytics-query';
import { paginationMeta, parsePagination, parseSort, toSkipTake } from '../lib/pagination';
import { reportsRepository } from '../repositories/reports.repository';
import type { DataScope } from '../types/auth';
import type { ReportType } from '../validators/reports.schema';

const EXPORT_MAX = 10_000;

const SORT_FIELDS: Record<ReportType, string[]> = {
  enrollments: ['enrolledAt', 'learnerName', 'courseTitle', 'status', 'progressPct', 'dueAt'],
  completions: ['completedAt', 'learnerName', 'courseTitle'],
  progress: ['progressPct', 'learnerName', 'courseTitle', 'lastActivityAt'],
  assessments: ['submittedAt', 'score', 'learnerName', 'assessmentTitle'],
  certificates: ['issuedAt', 'learnerName', 'courseTitle', 'expiresAt'],
  'overdue-training': ['dueAt', 'daysOverdue', 'learnerName', 'courseTitle'],
  activity: ['lastLoginAt', 'learnerName', 'activeEnrollments'],
};

const DEFAULT_SORT: Record<ReportType, string> = {
  enrollments: 'enrolledAt:desc',
  completions: 'completedAt:desc',
  progress: 'progressPct:desc',
  assessments: 'submittedAt:desc',
  certificates: 'issuedAt:desc',
  'overdue-training': 'dueAt:asc',
  activity: 'lastLoginAt:desc',
};

type ListQuery = {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  divisionId?: string;
  departmentId?: string;
  teamId?: string;
  courseId?: string;
  userId?: string;
  status?: string;
  certStatus?: 'active' | 'revoked' | 'expiring' | 'expired';
  sort?: string;
  q?: string;
};

class ReportsService {
  private prepare(type: ReportType, scope: DataScope | undefined, query: ListQuery, exportAll = false) {
    const filters = pickOrgFilters(query);
    assertFiltersInScope(scope, filters);

    let from: Date | undefined;
    let to: Date | undefined;
    if (query.from || query.to) {
      const range = parseAnalyticsRange({ from: query.from, to: query.to });
      from = range.from;
      to = range.to;
    }

    const pg = parsePagination(query.page, query.pageSize);
    const sort = parseSort(query.sort, SORT_FIELDS[type], DEFAULT_SORT[type]);
    const { skip, take } = exportAll
      ? { skip: 0, take: EXPORT_MAX }
      : toSkipTake(pg);

    return {
      reportQuery: {
        ...filters,
        from,
        to,
        status: query.status,
        certStatus: query.certStatus,
        q: query.q?.trim() || undefined,
        skip,
        take,
        sortField: sort.field,
        sortDirection: sort.direction,
      },
      pg,
    };
  }

  async list(organizationId: string, type: ReportType, scope: DataScope | undefined, query: ListQuery) {
    const { reportQuery, pg } = this.prepare(type, scope, query);
    const { items, total } = await reportsRepository.list(organizationId, type, scope, reportQuery);
    return { items, pagination: paginationMeta(pg.page, pg.pageSize, total) };
  }

  async exportCsv(
    organizationId: string,
    type: ReportType,
    scope: DataScope | undefined,
    query: ListQuery,
  ): Promise<string> {
    const { items } = await this.fetchExportItems(organizationId, type, scope, query);
    return this.itemsToCsv(type, items);
  }

  async exportPdf(
    organizationId: string,
    type: ReportType,
    scope: DataScope | undefined,
    query: ListQuery,
  ): Promise<Buffer> {
    const { items } = await this.fetchExportItems(organizationId, type, scope, query);
    const { headers, rows } = this.reportTable(type, items);
    return buildReportPdf(`${type} report`, headers, rows);
  }

  async exportXlsx(
    organizationId: string,
    type: ReportType,
    scope: DataScope | undefined,
    query: ListQuery,
  ): Promise<Buffer> {
    const { items } = await this.fetchExportItems(organizationId, type, scope, query);
    const { headers, rows } = this.reportTable(type, items);
    return buildReportXlsx(`${type} report`, headers, rows);
  }

  async exportBuffer(
    organizationId: string,
    type: ReportType,
    scope: DataScope | undefined,
    query: ListQuery,
    format: 'csv' | 'pdf' | 'xlsx',
  ) {
    if (format === 'pdf') {
      const buffer = await this.exportPdf(organizationId, type, scope, query);
      return { buffer, ext: 'pdf', mime: 'application/pdf' };
    }
    if (format === 'xlsx') {
      const buffer = await this.exportXlsx(organizationId, type, scope, query);
      return {
        buffer,
        ext: 'xlsx',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    const csv = await this.exportCsv(organizationId, type, scope, query);
    return { buffer: Buffer.from(csv, 'utf8'), ext: 'csv', mime: 'text/csv; charset=utf-8' };
  }

  private async fetchExportItems(
    organizationId: string,
    type: ReportType,
    scope: DataScope | undefined,
    query: ListQuery,
  ) {
    const { reportQuery } = this.prepare(type, scope, query, true);
    const { items, total } = await reportsRepository.list(organizationId, type, scope, reportQuery);
    if (total > EXPORT_MAX) {
      throw AppError.from(
        'VALIDATION_ERROR',
        `Export limited to ${EXPORT_MAX} rows. Narrow filters or use pagination.`,
      );
    }
    return { items, total };
  }

  private reportTable(type: ReportType, items: unknown[]) {
    const rows = items as Array<Record<string, string | number | boolean | null | undefined>>;
    const cell = (value: string | number | boolean | null | undefined): string | number =>
      value === true ? 'yes' : value === false ? 'no' : (value ?? '');

    switch (type) {
      case 'enrollments':
        return {
          headers: ['Learner', 'Email', 'Department', 'Course', 'Enrolled', 'Status', 'Progress %', 'Due'],
          rows: rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.enrolledAt),
            cell(r.status),
            cell(r.progressPercent),
            cell(r.dueAt),
          ]),
        };
      case 'completions':
        return {
          headers: ['Learner', 'Email', 'Department', 'Course', 'Completed', 'Days', 'Certificate #'],
          rows: rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.completedAt),
            cell(r.daysToComplete),
            cell(r.certificateNumber),
          ]),
        };
      case 'progress':
        return {
          headers: [
            'Learner',
            'Email',
            'Department',
            'Course',
            'Progress %',
            'Status',
            'Last activity',
            'Lessons done',
            'Lessons total',
          ],
          rows: rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.progressPercent),
            cell(r.status),
            cell(r.lastActivityAt),
            cell(r.lessonsCompleted),
            cell(r.lessonsTotal),
          ]),
        };
      case 'assessments':
        return {
          headers: [
            'Learner',
            'Email',
            'Department',
            'Course',
            'Assessment',
            'Attempt',
            'Score',
            'Passed',
            'Submitted',
          ],
          rows: rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.assessmentTitle),
            cell(r.attemptNumber),
            cell(r.score),
            cell(r.passed),
            cell(r.submittedAt),
          ]),
        };
      case 'certificates':
        return {
          headers: ['Learner', 'Email', 'Department', 'Course', 'Certificate #', 'Issued', 'Expires', 'Status'],
          rows: rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.certificateNumber),
            cell(r.issuedAt),
            cell(r.expiresAt),
            cell(r.status),
          ]),
        };
      case 'overdue-training':
        return {
          headers: ['Learner', 'Email', 'Department', 'Course', 'Due', 'Days overdue', 'Progress %', 'Status'],
          rows: rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.dueAt),
            cell(r.daysOverdue),
            cell(r.progressPercent),
            cell(r.status),
          ]),
        };
      case 'activity':
        return {
          headers: [
            'Learner',
            'Email',
            'Department',
            'Last login',
            'Logins in period',
            'Active enrollments',
            'Est. hours',
          ],
          rows: rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.lastLoginAt),
            cell(r.loginsInPeriod),
            cell(r.activeEnrollments),
            cell(r.estimatedHours),
          ]),
        };
      default:
        return { headers: [], rows: [] };
    }
  }

  private itemsToCsv(type: ReportType, items: unknown[]): string {
    type CsvRow = Array<string | number | null | undefined>;
    const rows = items as Array<Record<string, string | number | boolean | null | undefined>>;
    const cell = (value: string | number | boolean | null | undefined): string | number | null | undefined =>
      value === true ? 'yes' : value === false ? 'no' : value;

    switch (type) {
      case 'enrollments':
        return toCsv(
          [
            'Learner',
            'Email',
            'Department',
            'Course',
            'Enrolled',
            'Status',
            'Progress %',
            'Due',
          ],
          rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.enrolledAt),
            cell(r.status),
            cell(r.progressPercent),
            cell(r.dueAt),
          ] satisfies CsvRow),
        );
      case 'completions':
        return toCsv(
          ['Learner', 'Email', 'Department', 'Course', 'Completed', 'Days', 'Certificate #'],
          rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.completedAt),
            cell(r.daysToComplete),
            cell(r.certificateNumber),
          ] satisfies CsvRow),
        );
      case 'progress':
        return toCsv(
          [
            'Learner',
            'Email',
            'Department',
            'Course',
            'Progress %',
            'Status',
            'Last activity',
            'Lessons done',
            'Lessons total',
          ],
          rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.progressPercent),
            cell(r.status),
            cell(r.lastActivityAt),
            cell(r.lessonsCompleted),
            cell(r.lessonsTotal),
          ] satisfies CsvRow),
        );
      case 'assessments':
        return toCsv(
          [
            'Learner',
            'Email',
            'Department',
            'Course',
            'Assessment',
            'Attempt',
            'Score',
            'Passed',
            'Submitted',
          ],
          rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.assessmentTitle),
            cell(r.attemptNumber),
            cell(r.score),
            cell(r.passed),
            cell(r.submittedAt),
          ] satisfies CsvRow),
        );
      case 'certificates':
        return toCsv(
          ['Learner', 'Email', 'Department', 'Course', 'Certificate #', 'Issued', 'Expires', 'Status'],
          rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.certificateNumber),
            cell(r.issuedAt),
            cell(r.expiresAt),
            cell(r.status),
          ] satisfies CsvRow),
        );
      case 'overdue-training':
        return toCsv(
          ['Learner', 'Email', 'Department', 'Course', 'Due', 'Days overdue', 'Progress %', 'Status'],
          rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.courseTitle),
            cell(r.dueAt),
            cell(r.daysOverdue),
            cell(r.progressPercent),
            cell(r.status),
          ] satisfies CsvRow),
        );
      case 'activity':
        return toCsv(
          ['Learner', 'Email', 'Department', 'Last login', 'Logins in period', 'Active enrollments', 'Est. hours'],
          rows.map((r) => [
            cell(r.learnerName),
            cell(r.learnerEmail),
            cell(r.departmentName),
            cell(r.lastLoginAt),
            cell(r.loginsInPeriod),
            cell(r.activeEnrollments),
            cell(r.estimatedHours),
          ] satisfies CsvRow),
        );
      default:
        return '';
    }
  }
}

export const reportsService = new ReportsService();
