import { Router } from 'express';
import { enrollmentController } from '../controllers/enrollment.controller';
import { progressController } from '../controllers/progress.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { createEnrollmentBody, enrollmentLessonParams, progressBody, uuidParam } from '../validators/schemas';

export const enrollmentsRouter = Router();

enrollmentsRouter.get('/', ...tenant('enrollment:read'), enrollmentController.list);
enrollmentsRouter.post('/', ...tenant('enrollment:write'), validate({ body: createEnrollmentBody }), enrollmentController.create);
enrollmentsRouter.get('/:id', ...tenant('enrollment:read'), validate({ params: uuidParam }), enrollmentController.get);
enrollmentsRouter.post('/:id/revoke', ...tenant('enrollment:write'), validate({ params: uuidParam }), enrollmentController.revoke);

enrollmentsRouter.put(
  '/:id/progress/lessons/:lessonId',
  ...tenant('progress:write'),
  validate({ params: enrollmentLessonParams, body: progressBody }),
  progressController.upsert,
);
enrollmentsRouter.post(
  '/:id/progress/lessons/:lessonId/complete',
  ...tenant('progress:write'),
  validate({ params: enrollmentLessonParams }),
  progressController.complete,
);
