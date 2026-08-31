import { Router } from 'express';
import { learningPathController } from '../controllers/learning-path.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { learningPathBody, pathCoursesBody, pathEnrollBody, assignPathBody, uuidParam } from '../validators/schemas';
import { z } from 'zod';

export const learningPathsRouter = Router();

learningPathsRouter.get('/', ...tenant('course:read'), learningPathController.list);
learningPathsRouter.get('/my', ...tenant('enrollment:read'), learningPathController.myEnrollments);
learningPathsRouter.get(
  '/:id/learner-progress',
  ...tenant('enrollment:read'),
  validate({ params: uuidParam }),
  learningPathController.learnerProgress,
);
learningPathsRouter.post(
  '/',
  ...tenant('learning-path:write'),
  validate({ body: learningPathBody }),
  learningPathController.create,
);
learningPathsRouter.get('/:id', ...tenant('course:read'), validate({ params: uuidParam }), learningPathController.get);
learningPathsRouter.patch(
  '/:id',
  ...tenant('learning-path:write'),
  validate({
    params: uuidParam,
    body: learningPathBody.partial().extend({
      status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    }),
  }),
  learningPathController.patch,
);
learningPathsRouter.delete(
  '/:id',
  ...tenant('learning-path:write'),
  validate({ params: uuidParam }),
  learningPathController.remove,
);
learningPathsRouter.put(
  '/:id/courses',
  ...tenant('learning-path:write'),
  validate({ params: uuidParam, body: pathCoursesBody }),
  learningPathController.setCourses,
);
learningPathsRouter.post(
  '/:id/publish',
  ...tenant('learning-path:write'),
  validate({ params: uuidParam }),
  learningPathController.publish,
);
learningPathsRouter.post(
  '/:id/assign',
  ...tenant('course:assign'),
  validate({ params: uuidParam, body: assignPathBody }),
  learningPathController.assign,
);
learningPathsRouter.get(
  '/:id/assignments',
  ...tenant('course:assign'),
  validate({ params: uuidParam }),
  learningPathController.listAssignments,
);
learningPathsRouter.post(
  '/:id/enroll',
  ...tenant('enrollment:read'),
  validate({ params: uuidParam, body: pathEnrollBody }),
  learningPathController.enroll,
);
learningPathsRouter.get(
  '/:id/enrollments',
  ...tenant('enrollment:read'),
  validate({ params: uuidParam }),
  learningPathController.listEnrollments,
);
