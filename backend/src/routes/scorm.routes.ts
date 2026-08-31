import { Router, raw } from 'express';
import { scormController } from '../controllers/scorm.controller';
import { validate } from '../middleware/validate';
import { allowEmbedFraming } from '../middleware/allow-embed-framing';
import { z } from 'zod';

const enrollmentIdParam = z.object({ enrollmentId: z.string().uuid() });
/** Keep Express splat param `0` — plain z.object strips unknown keys. */
const enrollmentContentParams = enrollmentIdParam.passthrough();
const courseIdParam = z.object({ courseId: z.string().uuid() });
const coursePreviewContentParams = courseIdParam.passthrough();
const cmiBody = z
  .object({
    values: z.record(z.string(), z.string()),
  })
  .strict();

export const scormLearnRouter = Router();

scormLearnRouter.get(
  '/:enrollmentId/launch',
  validate({ params: enrollmentIdParam }),
  scormController.launch,
);
scormLearnRouter.get(
  '/:enrollmentId/state',
  validate({ params: enrollmentIdParam }),
  scormController.state,
);
scormLearnRouter.get(
  '/:enrollmentId/player',
  allowEmbedFraming,
  validate({ params: enrollmentIdParam }),
  scormController.player,
);
scormLearnRouter.get(
  '/:enrollmentId/content/*',
  allowEmbedFraming,
  validate({ params: enrollmentContentParams }),
  scormController.content,
);
scormLearnRouter.post(
  '/:enrollmentId/commit',
  validate({ params: enrollmentIdParam, body: cmiBody }),
  scormController.commit,
);
scormLearnRouter.post(
  '/:enrollmentId/finish',
  validate({ params: enrollmentIdParam, body: cmiBody }),
  scormController.finish,
);

export const scormPreviewRouter = Router();

scormPreviewRouter.get(
  '/:courseId/player',
  allowEmbedFraming,
  validate({ params: courseIdParam }),
  scormController.previewPlayer,
);
scormPreviewRouter.get(
  '/:courseId/content/*',
  allowEmbedFraming,
  validate({ params: coursePreviewContentParams }),
  scormController.previewContent,
);
