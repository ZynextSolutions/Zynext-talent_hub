import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { courseService } from '../services/course.service';
import { assignmentService } from '../services/assignment.service';
import { AppError } from '../errors/app-error';

export const courseController = {
  list: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const result = await courseService.list(tenantOrgId(req), validatedQuery(req), req.auth);
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),
  get: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await courseService.get(tenantOrgId(req), id, req.auth));
  }),
  create: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(res, req.requestId, await courseService.create(tenantOrgId(req), req.auth, validated(req)), 201);
  }),
  patch: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await courseService.update(tenantOrgId(req), id, req.auth, validated(req)));
  }),
  publish: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await courseService.publish(tenantOrgId(req), id, req.auth));
  }),
  archive: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await courseService.archive(tenantOrgId(req), id, req.auth));
  }),
  unarchive: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await courseService.unarchive(tenantOrgId(req), id, req.auth));
  }),
  catalog: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const result = await courseService.catalog(tenantOrgId(req), validatedQuery(req), req.auth);
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),
  selfEnroll: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const result = await courseService.selfEnroll(tenantOrgId(req), id, req.auth);
    sendOk(res, req.requestId, result, result.created ? 201 : 200);
  }),
  setPrerequisites: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(
      res,
      req.requestId,
      await courseService.setPrerequisites(
        tenantOrgId(req),
        id,
        req.auth,
        validated<{ prerequisiteCourseIds: string[] }>(req).prerequisiteCourseIds,
      ),
    );
  }),
  uploadThumbnail: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      throw AppError.from('VALIDATION_ERROR', 'Upload an image.');
    }
    const rawName = String(req.headers['x-filename'] ?? 'thumbnail.png');
    let filename = rawName;
    try {
      filename = decodeURIComponent(rawName);
    } catch {
      filename = rawName;
    }
    sendOk(
      res,
      req.requestId,
      await courseService.uploadThumbnail(tenantOrgId(req), id, req.auth, filename, req.body),
    );
  }),
  uploadIntroVideo: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      throw AppError.from('VALIDATION_ERROR', 'Upload a video.');
    }
    const rawName = String(req.headers['x-filename'] ?? 'intro.mp4');
    let filename = rawName;
    try {
      filename = decodeURIComponent(rawName);
    } catch {
      filename = rawName;
    }
    sendOk(
      res,
      req.requestId,
      await courseService.uploadIntroVideo(tenantOrgId(req), id, req.auth, filename, req.body),
    );
  }),
  duplicate: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const query = validatedQuery<{ includeAssignments?: boolean }>(req);
    sendOk(
      res,
      req.requestId,
      await courseService.duplicate(tenantOrgId(req), id, req.auth, query.includeAssignments),
      201,
    );
  }),
  listRevisions: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await courseService.listRevisions(tenantOrgId(req), id, req.auth));
  }),
  getRevision: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id, revisionId } = validatedParams<{ id: string; revisionId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await courseService.getRevision(tenantOrgId(req), id, revisionId, req.auth),
    );
  }),
  remove: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const query = validatedQuery<{ force?: boolean }>(req);
    sendOk(res, req.requestId, await courseService.remove(tenantOrgId(req), id, req.auth, query.force));
  }),
  assign: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const body = validated<{
      targetType: string;
      targetId: string;
      dueAt?: string | null;
      recertifyEveryDays?: number | null;
      reminderDaysBefore?: number | null;
    }>(req);
    const result = await assignmentService.assign({
      organizationId: tenantOrgId(req),
      courseId: id,
      targetType: body.targetType as 'ORGANIZATION' | 'DIVISION' | 'DEPARTMENT' | 'TEAM' | 'USER',
      targetId: body.targetId,
      actor: req.auth,
      scope: req.scope,
      idempotencyKey: req.get('idempotency-key') ?? undefined,
      dueAt: body.dueAt,
      recertifyEveryDays: body.recertifyEveryDays,
      reminderDaysBefore: body.reminderDaysBefore,
    });
    const payload = 'data' in result ? result.data : result;
    sendOk(res, req.requestId, payload, 201);
  }),
  listAssignments: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await assignmentService.list(tenantOrgId(req), id));
  }),
  unassign: asyncHandler(async (req, res) => {
    const { id, assignmentId } = validatedParams<{ id: string; assignmentId: string }>(req);
    sendOk(res, req.requestId, await assignmentService.unassign(tenantOrgId(req), id, assignmentId));
  }),
  patchAssignment: asyncHandler(async (req, res) => {
    const { id, assignmentId } = validatedParams<{ id: string; assignmentId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await assignmentService.patch(tenantOrgId(req), id, assignmentId, validated(req)),
    );
  }),
  addFavorite: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await courseService.addFavorite(tenantOrgId(req), id, req.auth), 201);
  }),
  removeFavorite: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await courseService.removeFavorite(tenantOrgId(req), id, req.auth));
  }),
};
