import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authenticatedRateLimit } from '../config/rate-limit';
import { authRouter } from './auth.routes';
import { platformRouter } from './platform.routes';
import { organizationsRouter } from './organizations.routes';
import { orgTreeRouter } from './org-tree.routes';
import { divisionsRouter } from './divisions.routes';
import { departmentsRouter } from './departments.routes';
import { teamsRouter } from './teams.routes';
import { usersRouter } from './users.routes';
import { coursesRouter } from './courses.routes';
import { lessonsRouter } from './lessons.routes';
import { enrollmentsRouter } from './enrollments.routes';
import { assessmentsRouter } from './assessments.routes';
import { certificatesRouter } from './certificates.routes';
import { analyticsRouter } from './analytics.routes';
import { reportsRouter } from './reports.routes';
import { questionBanksRouter } from './question-banks.routes';
import { learningPathsRouter } from './learning-paths.routes';
import { jobsRouter } from './jobs.routes';
import { notificationsRouter } from './notifications.routes';
import { announcementsRouter } from './announcements.routes';
import { forumsRouter } from './forums.routes';
import { mediaRouter } from './media.routes';
import { scormLearnRouter, scormPreviewRouter } from './scorm.routes';
import {
  auditLogsRouter,
  biRouter,
  complianceRouter,
  docsRouter,
  integrationsRouter,
  skillsRouter,
  xapiRouter,
} from './phase3.routes';
import { skillsController } from '../controllers/phase3.controller';

export { healthRouter } from './health.routes';
export { mediaRouter } from './media.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/media', mediaRouter);
apiRouter.use('/docs', docsRouter);
apiRouter.use('/bi', biRouter);
apiRouter.use('/learn/scorm', scormLearnRouter);
apiRouter.use('/learn/scorm/preview', scormPreviewRouter);
apiRouter.use('/platform', platformRouter);
apiRouter.use('/jobs', jobsRouter);
apiRouter.use(authenticate, authenticatedRateLimit);
apiRouter.use('/organizations', organizationsRouter);
apiRouter.use('/org', orgTreeRouter);
apiRouter.use('/divisions', divisionsRouter);
apiRouter.use('/departments', departmentsRouter);
apiRouter.use('/teams', teamsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/courses', coursesRouter);
apiRouter.use('/lessons', lessonsRouter);
apiRouter.use('/enrollments', enrollmentsRouter);
apiRouter.use('/assessments', assessmentsRouter);
apiRouter.use('/certificates', certificatesRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/question-banks', questionBanksRouter);
apiRouter.use('/learning-paths', learningPathsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/announcements', announcementsRouter);
apiRouter.use('/forums', forumsRouter);
apiRouter.use('/skills', skillsRouter);
apiRouter.use('/audit-logs', auditLogsRouter);
apiRouter.use('/compliance', complianceRouter);
apiRouter.use('/integrations', integrationsRouter);
apiRouter.use('/xapi', xapiRouter);

export default apiRouter;
