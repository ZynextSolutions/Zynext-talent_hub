import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { userService } from '../services/user.service';
import { AppError } from '../errors/app-error';

export const userController = {
  list: asyncHandler(async (req, res) => {
    const result = await userService.list(tenantOrgId(req), validatedQuery(req), req.scope);
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),
  get: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await userService.get(tenantOrgId(req), id, req.auth, req.scope));
  }),
  create: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(
      res,
      req.requestId,
      await userService.invite(tenantOrgId(req), validated(req), req.auth, req.scope),
      201,
    );
  }),
  patch: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(
      res,
      req.requestId,
      await userService.update(tenantOrgId(req), id, validated(req), req.auth, req.scope),
    );
  }),
  remove: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await userService.remove(tenantOrgId(req), id, req.auth, req.scope));
  }),
  resendInvite: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await userService.resendInvite(tenantOrgId(req), id, req.auth, req.scope));
  }),
  suspend: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(
      res,
      req.requestId,
      await userService.setStatus(tenantOrgId(req), id, 'SUSPENDED', req.auth, req.scope),
    );
  }),
  activate: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(
      res,
      req.requestId,
      await userService.setStatus(tenantOrgId(req), id, 'ACTIVE', req.auth, req.scope),
    );
  }),
  unlock: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await userService.unlock(tenantOrgId(req), id, req.scope));
  }),
  bulkStatus: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const body = validated<{ userIds: string[]; status: 'ACTIVE' | 'SUSPENDED' }>(req);
    sendOk(
      res,
      req.requestId,
      await userService.bulkSetStatus(tenantOrgId(req), body.userIds, body.status, req.auth, req.scope),
    );
  }),
  exportCsv: asyncHandler(async (req, res) => {
    const csv = await userService.exportCsv(tenantOrgId(req), req.scope);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.status(200).send(csv);
  }),
  importCsv: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const file = req.file;
    if (!file?.buffer?.length) throw AppError.from('VALIDATION_ERROR', 'Upload a CSV file.');
    const text = file.buffer.toString('utf8');
    sendOk(
      res,
      req.requestId,
      await userService.importCsv(tenantOrgId(req), text, req.auth, req.scope),
    );
  }),
};
