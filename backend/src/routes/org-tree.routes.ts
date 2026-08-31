import { Router } from 'express';
import { orgTreeController } from '../controllers/org-tree.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { moveNodeBody } from '../validators/schemas';

export const orgTreeRouter = Router();

orgTreeRouter.get('/tree', ...tenant('org:tree:read'), orgTreeController.tree);
orgTreeRouter.patch(
  '/move-node',
  ...tenant('org:move'),
  validate({ body: moveNodeBody }),
  orgTreeController.moveNode,
);
