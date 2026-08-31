import { Router } from 'express';
import { certificateController } from '../controllers/certificate.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { certificateVerifyRateLimit } from '../config/rate-limit';
import {
  certificateNumberSchema,
  listCertificatesSchema,
  revokeCertificateSchema,
} from '../validators/analytics.schema';

export const certificatesRouter = Router();

certificatesRouter.get(
  '/number/:certificateNumber',
  certificateVerifyRateLimit,
  validate(certificateNumberSchema),
  certificateController.getByNumber,
);

certificatesRouter.get(
  '/',
  ...tenant('certificate:read'),
  validate(listCertificatesSchema),
  certificateController.list,
);
certificatesRouter.get(
  '/:id',
  ...tenant('certificate:read'),
  validate({ params: revokeCertificateSchema.params }),
  certificateController.get,
);
certificatesRouter.post(
  '/:id/revoke',
  ...tenant('certificate:revoke'),
  validate(revokeCertificateSchema),
  certificateController.revoke,
);
