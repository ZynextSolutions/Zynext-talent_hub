import { z } from 'zod';
import { mediaUrl } from './schemas';

export const listLessonsSchema = {
  params: z.object({ courseId: z.string().uuid() }),
};

export const createLessonSchema = {
  params: z.object({ courseId: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional().nullable(),
    kind: z.enum(['VIDEO', 'READING', 'DOCUMENT', 'QUIZ', 'DISCUSSION']).optional(),
    content: z.string().max(200000).optional().nullable(),
    videoUrl: mediaUrl,
    resourceUrl: mediaUrl,
    durationSeconds: z.number().int().nonnegative().optional().nullable(),
    order: z.number().int().nonnegative().optional(),
    moduleId: z.string().uuid().optional().nullable(),
  }),
};

export const patchLessonSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    kind: z.enum(['VIDEO', 'READING', 'DOCUMENT', 'QUIZ', 'DISCUSSION']).optional(),
    content: z.string().max(200000).optional().nullable(),
    videoUrl: mediaUrl,
    resourceUrl: mediaUrl,
    durationSeconds: z.number().int().nonnegative().optional().nullable(),
    moduleId: z.string().uuid().optional().nullable(),
  }),
};

export const reorderLessonsSchema = {
  params: z.object({ courseId: z.string().uuid() }),
  body: z.object({
    lessonIds: z.array(z.string().uuid()).min(1),
  }),
};
