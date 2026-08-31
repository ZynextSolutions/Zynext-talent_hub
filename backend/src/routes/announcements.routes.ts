import { Router } from 'express';
import { announcementController } from '../controllers/announcement.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import {
  announcementBody,
  listAnnouncementsQuery,
  patchAnnouncementBody,
  uuidParam,
} from '../validators/schemas';

export const announcementsRouter = Router();

announcementsRouter.get(
  '/active',
  ...tenant('course:read'),
  announcementController.listActive,
);
announcementsRouter.get(
  '/',
  ...tenant('course:read'),
  validate({ query: listAnnouncementsQuery }),
  announcementController.list,
);
announcementsRouter.post(
  '/',
  ...tenant('org:write', 'course:write'),
  validate({ body: announcementBody }),
  announcementController.create,
);
announcementsRouter.patch(
  '/:id',
  ...tenant('org:write', 'course:write'),
  validate({ params: uuidParam, body: patchAnnouncementBody }),
  announcementController.patch,
);
announcementsRouter.delete(
  '/:id',
  ...tenant('org:write', 'course:write'),
  validate({ params: uuidParam }),
  announcementController.remove,
);
