import { z } from 'zod';
import { paginationQuerySchema, idParamSchema } from './pagination.schema';
import { mediaUrl } from './schemas';

export const listCoursesSchema = {
  query: paginationQuerySchema.extend({
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  }),
};

export const courseIdSchema = { params: idParamSchema };

export const createCourseSchema = {
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(10000).optional(),
    thumbnailUrl: mediaUrl,
    videoUrl: mediaUrl,
    scormPackageUrl: z.string().url().nullable().optional(),
    durationMinutes: z.number().int().positive().nullable().optional(),
  }),
};

export const patchCourseSchema = {
  params: idParamSchema,
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(10000).optional(),
    thumbnailUrl: mediaUrl,
    videoUrl: mediaUrl,
    scormPackageUrl: z.string().url().nullable().optional(),
    durationMinutes: z.number().int().positive().nullable().optional(),
  }),
};

export const deleteCourseSchema = {
  params: idParamSchema,
  query: z.object({
    force: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  }),
};

export const assignCourseSchema = {
  params: idParamSchema,
  body: z.object({
    targetType: z.enum(['ORGANIZATION', 'DIVISION', 'DEPARTMENT', 'TEAM', 'USER']),
    targetId: z.string().uuid(),
  }),
};

export const assignmentIdSchema = {
  params: z.object({
    id: z.string().uuid(),
    assignmentId: z.string().uuid(),
  }),
};
