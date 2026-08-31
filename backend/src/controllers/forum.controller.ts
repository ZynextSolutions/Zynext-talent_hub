import { AppError } from '../errors/app-error';
import { sendOk } from '../lib/http';
import { asyncHandler, tenantOrgId, validated, validatedParams, validatedQuery } from '../lib/controller';
import { forumService } from '../services/forum.service';

export const forumController = {
  listOrgThreads: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const query = validatedQuery<{ page?: number; pageSize?: number }>(req);
    const result = await forumService.listThreads(tenantOrgId(req), req.auth, {
      ...query,
      scope: 'ORGANIZATION',
    });
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),

  createOrgThread: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const body = validated<{ title: string; body: string }>(req);
    sendOk(
      res,
      req.requestId,
      await forumService.createThread(tenantOrgId(req), req.auth, {
        scope: 'ORGANIZATION',
        title: body.title,
        body: body.body,
      }),
      201,
    );
  }),

  listCourseThreads: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    const query = validatedQuery<{ page?: number; pageSize?: number }>(req);
    const result = await forumService.listThreads(tenantOrgId(req), req.auth, {
      ...query,
      scope: 'COURSE',
      courseId,
    });
    sendOk(res, req.requestId, result.items, 200, result.pagination);
  }),

  createCourseThread: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { courseId } = validatedParams<{ courseId: string }>(req);
    const body = validated<{ title: string; body: string; lessonId?: string }>(req);
    sendOk(
      res,
      req.requestId,
      await forumService.createThread(tenantOrgId(req), req.auth, {
        scope: 'COURSE',
        courseId,
        lessonId: body.lessonId,
        title: body.title,
        body: body.body,
      }),
      201,
    );
  }),

  getThread: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { threadId } = validatedParams<{ threadId: string }>(req);
    sendOk(res, req.requestId, await forumService.getThread(tenantOrgId(req), req.auth, threadId));
  }),

  createPost: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { threadId } = validatedParams<{ threadId: string }>(req);
    const body = validated<{ body: string }>(req);
    sendOk(
      res,
      req.requestId,
      await forumService.createPost(tenantOrgId(req), req.auth, threadId, body.body),
      201,
    );
  }),

  pinThread: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { threadId } = validatedParams<{ threadId: string }>(req);
    const body = validated<{ pinned: boolean }>(req);
    sendOk(
      res,
      req.requestId,
      await forumService.pinThread(tenantOrgId(req), req.auth, threadId, body.pinned),
    );
  }),

  removeThread: asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.from('AUTH_MISSING_TOKEN');
    const { threadId } = validatedParams<{ threadId: string }>(req);
    sendOk(res, req.requestId, await forumService.removeThread(tenantOrgId(req), req.auth, threadId));
  }),
};
