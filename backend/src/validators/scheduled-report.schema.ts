import { z } from 'zod';
import { analyticsOrgFilterSchema } from './analytics.schema';
import { REPORT_TYPES } from './reports.schema';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .optional();

export const scheduledReportFiltersSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    status: z.string().optional(),
    certStatus: z.enum(['active', 'revoked', 'expiring', 'expired']).optional(),
    q: z.string().optional(),
  })
  .merge(analyticsOrgFilterSchema);

export const createScheduledReportSchema = {
  body: z.object({
    reportType: z.enum(REPORT_TYPES),
    filters: scheduledReportFiltersSchema.default({}),
    format: z.enum(['CSV', 'PDF', 'XLSX']).default('CSV'),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    recipients: z.array(z.string().email()).min(1).max(20),
    enabled: z.boolean().optional(),
  }),
};

export const updateScheduledReportSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: createScheduledReportSchema.body.partial(),
};

export const scheduledReportIdSchema = {
  params: z.object({ id: z.string().uuid() }),
};
