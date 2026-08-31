import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated } from '../lib/controller';
import { organizationService } from '../services/organization.service';
import { AppError } from '../errors/app-error';

export const organizationController = {
  current: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const data = await organizationService.current(req.auth, tenantOrgId(req));
    sendOk(res, req.requestId, data);
  }),

  patchCurrent: asyncHandler(async (req, res) => {
    const data = await organizationService.updateCurrent(tenantOrgId(req), validated(req));
    sendOk(res, req.requestId, data);
  }),

  uploadCertificateAsset: asyncHandler(async (req, res) => {
    const body = validated<{ kind: string; dataUrl: string }>(req);
    const data = await organizationService.uploadCertificateAsset(
      tenantOrgId(req),
      body.kind,
      body.dataUrl,
    );
    sendOk(res, req.requestId, data, 201);
  }),
};
