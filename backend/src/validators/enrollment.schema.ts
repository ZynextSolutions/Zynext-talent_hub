import { z } from 'zod';
import { paginationQuerySchema, idParamSchema } from './pagination.schema';

export const listEnrollmentsSchema = {
  query: paginationQuerySchema.extend({
    userId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    status: z.enum(['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'REVOKED']).optional(),
  }),
};

export const enrollmentIdSchema = { params: idParamSchema };

export const createEnrollmentSchema = {
  body: z.object({
    userId: z.string().uuid(),
    courseId: z.string().uuid(),
    dueAt: z.string().datetime().nullable().optional(),
  }),
};

export const progressLessonSchema = {
  params: z.object({
    id: z.string().uuid(),
    lessonId: z.string().uuid(),
  }),
  body: z.object({
    completed: z.boolean().optional(),
    positionSeconds: z.number().int().nonnegative().optional(),
  }),
};

export const completeLessonSchema = {
  params: z.object({
    id: z.string().uuid(),
    lessonId: z.string().uuid(),
  }),
};
