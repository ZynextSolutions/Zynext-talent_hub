import { z } from 'zod';
import { paginationQuerySchema, idParamSchema } from './pagination.schema';
import { ROLE_NAMES } from '../domain/roles';

export const listUsersSchema = {
  query: paginationQuerySchema.extend({
    role: z.enum(ROLE_NAMES).optional(),
    status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
    divisionId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional(),
  }),
};

export const userIdSchema = { params: idParamSchema };

export const createUserSchema = {
  body: z.object({
    email: z.string().email(),
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    role: z.enum(ROLE_NAMES),
    teamId: z.string().uuid(),
  }),
};

export const patchUserSchema = {
  params: idParamSchema,
  body: z.object({
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    role: z.enum(ROLE_NAMES).optional(),
    teamId: z.string().uuid().optional(),
    status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  }),
};
