import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams } from '../lib/controller';
import { courseModuleService } from '../services/module.service';
import { AppError } from '../errors/app-error';

export const moduleController = {
  list: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    sendOk(res, req.requestId, await courseModuleService.list(tenantOrgId(req), courseId, req.auth));
  }),
  create: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await courseModuleService.create(tenantOrgId(req), courseId, req.auth, validated(req)),
      201,
    );
  }),
  patch: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId, moduleId } = validatedParams<{ courseId: string; moduleId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await courseModuleService.update(tenantOrgId(req), courseId, moduleId, req.auth, validated(req)),
    );
  }),
  remove: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId, moduleId } = validatedParams<{ courseId: string; moduleId: string }>(req);
    sendOk(res, req.requestId, await courseModuleService.remove(tenantOrgId(req), courseId, moduleId, req.auth));
  }),
  reorder: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    const { moduleIds } = validated<{ moduleIds: string[] }>(req);
    sendOk(res, req.requestId, await courseModuleService.reorder(tenantOrgId(req), courseId, req.auth, moduleIds));
  }),
};
