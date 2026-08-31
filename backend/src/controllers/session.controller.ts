import { AppError } from '../errors/app-error';
import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { sessionService } from '../services/session.service';

export const sessionController = {
  list: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await sessionService.list(tenantOrgId(req), courseId, validatedQuery(req), req.auth),
    );
  }),

  create: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await sessionService.create(tenantOrgId(req), courseId, req.auth, validated(req)),
      201,
    );
  }),

  patch: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId, sessionId } = validatedParams<{ courseId: string; sessionId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await sessionService.update(tenantOrgId(req), courseId, sessionId, req.auth, validated(req)),
    );
  }),

  remove: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId, sessionId } = validatedParams<{ courseId: string; sessionId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await sessionService.remove(tenantOrgId(req), courseId, sessionId, req.auth),
    );
  }),

  register: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId, sessionId } = validatedParams<{ courseId: string; sessionId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await sessionService.register(tenantOrgId(req), courseId, sessionId, req.auth),
      201,
    );
  }),

  attendance: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId, sessionId } = validatedParams<{ courseId: string; sessionId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await sessionService.markAttendance(tenantOrgId(req), courseId, sessionId, req.auth, validated(req)),
    );
  }),

  registrations: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId, sessionId } = validatedParams<{ courseId: string; sessionId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await sessionService.getRegistrations(tenantOrgId(req), courseId, sessionId, req.auth),
    );
  }),
};
