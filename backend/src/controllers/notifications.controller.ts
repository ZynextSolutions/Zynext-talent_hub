import { AppError } from '../errors/app-error';
import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId } from '../lib/controller';
import { notificationService } from '../services/notification.service';

export const notificationsController = {
  list: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const query = (req.validated?.query ?? req.query) as {
      page?: number;
      pageSize?: number;
      unreadOnly?: boolean;
    };
    const result = await notificationService.list(tenantOrgId(req), req.auth, query);
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),

  unreadCount: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(res, req.requestId, await notificationService.unreadCount(tenantOrgId(req), req.auth));
  }),

  markRead: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = (req.validated?.params ?? req.params) as { id: string };
    sendOk(res, req.requestId, await notificationService.markRead(tenantOrgId(req), req.auth, id));
  }),

  markAllRead: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    sendOk(res, req.requestId, await notificationService.markAllRead(tenantOrgId(req), req.auth));
  }),
};
