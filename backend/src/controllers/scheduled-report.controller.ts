import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams } from '../lib/controller';
import { scheduledReportService } from '../services/scheduled-report.service';
import { AppError } from '../errors/app-error';
import type { ReportType } from '../validators/reports.schema';

export const scheduledReportController = {
  list: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const items = await scheduledReportService.list(tenantOrgId(req));
    sendOk(res, req.requestId, items);
  }),

  create: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const body = validated<{
      reportType: ReportType;
      filters: Record<string, unknown>;
      format: 'CSV' | 'PDF';
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      recipients: string[];
      enabled?: boolean;
    }>(req);
    const item = await scheduledReportService.create(tenantOrgId(req), req.auth.sub, body);
    sendOk(res, req.requestId, item, 201);
  }),

  update: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const body = validated<{
      reportType?: ReportType;
      filters?: Record<string, unknown>;
      format?: 'CSV' | 'PDF';
      frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      recipients?: string[];
      enabled?: boolean;
    }>(req);
    const item = await scheduledReportService.update(tenantOrgId(req), id, body);
    sendOk(res, req.requestId, item);
  }),

  remove: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const result = await scheduledReportService.remove(tenantOrgId(req), id);
    sendOk(res, req.requestId, result);
  }),
};
