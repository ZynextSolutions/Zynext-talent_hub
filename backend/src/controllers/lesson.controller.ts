import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams } from '../lib/controller';
import { lessonService } from '../services/lesson.service';
import { AppError } from '../errors/app-error';

export const lessonController = {
  list: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    sendOk(res, req.requestId, await lessonService.list(tenantOrgId(req), courseId, req.auth));
  }),
  create: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await lessonService.create(tenantOrgId(req), courseId, req.auth, validated(req)),
      201,
    );
  }),
  patch: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await lessonService.update(tenantOrgId(req), id, req.auth, validated(req)));
  }),
  remove: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await lessonService.remove(tenantOrgId(req), id, req.auth));
  }),
  reorder: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    const { lessonIds } = validated<{ lessonIds: string[] }>(req);
    sendOk(res, req.requestId, await lessonService.reorder(tenantOrgId(req), courseId, req.auth, lessonIds));
  }),
  uploadAsset: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      throw AppError.from('VALIDATION_ERROR', 'Upload a file.');
    }
    const rawName = String(req.headers['x-filename'] ?? '');
    let filename = rawName;
    try {
      filename = decodeURIComponent(rawName);
    } catch {
      filename = rawName;
    }
    const kind = String(req.headers['x-asset-kind'] ?? '');
    sendOk(
      res,
      req.requestId,
      await lessonService.uploadAsset(tenantOrgId(req), id, req.auth, kind, filename, req.body),
    );
  }),
};
