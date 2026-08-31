import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams } from '../lib/controller';
import { progressService } from '../services/progress.service';
import { AppError } from '../errors/app-error';

export const progressController = {
  upsert: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id, lessonId } = validatedParams<{ id: string; lessonId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await progressService.upsertLesson(tenantOrgId(req), id, lessonId, req.auth, validated(req)),
    );
  }),
  complete: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { id, lessonId } = validatedParams<{ id: string; lessonId: string }>(req);
    sendOk(
      res,
      req.requestId,
      await progressService.completeLesson(tenantOrgId(req), id, lessonId, req.auth),
    );
  }),
};
