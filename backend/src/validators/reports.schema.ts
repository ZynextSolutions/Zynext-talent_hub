import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema';
import { analyticsOrgFilterSchema } from './analytics.schema';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .optional();

export const reportQuerySchema = {
  query: paginationQuerySchema.merge(analyticsOrgFilterSchema).extend({
    from: isoDate,
    to: isoDate,
    status: z.string().optional(),
    certStatus: z.enum(['active', 'revoked', 'expiring', 'expired']).optional(),
    sort: z.string().optional(),
  }),
};

export const reportExportQuerySchema = {
  query: reportQuerySchema.query.extend({
    format: z.enum(['csv', 'pdf', 'xlsx']).default('csv'),
  }),
};

export const REPORT_TYPES = [
  'enrollments',
  'completions',
  'progress',
  'assessments',
  'certificates',
  'overdue-training',
  'activity',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const reportTypeParamSchema = {
  params: z.object({
    type: z.enum(REPORT_TYPES),
  }),
};
