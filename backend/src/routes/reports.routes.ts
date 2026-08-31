import { Router } from 'express';
import { reportsController } from '../controllers/reports.controller';
import { scheduledReportController } from '../controllers/scheduled-report.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { reportExportQuerySchema, reportQuerySchema, reportTypeParamSchema } from '../validators/reports.schema';
import {
  createScheduledReportSchema,
  scheduledReportIdSchema,
  updateScheduledReportSchema,
} from '../validators/scheduled-report.schema';

export const reportsRouter = Router();

const read = tenant('reports:read', 'reports:read:own');
const exportPerm = tenant('reports:export');
const schedulePerm = tenant('reports:schedule');

reportsRouter.get('/schedules', ...schedulePerm, scheduledReportController.list);
reportsRouter.post('/schedules', ...schedulePerm, validate(createScheduledReportSchema), scheduledReportController.create);
reportsRouter.patch(
  '/schedules/:id',
  ...schedulePerm,
  validate(updateScheduledReportSchema),
  scheduledReportController.update,
);
reportsRouter.delete(
  '/schedules/:id',
  ...schedulePerm,
  validate(scheduledReportIdSchema),
  scheduledReportController.remove,
);

function list(path: string, handler: typeof reportsController.enrollments) {
  reportsRouter.get(path, ...read, validate(reportQuerySchema), handler);
}

function exportRoute(path: string, handler: typeof reportsController.enrollmentsExport) {
  reportsRouter.get(path, ...exportPerm, validate(reportExportQuerySchema), handler);
}

list('/enrollments', reportsController.enrollments);
exportRoute('/enrollments/export', reportsController.enrollmentsExport);

list('/completions', reportsController.completions);
exportRoute('/completions/export', reportsController.completionsExport);

list('/progress', reportsController.progress);
exportRoute('/progress/export', reportsController.progressExport);

list('/assessments', reportsController.assessments);
exportRoute('/assessments/export', reportsController.assessmentsExport);

list('/certificates', reportsController.certificates);
exportRoute('/certificates/export', reportsController.certificatesExport);

list('/overdue-training', reportsController.overdueTraining);
exportRoute('/overdue-training/export', reportsController.overdueTrainingExport);

list('/activity', reportsController.activity);
exportRoute('/activity/export', reportsController.activityExport);

reportsRouter.get(
  '/:type/export',
  ...exportPerm,
  validate({ ...reportTypeParamSchema, ...reportExportQuerySchema }),
  reportsController.exportByType,
);

reportsRouter.get(
  '/:type',
  ...read,
  validate({ ...reportTypeParamSchema, ...reportQuerySchema }),
  reportsController.byType,
);
