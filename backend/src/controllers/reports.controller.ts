import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validatedParams, validatedQuery } from '../lib/controller';
import { reportsService } from '../services/reports.service';
import { AppError } from '../errors/app-error';
import type { ReportType } from '../validators/reports.schema';

type ReportListQuery = {
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

type ExportQuery = ReportListQuery & { format?: 'csv' | 'pdf' | 'xlsx' };

function sendExport(
  res: import('express').Response,
  type: ReportType,
  format: 'csv' | 'pdf' | 'xlsx',
  payload: string | Buffer,
) {
  const ext = format === 'pdf' ? 'pdf' : format === 'xlsx' ? 'xlsx' : 'csv';
  const contentType =
    format === 'pdf'
      ? 'application/pdf'
      : format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${type}-${Date.now()}.${ext}"`);
  res.status(200).send(payload);
}

function runReport(type: ReportType) {
  return asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const query = validatedQuery<ReportListQuery>(req);
    const result = await reportsService.list(tenantOrgId(req), type, req.scope, query);
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  });
}

function runExport(type: ReportType) {
  return asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const query = validatedQuery<ExportQuery>(req);
    const format = query.format ?? 'csv';
    if (format === 'pdf') {
      const pdf = await reportsService.exportPdf(tenantOrgId(req), type, req.scope, query);
      sendExport(res, type, 'pdf', pdf);
      return;
    }
    if (format === 'xlsx') {
      const xlsx = await reportsService.exportXlsx(tenantOrgId(req), type, req.scope, query);
      sendExport(res, type, 'xlsx', xlsx);
      return;
    }
    const csv = await reportsService.exportCsv(tenantOrgId(req), type, req.scope, query);
    sendExport(res, type, 'csv', csv);
  });
}

export const reportsController = {
  enrollments: runReport('enrollments'),
  enrollmentsExport: runExport('enrollments'),
  completions: runReport('completions'),
  completionsExport: runExport('completions'),
  progress: runReport('progress'),
  progressExport: runExport('progress'),
  assessments: runReport('assessments'),
  assessmentsExport: runExport('assessments'),
  certificates: runReport('certificates'),
  certificatesExport: runExport('certificates'),
  overdueTraining: runReport('overdue-training'),
  overdueTrainingExport: runExport('overdue-training'),
  activity: runReport('activity'),
  activityExport: runExport('activity'),
  byType: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { type } = validatedParams<{ type: ReportType }>(req);
    const query = validatedQuery<ReportListQuery>(req);
    const result = await reportsService.list(tenantOrgId(req), type, req.scope, query);
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),
  exportByType: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { type } = validatedParams<{ type: ReportType }>(req);
    const query = validatedQuery<ExportQuery>(req);
    const format = query.format ?? 'csv';
    if (format === 'pdf') {
      const pdf = await reportsService.exportPdf(tenantOrgId(req), type, req.scope, query);
      sendExport(res, type, 'pdf', pdf);
      return;
    }
    if (format === 'xlsx') {
      const xlsx = await reportsService.exportXlsx(tenantOrgId(req), type, req.scope, query);
      sendExport(res, type, 'xlsx', xlsx);
      return;
    }
    const csv = await reportsService.exportCsv(tenantOrgId(req), type, req.scope, query);
    sendExport(res, type, 'csv', csv);
  }),
};
