import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .optional();

export const analyticsOrgFilterSchema = z.object({
  divisionId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

export const analyticsQuerySchema = {
  query: analyticsOrgFilterSchema.extend({
    from: isoDate,
    to: isoDate,
  }),
};

export const analyticsLevelSchema = {
  query: analyticsOrgFilterSchema.extend({
    level: z.enum(['DIVISION', 'DEPARTMENT', 'TEAM']),
    from: isoDate,
    to: isoDate,
  }),
};

export const analyticsDateRangeSchema = {
  query: analyticsOrgFilterSchema.extend({
    from: isoDate,
    to: isoDate,
  }),
};

export const analyticsTrendsSchema = {
  query: analyticsOrgFilterSchema.extend({
    from: isoDate,
    to: isoDate,
    granularity: z.enum(['day', 'week', 'month']).default('week'),
  }),
};

export const analyticsSnapshotsSchema = {
  query: z.object({
    limit: z.coerce.number().int().min(1).max(90).default(30),
  }),
};

export const complianceQuerySchema = {
  query: paginationQuerySchema.extend({
    userId: z.string().uuid().optional(),
  }),
};

export const listCertificatesSchema = {
  query: paginationQuerySchema.extend({
    userId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
  }),
};

export const revokeCertificateSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    reason: z.string().min(1).max(500),
  }),
};

export const certificateNumberSchema = {
  params: z.object({ certificateNumber: z.string().min(3) }),
};
