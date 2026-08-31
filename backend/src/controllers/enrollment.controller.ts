import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { enrollmentService } from '../services/enrollment.service';
import { AppError } from '../errors/app-error';

export const enrollmentController = {
  list: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const result = await enrollmentService.list(
      tenantOrgId(req),
      validatedQuery(req),
      req.auth,
      req.scope,
    );
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),
  get: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await enrollmentService.get(tenantOrgId(req), id, req.auth, req.scope));
  }),
  create: asyncHandler(async (req, res) => {
    sendOk(
      res,
      req.requestId,
      await enrollmentService.manualEnroll(
        tenantOrgId(req),
        validated(req),
        req.scope,
        req.get('idempotency-key') ?? undefined,
      ),
      201,
    );
  }),
  revoke: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await enrollmentService.revoke(tenantOrgId(req), id, req.scope));
  }),
};
