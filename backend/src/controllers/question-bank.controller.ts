import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams } from '../lib/controller';
import { questionBankService } from '../services/question-bank.service';
import { AppError } from '../errors/app-error';

export const questionBankController = {
  list: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, await questionBankService.list(tenantOrgId(req)));
  }),
  create: asyncHandler(async (req, res) => {
    sendOk(res, req.requestId, await questionBankService.create(tenantOrgId(req), validated(req)), 201);
  }),
  get: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id } = validatedParams<{ id: string }>(req);
    const includeAnswers =
      req.auth.role === 'ORG_ADMIN' || req.auth.role === 'INSTRUCTOR' || req.auth.actorType === 'platform';
    sendOk(res, req.requestId, await questionBankService.get(tenantOrgId(req), id, includeAnswers));
  }),
  patch: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await questionBankService.update(tenantOrgId(req), id, validated(req)));
  }),
  remove: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(res, req.requestId, await questionBankService.remove(tenantOrgId(req), id));
  }),
  addQuestion: asyncHandler(async (req, res) => {
    const { id } = validatedParams<{ id: string }>(req);
    sendOk(
      res,
      req.requestId,
      await questionBankService.addQuestion(tenantOrgId(req), id, validated(req)),
      201,
    );
  }),
  removeQuestion: asyncHandler(async (req, res) => {
    const { id, questionId } = validatedParams<{ id: string; questionId: string }>(req);
    sendOk(res, req.requestId, await questionBankService.removeQuestion(tenantOrgId(req), id, questionId));
  }),
  patchQuestion: asyncHandler(async (req, res) => {
    const { id, questionId } = validatedParams<{ id: string; questionId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await questionBankService.updateQuestion(tenantOrgId(req), id, questionId, validated(req)),
    );
  }),
};
