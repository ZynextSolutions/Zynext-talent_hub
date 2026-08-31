import { Router } from 'express';
import { platformController } from '../controllers/platform.controller';
import { authenticate } from '../middleware/authenticate';
import { requirePlatform } from '../middleware/require-platform';
import { validate } from '../middleware/validate';
import { platformCreateOrgBody, platformPatchOrgBody, uuidParam } from '../validators/schemas';

export const platformRouter = Router();

platformRouter.use(authenticate, requirePlatform);

platformRouter.get('/organizations', platformController.list);
platformRouter.post('/organizations', validate({ body: platformCreateOrgBody }), platformController.create);
platformRouter.get('/organizations/:id', validate({ params: uuidParam }), platformController.get);
platformRouter.patch(
  '/organizations/:id',
  validate({ params: uuidParam, body: platformPatchOrgBody }),
  platformController.patch,
);
platformRouter.delete('/organizations/:id', validate({ params: uuidParam }), platformController.remove);
platformRouter.get('/audit-logs', platformController.auditLogs);
