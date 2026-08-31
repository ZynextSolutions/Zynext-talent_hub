import { z } from 'zod';
import { paginationQuerySchema, idParamSchema } from './pagination.schema';

export const listDivisionsSchema = { query: paginationQuerySchema };
export const divisionIdSchema = { params: idParamSchema };
export const createDivisionSchema = {
  body: z.object({
    name: z.string().min(1).max(120),
    code: z.string().max(20).optional().nullable(),
    sortOrder: z.number().int().optional(),
  }),
};
export const patchDivisionSchema = {
  params: idParamSchema,
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    code: z.string().max(20).optional().nullable(),
    sortOrder: z.number().int().optional(),
  }),
};
export const deleteDivisionSchema = {
  params: idParamSchema,
  query: z.object({
    reassignTo: z.string().uuid().optional(),
    detachDepartments: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  }),
};
