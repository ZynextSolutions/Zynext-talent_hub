import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { departmentService } from '../services/department.service';

export const departmentController = {
  list: asyncHandler(async (req, res) => {
    const result = await departmentService.list(tenantOrgId(req), validatedQuery(req));
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),
  get: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await departmentService.get(tenantOrgId(req), id));
  }),
  create: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, await departmentService.create(tenantOrgId(req), validated(req)), 201);
  }),
  patch: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await departmentService.update(tenantOrgId(req), id, validated(req)));
  }),
  remove: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await departmentService.remove(tenantOrgId(req), id));
  }),
};
