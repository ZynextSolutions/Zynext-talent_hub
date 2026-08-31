import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId } from '../lib/controller';
import { recertifyService } from '../services/recertify.service';
import { reminderService } from '../services/reminder.service';
import { scheduledReportService } from '../services/scheduled-report.service';
import { certExpiryService } from '../services/cert-expiry.service';
import { analyticsSnapshotService } from '../services/analytics-snapshot.service';

export const jobsController = {
  recertify: asyncHandler(async (req, res) => {
    if (req.jobAllOrganizations) {
      sendOk(res, req.requestId, await recertifyService.runAllOrganizations());
      return;
    }
    sendOk(res, req.requestId, await recertifyService.run(tenantOrgId(req)));
  }),

  reminders: asyncHandler(async (req, res) => {
    if (req.jobAllOrganizations) {
      sendOk(res, req.requestId, await reminderService.runAllOrganizations());
      return;
    }
    sendOk(res, req.requestId, await reminderService.run(tenantOrgId(req)));
  }),

  scheduledReports: asyncHandler(async (req, res) => {
    if (req.jobAllOrganizations) {
      sendOk(res, req.requestId, await scheduledReportService.runAllOrganizations());
      return;
    }
    sendOk(res, req.requestId, await scheduledReportService.run(tenantOrgId(req)));
  }),

  certExpiry: asyncHandler(async (req, res) => {
    if (req.jobAllOrganizations) {
      sendOk(res, req.requestId, await certExpiryService.runAllOrganizations());
      return;
    }
    sendOk(res, req.requestId, await certExpiryService.run(tenantOrgId(req)));
  }),

  analyticsSnapshots: asyncHandler(async (req, res) => {
    if (req.jobAllOrganizations) {
      sendOk(res, req.requestId, await analyticsSnapshotService.run());
      return;
    }
    sendOk(res, req.requestId, await analyticsSnapshotService.run(tenantOrgId(req)));
  }),
};
