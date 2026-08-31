import { Router } from 'express';
import { departmentController } from '../controllers/department.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { departmentBody, uuidParam } from '../validators/schemas';

export const departmentsRouter = Router();

departmentsRouter.get('/', ...tenant('org:read'), departmentController.list);
departmentsRouter.get('/:id', ...tenant('org:read'), validate({ params: uuidParam }), departmentController.get);
departmentsRouter.post('/', ...tenant('org:write'), validate({ body: departmentBody }), departmentController.create);
departmentsRouter.patch(
  '/:id',
  ...tenant('org:write'),
  validate({ params: uuidParam, body: departmentBody.partial() }),
  departmentController.patch,
);
departmentsRouter.delete('/:id', ...tenant('org:write'), validate({ params: uuidParam }), departmentController.remove);
