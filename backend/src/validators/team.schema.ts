import { z } from 'zod';
import { paginationQuerySchema, idParamSchema } from './pagination.schema';

export const listTeamsSchema = {
  query: paginationQuerySchema.extend({
    departmentId: z.string().uuid().optional(),
  }),
};
export const teamIdSchema = { params: idParamSchema };
export const createTeamSchema = {
  body: z.object({
    name: z.string().min(1).max(120),
    departmentId: z.string().uuid(),
    code: z.string().max(20).optional().nullable(),
    sortOrder: z.number().int().optional(),
  }),
};
export const patchTeamSchema = {
  params: idParamSchema,
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    code: z.string().max(20).optional().nullable(),
    sortOrder: z.number().int().optional(),
    departmentId: z.string().uuid().optional(),
  }),
};
