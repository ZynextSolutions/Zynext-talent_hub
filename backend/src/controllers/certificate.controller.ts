import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { certificateService } from '../services/certificate.service';
import { AppError } from '../errors/app-error';

export const certificateController = {
  list: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const result = await certificateService.list(
      tenantOrgId(req),
      validatedQuery(req),
      req.scope,
      req.auth.sub,
      req.auth.role,
    );
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),
  get: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(
      res,
      req.requestId,
      await certificateService.get(tenantOrgId(req), id, req.auth, req.scope),
    );
  }),
  getByNumber: asyncHandler(async (req, res) => {
    const { certificateNumber } = validatedParams<{ certificateNumber: string }>(req);
    sendOk(res, req.requestId, await certificateService.getByNumber(certificateNumber));
  }),
  revoke: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const { reason } = validated<{ reason: string }>(req);
    sendOk(
      res,
      req.requestId,
      await certificateService.revoke(tenantOrgId(req), id, reason, req.auth, req.scope),
    );
  }),
};
