import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams } from '../lib/controller';
import { assessmentService } from '../services/assessment.service';
import { AppError } from '../errors/app-error';

export const assessmentController = {
  list: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    sendOk(res, req.requestId, await assessmentService.listByCourse(tenantOrgId(req), courseId, req.auth));
  }),
  create: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await assessmentService.create(tenantOrgId(req), courseId, req.auth, validated(req)),
      201,
    );
  }),
  get: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await assessmentService.get(tenantOrgId(req), id, req.auth));
  }),
  patch: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(
      res,
      req.requestId,
      await assessmentService.update(tenantOrgId(req), id, req.auth, validated(req)),
    );
  }),
  remove: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await assessmentService.remove(tenantOrgId(req), id, req.auth));
  }),
  submit: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await assessmentService.submit(tenantOrgId(req), id, req.auth, validated(req)));
  }),
  attempts: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await assessmentService.attempts(tenantOrgId(req), id, req.auth));
  }),
  start: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await assessmentService.startAttempt(tenantOrgId(req), id, req.auth, validated(req)));
  }),
  expire: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await assessmentService.expireAttempt(tenantOrgId(req), id, req.auth, validated(req)));
  }),
  grade: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { attemptId } = validatedParams<{ attemptId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await assessmentService.gradeAttempt(tenantOrgId(req), attemptId, req.auth, validated(req)),
    );
  }),
  pendingReview: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(res, req.requestId, await assessmentService.pendingReview(tenantOrgId(req), req.auth));
  }),
  attemptReview: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id, attemptId } = validatedParams<{ id: string; attemptId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await assessmentService.attemptReview(tenantOrgId(req), id, attemptId, req.auth),
    );
  }),
  surveyExport: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const csv = await assessmentService.exportSurveyCsv(tenantOrgId(req), id, req.auth);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="survey-${id}.csv"`);
    res.status(200).send(csv);
  }),
};
