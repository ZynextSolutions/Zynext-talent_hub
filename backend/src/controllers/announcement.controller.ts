import { AppError } from '../errors/app-error';
import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { announcementService } from '../services/announcement.service';

export const announcementController = {
  listActive: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(res, req.requestId, await announcementService.listActive(tenantOrgId(req), req.auth));
  }),

  list: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const result = await announcementService.list(tenantOrgId(req), req.auth, validatedQuery(req));
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),

  create: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(
      res,
      req.requestId,
      await announcementService.create(tenantOrgId(req), req.auth, validated(req)),
      201,
    );
  }),

  patch: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(
      res,
      req.requestId,
      await announcementService.update(tenantOrgId(req), req.auth, id, validated(req)),
    );
  }),

  remove: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await announcementService.remove(tenantOrgId(req), req.auth, id));
  }),
};
