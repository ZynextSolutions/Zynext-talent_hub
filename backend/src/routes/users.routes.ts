import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { bulkUserStatusBody, inviteUserBody, patchUserBody, uuidParam } from '../validators/schemas';
import { singleUpload } from '../middleware/single-upload';

export const usersRouter = Router();

usersRouter.get('/export', ...tenant('user:read'), userController.exportCsv);
usersRouter.post(
  '/import',
  ...tenant('user:invite'),
  singleUpload('file'),
  userController.importCsv,
);
usersRouter.post(
  '/bulk-status',
  ...tenant('user:write'),
  validate({ body: bulkUserStatusBody }),
  userController.bulkStatus,
);
usersRouter.get('/', ...tenant('user:read'), userController.list);
usersRouter.get('/:id', ...tenant('user:read'), validate({ params: uuidParam }), userController.get);
usersRouter.post('/', ...tenant('user:invite'), validate({ body: inviteUserBody }), userController.create);
usersRouter.patch(
  '/:id',
  ...tenant('user:write'),
  validate({ params: uuidParam, body: patchUserBody }),
  userController.patch,
);
usersRouter.delete('/:id', ...tenant('user:write'), validate({ params: uuidParam }), userController.remove);
usersRouter.post('/:id/resend-invite', ...tenant('user:invite'), validate({ params: uuidParam }), userController.resendInvite);
usersRouter.post('/:id/suspend', ...tenant('user:write'), validate({ params: uuidParam }), userController.suspend);
usersRouter.post('/:id/activate', ...tenant('user:write'), validate({ params: uuidParam }), userController.activate);
usersRouter.post('/:id/unlock', ...tenant('user:write'), validate({ params: uuidParam }), userController.unlock);
