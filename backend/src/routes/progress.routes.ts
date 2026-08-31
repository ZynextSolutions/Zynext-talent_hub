import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { resolveTenant } from '../middleware/resolve-tenant';
import { scopeManager } from '../middleware/scope-manager';
import { requirePermission } from '../middleware/require-permission';
import { validate } from '../middleware/validate';
import { completeLessonSchema, progressLessonSchema } from '../validators/enrollment.schema';
import { progressController } from '../controllers/progress.controller';

export const progressRouter = Router();
const chain = [authenticate, resolveTenant, scopeManager];

progressRouter.put(
  '/:id/progress/lessons/:lessonId',
  ...chain,
  requirePermission('progress:write'),
  validate(progressLessonSchema),
  progressController.upsert,
);
progressRouter.post(
  '/:id/progress/lessons/:lessonId/complete',
  ...chain,
  requirePermission('progress:write'),
  validate(completeLessonSchema),
  progressController.complete,
);
