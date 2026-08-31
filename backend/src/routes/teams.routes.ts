import { Router } from 'express';
import { teamController } from '../controllers/team.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { teamBody, uuidParam } from '../validators/schemas';

export const teamsRouter = Router();

teamsRouter.get('/', ...tenant('org:read'), teamController.list);
teamsRouter.get('/:id', ...tenant('org:read'), validate({ params: uuidParam }), teamController.get);
teamsRouter.post('/', ...tenant('org:write'), validate({ body: teamBody }), teamController.create);
teamsRouter.patch(
  '/:id',
  ...tenant('org:write'),
  validate({ params: uuidParam, body: teamBody.partial() }),
  teamController.patch,
);
teamsRouter.delete('/:id', ...tenant('org:write'), validate({ params: uuidParam }), teamController.remove);
