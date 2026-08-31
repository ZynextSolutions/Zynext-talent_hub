import { Router, raw } from 'express';
import { lessonController } from '../controllers/lesson.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { lessonBody, uuidParam } from '../validators/schemas';

export const lessonsRouter = Router();

lessonsRouter.patch(
  '/:id',
  ...tenant('course:write'),
  validate({ params: uuidParam, body: lessonBody.partial() }),
  lessonController.patch,
);
lessonsRouter.delete('/:id', ...tenant('course:write'), validate({ params: uuidParam }), lessonController.remove);
lessonsRouter.post(
  '/:id/asset',
  ...tenant('course:write'),
  validate({ params: uuidParam }),
  raw({ type: () => true, limit: '80mb' }),
  lessonController.uploadAsset,
);
