import { Router } from 'express';
import { z } from 'zod';
import { assessmentController } from '../controllers/assessment.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import {
  submitAssessmentBody,
  startAssessmentBody,
  gradeAttemptBody,
  patchAssessmentBody,
  uuidParam,
} from '../validators/schemas';

export const assessmentsRouter = Router();

assessmentsRouter.get(
  '/pending-review',
  ...tenant('assessment:grade'),
  assessmentController.pendingReview,
);
assessmentsRouter.get('/:id', ...tenant('course:read'), validate({ params: uuidParam }), assessmentController.get);
assessmentsRouter.patch(
  '/:id',
  ...tenant('assessment:write'),
  validate({ params: uuidParam, body: patchAssessmentBody }),
  assessmentController.patch,
);
assessmentsRouter.delete('/:id', ...tenant('assessment:write'), validate({ params: uuidParam }), assessmentController.remove);
assessmentsRouter.post(
  '/:id/start',
  ...tenant('assessment:submit'),
  validate({ params: uuidParam, body: startAssessmentBody }),
  assessmentController.start,
);
assessmentsRouter.post(
  '/:id/expire',
  ...tenant('assessment:submit'),
  validate({ params: uuidParam, body: startAssessmentBody }),
  assessmentController.expire,
);
assessmentsRouter.post(
  '/:id/submit',
  ...tenant('assessment:submit'),
  validate({ params: uuidParam, body: submitAssessmentBody }),
  assessmentController.submit,
);
assessmentsRouter.patch(
  '/attempts/:attemptId/grade',
  ...tenant('assessment:grade'),
  validate({
    params: z.object({ attemptId: z.string().uuid() }),
    body: gradeAttemptBody,
  }),
  assessmentController.grade,
);
assessmentsRouter.get('/:id/attempts', ...tenant('enrollment:read'), validate({ params: uuidParam }), assessmentController.attempts);
assessmentsRouter.get(
  '/:id/attempts/:attemptId/review',
  ...tenant('enrollment:read'),
  validate({
    params: z.object({ id: z.string().uuid(), attemptId: z.string().uuid() }),
  }),
  assessmentController.attemptReview,
);
assessmentsRouter.get(
  '/:id/survey-export',
  ...tenant('assessment:write'),
  validate({ params: uuidParam }),
  assessmentController.surveyExport,
);
