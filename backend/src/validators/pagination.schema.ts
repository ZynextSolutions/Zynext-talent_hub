import { z } from 'zod';
import { PAGE_SIZE_MAX } from '../config/constants';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
  q: z.string().optional(),
  sort: z.string().optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const courseIdParamSchema = z.object({
  courseId: z.string().uuid(),
});
