import { z } from 'zod';
import { paginationQuerySchema, idParamSchema } from './pagination.schema';

export const listDepartmentsSchema = {
  query: paginationQuerySchema.extend({
    divisionId: z.string().uuid().optional(),
  }),
};
export const departmentIdSchema = { params: idParamSchema };
export const createDepartmentSchema = {
  body: z.object({
    name: z.string().min(1).max(120),
    code: z.string().max(20).optional().nullable(),
    divisionId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().optional(),
  }),
};
export const patchDepartmentSchema = {
  params: idParamSchema,
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    code: z.string().max(20).optional().nullable(),
    divisionId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().optional(),
  }),
};
