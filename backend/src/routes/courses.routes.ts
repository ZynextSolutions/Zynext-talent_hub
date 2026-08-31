import { Router, raw } from 'express';
import { courseController } from '../controllers/course.controller';
import { scormController } from '../controllers/scorm.controller';
import { lessonController } from '../controllers/lesson.controller';
import { moduleController } from '../controllers/module.controller';
import { assessmentController } from '../controllers/assessment.controller';
import { forumController } from '../controllers/forum.controller';
import { sessionController } from '../controllers/session.controller';
import { skillsController } from '../controllers/phase3.controller';
import { tenant } from './_tenant';
import { validate } from '../middleware/validate';
import {
  assessmentBody,
  assignCourseBody,
  assignmentIdParam,
  patchAssignmentBody,
  catalogQuery,
  courseBody,
  courseIdParam,
  coursePrerequisitesBody,
  deleteCourseQuery,
  duplicateCourseQuery,
  courseRevisionParams,
  forumThreadBody,
  lessonBody,
  listCoursesQuery,
  listSessionsQuery,
  moduleBody,
  moduleIdParam,
  paginationQuery,
  patchCourseBody,
  patchModuleBody,
  patchSessionBody,
  reorderLessonsBody,
  reorderModulesBody,
  sessionAttendanceBody,
  sessionBody,
  sessionIdParam,
  uuidParam,
} from '../validators/schemas';

export const coursesRouter = Router();

coursesRouter.get('/', ...tenant('course:read'), validate({ query: listCoursesQuery }), courseController.list);
coursesRouter.get('/catalog', ...tenant('course:read'), validate({ query: catalogQuery }), courseController.catalog);
coursesRouter.post('/', ...tenant('course:write'), validate({ body: courseBody }), courseController.create);
coursesRouter.post('/:id/favorite', ...tenant('course:read'), validate({ params: uuidParam }), courseController.addFavorite);
coursesRouter.delete('/:id/favorite', ...tenant('course:read'), validate({ params: uuidParam }), courseController.removeFavorite);
coursesRouter.get('/:id', ...tenant('course:read'), validate({ params: uuidParam }), courseController.get);
coursesRouter.patch(
  '/:id',
  ...tenant('course:write'),
  validate({ params: uuidParam, body: patchCourseBody }),
  courseController.patch,
);
coursesRouter.delete(
  '/:id',
  ...tenant('course:write'),
  validate({ params: uuidParam, query: deleteCourseQuery }),
  courseController.remove,
);
coursesRouter.post('/:id/publish', ...tenant('course:publish'), validate({ params: uuidParam }), courseController.publish);
coursesRouter.post('/:id/archive', ...tenant('course:write'), validate({ params: uuidParam }), courseController.archive);
coursesRouter.post('/:id/unarchive', ...tenant('course:write'), validate({ params: uuidParam }), courseController.unarchive);
coursesRouter.post('/:id/enroll', ...tenant('course:read'), validate({ params: uuidParam }), courseController.selfEnroll);
coursesRouter.put(
  '/:id/prerequisites',
  ...tenant('course:write'),
  validate({ params: uuidParam, body: coursePrerequisitesBody }),
  courseController.setPrerequisites,
);
coursesRouter.post(
  '/:id/thumbnail',
  ...tenant('course:write'),
  validate({ params: uuidParam }),
  raw({ type: () => true, limit: '1mb' }),
  courseController.uploadThumbnail,
);
coursesRouter.post(
  '/:id/intro-video',
  ...tenant('course:write'),
  validate({ params: uuidParam }),
  raw({ type: () => true, limit: '80mb' }),
  courseController.uploadIntroVideo,
);
coursesRouter.post(
  '/:id/scorm',
  ...tenant('course:write'),
  validate({ params: uuidParam }),
  raw({ type: () => true, limit: '100mb' }),
  scormController.upload,
);
coursesRouter.get(
  '/:id/scorm/preview/launch',
  ...tenant('course:write'),
  validate({ params: uuidParam }),
  scormController.previewLaunch,
);
coursesRouter.post(
  '/:id/duplicate',
  ...tenant('course:write'),
  validate({ params: uuidParam, query: duplicateCourseQuery }),
  courseController.duplicate,
);
coursesRouter.get(
  '/:id/skills',
  ...tenant('course:read'),
  validate({ params: uuidParam }),
  skillsController.getCourseSkills,
);
coursesRouter.put(
  '/:id/skills',
  ...tenant('course:write'),
  validate({ params: uuidParam }),
  skillsController.setCourseSkills,
);
coursesRouter.get(
  '/:id/revisions',
  ...tenant('course:read'),
  validate({ params: uuidParam }),
  courseController.listRevisions,
);
coursesRouter.get(
  '/:id/revisions/:revisionId',
  ...tenant('course:read'),
  validate({ params: courseRevisionParams }),
  courseController.getRevision,
);

