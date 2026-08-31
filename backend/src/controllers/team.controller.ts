import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { teamService } from '../services/team.service';

export const teamController = {
  list: asyncHandler(async (req, res) => {
    const result = await teamService.list(tenantOrgId(req), validatedQuery(req));
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),
  get: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await teamService.get(tenantOrgId(req), id));
  }),
  create: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, await teamService.create(tenantOrgId(req), validated(req)), 201);
  }),
  patch: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await teamService.update(tenantOrgId(req), id, validated(req)));
  }),
  remove: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await teamService.remove(tenantOrgId(req), id));
  }),
};
