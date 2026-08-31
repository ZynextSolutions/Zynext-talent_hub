import { Router } from 'express';
import { notificationsController } from '../controllers/notifications.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { listNotificationsQuery, uuidParam } from '../validators/schemas';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  ...tenant('enrollment:read'),
  validate({ query: listNotificationsQuery }),
  notificationsController.list,
);
notificationsRouter.get(
  '/unread-count',
  ...tenant('enrollment:read'),
  notificationsController.unreadCount,
);
notificationsRouter.post(
  '/read-all',
  ...tenant('enrollment:read'),
  notificationsController.markAllRead,
);
notificationsRouter.post(
  '/:id/read',
  ...tenant('enrollment:read'),
  validate({ params: uuidParam }),
  notificationsController.markRead,
);
