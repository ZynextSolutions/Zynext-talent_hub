import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { divisionService } from '../services/division.service';

export const divisionController = {
  list: asyncHandler(async (req, res) => {
    const result = await divisionService.list(tenantOrgId(req), validatedQuery(req));
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),
  get: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await divisionService.get(tenantOrgId(req), id));
  }),
  create: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, await divisionService.create(tenantOrgId(req), validated(req)), 201);
  }),
  patch: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await divisionService.update(tenantOrgId(req), id, validated(req)));
  }),
  remove: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await divisionService.remove(tenantOrgId(req), id, validatedQuery(req)));
  }),
};
