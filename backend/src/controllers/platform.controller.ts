import { sendOk } from '../lib/http';
import { asyncHandler, validated, validatedParams, validatedQuery } from '../lib/controller';
import { platformService } from '../services/platform.service';

export const platformController = {
  list: asyncHandler(async (req, res) => {
    const result = await platformService.listOrganizations(validatedQuery(req));
    sendOk(
      res,
      req.requestId,
      result.items,
      200,
      {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    );
  }),

  create: asyncHandler(async (req, res) => {
    const data = await platformService.createOrganization(validated(req));
    sendOk(res, req.requestId, data, 201);
  }),

  get: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    const data = await platformService.getOrganization(id);
    sendOk(res, req.requestId, data);
  }),

  patch: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    const data = await platformService.patchOrganization(id, validated(req), req.auth!.sub);
    sendOk(res, req.requestId, data);
  }),

  remove: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    const data = await platformService.deleteOrganization(id);
    sendOk(res, req.requestId, data);
  }),

  auditLogs: asyncHandler(async (req, res) => {
    const result = await platformService.listAuditLogs(validatedQuery(req));
    sendOk(res, req.requestId, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  }),
};
