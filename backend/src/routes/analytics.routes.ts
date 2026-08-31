import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { skillsController } from '../controllers/phase3.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { uuidParam } from '../validators/schemas';
import {
  analyticsDateRangeSchema,
  analyticsLevelSchema,
  analyticsQuerySchema,
  analyticsSnapshotsSchema,
  analyticsTrendsSchema,
  complianceQuerySchema,
} from '../validators/analytics.schema';

export const analyticsRouter = Router();

analyticsRouter.get(
  '/dashboard',
  ...tenant('analytics:read'),
  validate(analyticsQuerySchema),
  analyticsController.dashboard,
);
analyticsRouter.get(
  '/by-org-level',
  ...tenant('analytics:read'),
  validate(analyticsLevelSchema),
  analyticsController.byOrgLevel,
);
analyticsRouter.get(
  '/by-role',
  ...tenant('analytics:read'),
  validate(analyticsDateRangeSchema),
  analyticsController.byRole,
);
analyticsRouter.get(
  '/compliance',
  ...tenant('analytics:read', 'compliance:read'),
  validate(complianceQuerySchema),
  analyticsController.compliance,
);
analyticsRouter.get(
  '/courses',
  ...tenant('analytics:read'),
  validate(analyticsDateRangeSchema),
  analyticsController.courses,
);
analyticsRouter.get(
  '/learners',
  ...tenant('analytics:read'),
  validate(analyticsDateRangeSchema),
  analyticsController.learners,
);
analyticsRouter.get(
  '/engagement',
  ...tenant('analytics:read'),
  validate(analyticsDateRangeSchema),
  analyticsController.engagement,
);
analyticsRouter.get(
  '/trends',
  ...tenant('analytics:read'),
  validate(analyticsTrendsSchema),
  analyticsController.trends,
);
analyticsRouter.get('/skills', ...tenant('skills:read'), skillsController.analytics);
analyticsRouter.get(
  '/roi',
  ...tenant('analytics:read'),
  validate(analyticsDateRangeSchema),
  analyticsController.roi,
);
analyticsRouter.get(
  '/snapshots',
  ...tenant('analytics:read'),
  validate(analyticsSnapshotsSchema),
  analyticsController.snapshots,
);
analyticsRouter.get(
  '/assessments',
  ...tenant('analytics:read'),
  validate(analyticsDateRangeSchema),
  analyticsController.assessments,
);
analyticsRouter.get(
  '/users/:id',
  ...tenant('analytics:read'),
  validate({ params: uuidParam }),
  analyticsController.user,
);
