import { Router } from 'express';
import { divisionController } from '../controllers/division.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { nameBody, uuidParam } from '../validators/schemas';

export const divisionsRouter = Router();

divisionsRouter.get('/', ...tenant('org:read'), divisionController.list);
divisionsRouter.get('/:id', ...tenant('org:read'), validate({ params: uuidParam }), divisionController.get);
divisionsRouter.post('/', ...tenant('org:write'), validate({ body: nameBody }), divisionController.create);
divisionsRouter.patch(
  '/:id',
  ...tenant('org:write'),
  validate({ params: uuidParam, body: nameBody.partial() }),
  divisionController.patch,
);
divisionsRouter.delete('/:id', ...tenant('org:write'), validate({ params: uuidParam }), divisionController.remove);
