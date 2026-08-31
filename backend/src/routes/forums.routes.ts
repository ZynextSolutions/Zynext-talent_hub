import { Router } from 'express';
import { forumController } from '../controllers/forum.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import {
  forumPinBody,
  forumPostBody,
  forumThreadBody,
  paginationQuery,
  threadIdParam,
} from '../validators/schemas';

export const forumsRouter = Router();

forumsRouter.get(
  '/threads',
  ...tenant('course:read'),
  validate({ query: paginationQuery }),
  forumController.listOrgThreads,
);
forumsRouter.post(
  '/threads',
  ...tenant('course:read'),
  validate({ body: forumThreadBody }),
  forumController.createOrgThread,
);
forumsRouter.get(
  '/threads/:threadId',
  ...tenant('course:read'),
  validate({ params: threadIdParam }),
  forumController.getThread,
);
forumsRouter.post(
  '/threads/:threadId/posts',
  ...tenant('course:read'),
  validate({ params: threadIdParam, body: forumPostBody }),
  forumController.createPost,
);
forumsRouter.post(
  '/threads/:threadId/pin',
  ...tenant('org:write', 'course:write'),
  validate({ params: threadIdParam, body: forumPinBody }),
  forumController.pinThread,
);
forumsRouter.delete(
  '/threads/:threadId',
  ...tenant('course:read'),
  validate({ params: threadIdParam }),
  forumController.removeThread,
);
