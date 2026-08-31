import express, { Router } from 'express';
import { organizationController } from '../controllers/organization.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { certificateAssetBody, orgPatchBody } from '../validators/schemas';

export const organizationsRouter = Router();

organizationsRouter.get('/current', ...tenant('org:read'), organizationController.current);
organizationsRouter.patch(
  '/current',
  ...tenant('org:write'),
  validate({ body: orgPatchBody }),
  organizationController.patchCurrent,
);
organizationsRouter.post(
  '/current/certificate-assets',
  ...tenant('org:write'),
  express.json({ limit: '2.5mb' }),
  validate({ body: certificateAssetBody }),
  organizationController.uploadCertificateAsset,
);
