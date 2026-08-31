import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validatedParams, validatedQuery } from '../lib/controller';
import { analyticsService } from '../services/analytics.service';
import { AppError } from '../errors/app-error';

type DateQuery = { from?: string; to?: string };

export const analyticsController = {
  dashboard: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(
      res,
      req.requestId,
      await analyticsService.dashboard(tenantOrgId(req), validatedQuery(req), req.auth, req.scope),
    );
  }),
  byOrgLevel: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const query = validatedQuery<{ level: 'DIVISION' | 'DEPARTMENT' | 'TEAM'; from?: string; to?: string }>(
      req,
    );
    sendOk(
      res,
      req.requestId,
      await analyticsService.byOrgLevel(tenantOrgId(req), query, req.auth, req.scope),
    );
  }),
  byRole: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(
      res,
      req.requestId,
      await analyticsService.byRole(tenantOrgId(req), validatedQuery<DateQuery>(req), req.auth, req.scope),
    );
  }),
  user: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(
      res,
      req.requestId,
      await analyticsService.userAnalytics(tenantOrgId(req), id, req.auth, req.scope),
    );
  }),
  compliance: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const query = validatedQuery<{ userId?: string; page?: number; pageSize?: number }>(req);
    sendOk(
      res,
      req.requestId,
      await analyticsService.compliance(tenantOrgId(req), req.auth, req.scope, query),
    );
  }),
  courses: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(
      res,
      req.requestId,
      await analyticsService.courses(tenantOrgId(req), validatedQuery<DateQuery>(req), req.auth, req.scope),
    );
  }),
  learners: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(
      res,
      req.requestId,
      await analyticsService.learners(tenantOrgId(req), validatedQuery<DateQuery>(req), req.auth, req.scope),
    );
  }),
  assessments: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(
      res,
      req.requestId,
      await analyticsService.assessments(
        tenantOrgId(req),
        validatedQuery<DateQuery>(req),
        req.auth,
        req.scope,
      ),
    );
  }),
  engagement: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(
      res,
      req.requestId,
      await analyticsService.engagement(
        tenantOrgId(req),
        validatedQuery<DateQuery>(req),
        req.auth,
        req.scope,
      ),
    );
  }),
  trends: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(
      res,
      req.requestId,
      await analyticsService.trends(
        tenantOrgId(req),
        validatedQuery<DateQuery & { granularity?: 'day' | 'week' | 'month' }>(req),
        req.auth,
        req.scope,
      ),
    );
  }),
  roi: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(
      res,
      req.requestId,
      await analyticsService.roi(tenantOrgId(req), validatedQuery<DateQuery>(req), req.auth, req.scope),
    );
  }),
  snapshots: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const query = validatedQuery<{ limit?: number }>(req);
    const rows = await analyticsService.snapshots(tenantOrgId(req), query.limit ?? 30);
    sendOk(
      res,
      req.requestId,
      rows.map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        metrics: row.metrics,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }),
};
