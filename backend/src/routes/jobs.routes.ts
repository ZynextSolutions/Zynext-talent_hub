import { Router } from 'express';
import { jobsController } from '../controllers/jobs.controller';
import { jobAccess } from '../middleware/job-access';

export const jobsRouter = Router();

jobsRouter.post('/reminders', jobAccess, jobsController.reminders);
jobsRouter.post('/recertify', jobAccess, jobsController.recertify);
jobsRouter.post('/scheduled-reports', jobAccess, jobsController.scheduledReports);
jobsRouter.post('/cert-expiry', jobAccess, jobsController.certExpiry);
jobsRouter.post('/analytics-snapshots', jobAccess, jobsController.analyticsSnapshots);