coursesRouter.post(
  '/:id/assign',
  ...tenant('course:assign'),
  validate({ params: uuidParam, body: assignCourseBody }),
  courseController.assign,
);
coursesRouter.get('/:id/assignments', ...tenant('course:assign'), validate({ params: uuidParam }), courseController.listAssignments);
coursesRouter.patch(
  '/:id/assignments/:assignmentId',
  ...tenant('course:assign'),
  validate({ params: assignmentIdParam, body: patchAssignmentBody }),
  courseController.patchAssignment,
);
coursesRouter.delete(
  '/:id/assignments/:assignmentId',
  ...tenant('course:assign'),
  validate({ params: assignmentIdParam }),
  courseController.unassign,
);

coursesRouter.get('/:courseId/modules', ...tenant('course:read'), validate({ params: courseIdParam }), moduleController.list);
coursesRouter.post(
  '/:courseId/modules',
  ...tenant('course:write'),
  validate({ params: courseIdParam, body: moduleBody }),
  moduleController.create,
);
coursesRouter.put(
  '/:courseId/modules/reorder',
  ...tenant('course:write'),
  validate({ params: courseIdParam, body: reorderModulesBody }),
  moduleController.reorder,
);
coursesRouter.patch(
  '/:courseId/modules/:moduleId',
  ...tenant('course:write'),
  validate({ params: moduleIdParam, body: patchModuleBody }),
  moduleController.patch,
);
coursesRouter.delete(
  '/:courseId/modules/:moduleId',
  ...tenant('course:write'),
  validate({ params: moduleIdParam }),
  moduleController.remove,
);

coursesRouter.get('/:courseId/lessons', ...tenant('course:read'), validate({ params: courseIdParam }), lessonController.list);
coursesRouter.post(
  '/:courseId/lessons',
  ...tenant('course:write'),
  validate({ params: courseIdParam, body: lessonBody }),
  lessonController.create,
);
coursesRouter.put(
  '/:courseId/lessons/reorder',
  ...tenant('course:write'),
  validate({ params: courseIdParam, body: reorderLessonsBody }),
  lessonController.reorder,
);

coursesRouter.get(
  '/:courseId/assessments',
  ...tenant('course:read'),
  validate({ params: courseIdParam }),
  assessmentController.list,
);
coursesRouter.post(
  '/:courseId/assessments',
  ...tenant('assessment:write'),
  validate({ params: courseIdParam, body: assessmentBody }),
  assessmentController.create,
);

coursesRouter.get(
  '/:courseId/forum/threads',
  ...tenant('course:read'),
  validate({ params: courseIdParam, query: paginationQuery }),
  forumController.listCourseThreads,
);
coursesRouter.post(
  '/:courseId/forum/threads',
  ...tenant('progress:write'),
  validate({ params: courseIdParam, body: forumThreadBody }),
  forumController.createCourseThread,
);

coursesRouter.get(
  '/:courseId/sessions',
  ...tenant('course:read'),
  validate({ params: courseIdParam, query: listSessionsQuery }),
  sessionController.list,
);
coursesRouter.post(
  '/:courseId/sessions',
  ...tenant('course:write'),
  validate({ params: courseIdParam, body: sessionBody }),
  sessionController.create,
);
coursesRouter.patch(
  '/:courseId/sessions/:sessionId',
  ...tenant('course:write'),
  validate({ params: sessionIdParam, body: patchSessionBody }),
  sessionController.patch,
);
coursesRouter.delete(
  '/:courseId/sessions/:sessionId',
  ...tenant('course:write'),
  validate({ params: sessionIdParam }),
  sessionController.remove,
);
coursesRouter.post(
  '/:courseId/sessions/:sessionId/register',
  ...tenant('progress:write'),
  validate({ params: sessionIdParam }),
  sessionController.register,
);
coursesRouter.post(
  '/:courseId/sessions/:sessionId/attendance',
  ...tenant('course:write'),
  validate({ params: sessionIdParam, body: sessionAttendanceBody }),
  sessionController.attendance,
);
coursesRouter.get(
  '/:courseId/sessions/:sessionId/registrations',
  ...tenant('course:write'),
  validate({ params: sessionIdParam }),
  sessionController.registrations,
);
