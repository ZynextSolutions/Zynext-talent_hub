import { Router } from 'express';
import { questionBankController } from '../controllers/question-bank.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import { bankQuestionBody, patchBankQuestionBody, questionBankBody, uuidParam } from '../validators/schemas';
import { z } from 'zod';

export const questionBanksRouter = Router();

questionBanksRouter.get('/', ...tenant('question-bank:write'), questionBankController.list);
questionBanksRouter.post(
  '/',
  ...tenant('question-bank:write'),
  validate({ body: questionBankBody }),
  questionBankController.create,
);
questionBanksRouter.get('/:id', ...tenant('question-bank:write'), validate({ params: uuidParam }), questionBankController.get);
questionBanksRouter.patch(
  '/:id',
  ...tenant('question-bank:write'),
  validate({ params: uuidParam, body: questionBankBody.partial() }),
  questionBankController.patch,
);
questionBanksRouter.delete(
  '/:id',
  ...tenant('question-bank:write'),
  validate({ params: uuidParam }),
  questionBankController.remove,
);
questionBanksRouter.post(
  '/:id/questions',
  ...tenant('question-bank:write'),
  validate({ params: uuidParam, body: bankQuestionBody }),
  questionBankController.addQuestion,
);
questionBanksRouter.patch(
  '/:id/questions/:questionId',
  ...tenant('question-bank:write'),
  validate({
    params: z.object({ id: z.string().uuid(), questionId: z.string().uuid() }),
    body: patchBankQuestionBody,
  }),
  questionBankController.patchQuestion,
);
questionBanksRouter.delete(
  '/:id/questions/:questionId',
  ...tenant('question-bank:write'),
  validate({ params: z.object({ id: z.string().uuid(), questionId: z.string().uuid() }) }),
  questionBankController.removeQuestion,
);
