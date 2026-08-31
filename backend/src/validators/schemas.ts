import { z } from 'zod';
import { isUploadPath } from '../lib/url';

export const mediaUrl = z
  .string()
  .max(500)
  .refine((value) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (isUploadPath(trimmed)) return true;
    try {
      return new URL(trimmed).protocol === 'https:';
    } catch {
      return false;
    }
  }, { message: 'Must be an https URL or an uploaded file.' })
  .nullable()
  .optional();

export const uuidParam = z.object({ id: z.string().uuid() });
export const courseIdParam = z.object({ courseId: z.string().uuid() });
export const lessonIdParam = z.object({ id: z.string().uuid() });
export const assignmentIdParam = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
});
export const enrollmentLessonParams = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid(),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().optional(),
  sort: z.string().optional(),
});

export const registerBody = z.object({
  organizationName: z.string().min(2).max(120),
  organizationSlug: z.string().min(3).max(48),
  admin: z.object({
    email: z.string().email(),
    password: z.string().min(12).max(128),
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
  }),
});

export const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationSlug: z.string().min(1),
});

export const platformLoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshBody = z.object({
  refreshToken: z.string().min(10).optional(),
});

export const logoutBody = z.object({
  refreshToken: z.string().optional(),
});

export const patchMeBody = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  avatarUrl: mediaUrl,
}).strict();

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128),
  revokeOthers: z.boolean().optional(),
});

export const forgotPasswordBody = z.object({
  email: z.string().email(),
  organizationSlug: z.string().min(1),
});

export const resetPasswordBody = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(12).max(128),
});

export const acceptInviteBody = z.object({
  token: z.string().min(10),
  password: z.string().min(12).max(128),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
});

export const moveNodeBody = z.object({
  nodeType: z.enum(['DEPARTMENT', 'TEAM', 'USER']),
  nodeId: z.string().uuid(),
  targetParentType: z.enum(['ORGANIZATION', 'DIVISION', 'DEPARTMENT', 'TEAM']),
  targetParentId: z.string().uuid().optional(),
});

export const nameBody = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(32).optional(),
  sortOrder: z.number().optional(),
  divisionId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().optional(),
});

export const departmentBody = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(32).optional(),
  divisionId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().optional(),
});

export const teamBody = z.object({
  name: z.string().min(1).max(120),
  departmentId: z.string().uuid(),
  code: z.string().max(32).optional(),
  sortOrder: z.number().optional(),
});

export const inviteUserBody = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  role: z.enum(['ORG_ADMIN', 'MANAGER', 'INSTRUCTOR', 'EMPLOYEE']),
  teamId: z.string().uuid(),
});

export const patchUserBody = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  role: z.enum(['ORG_ADMIN', 'MANAGER', 'INSTRUCTOR', 'EMPLOYEE']).optional(),
  teamId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED']).optional(),
}).strict();

export const courseBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  thumbnailUrl: mediaUrl,
  videoUrl: mediaUrl,
  scormPackageUrl: z.string().url().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  costCents: z.number().int().nonnegative().nullable().optional(),
  availableFrom: z.string().datetime().nullable().optional(),
  availableUntil: z.string().datetime().nullable().optional(),
  completionMode: z.enum(['ALL_LESSONS', 'REQUIRED_LESSONS', 'PERCENTAGE']).optional(),
  completionPercent: z.number().int().min(1).max(100).nullable().optional(),
  requirePreAssessment: z.boolean().optional(),
}).strict();

export const patchCourseBody = courseBody.partial().strict();

export const listCoursesQuery = paginationQuery.extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

export const catalogQuery = paginationQuery.extend({
  availability: z.enum(['open', 'upcoming']).optional(),
  enrolled: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === 'true' ? true : value === 'false' ? false : undefined)),
  prerequisitesMet: z
    .enum(['true'])
    .optional()
    .transform((value) => value === 'true'),
  duration: z.enum(['short', 'medium', 'long']).optional(),
});

export const deleteCourseQuery = z.object({
  force: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const duplicateCourseQuery = z.object({
  includeAssignments: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const courseRevisionParams = z.object({
  id: z.string().uuid(),
  revisionId: z.string().uuid(),
});

export const lessonKind = z.enum(['VIDEO', 'READING', 'DOCUMENT', 'QUIZ', 'DISCUSSION', 'SCORM', 'ILT', 'VILT']);

export const lessonBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  kind: lessonKind.optional(),
  content: z.string().max(200000).optional().nullable(),
  videoUrl: mediaUrl,
  resourceUrl: mediaUrl,
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  required: z.boolean().optional(),
  prerequisiteLessonId: z.string().uuid().nullable().optional(),
  order: z.number().int().min(0).optional(),
  moduleId: z.string().uuid().nullable().optional(),
});

export const moduleBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
});

export const patchModuleBody = moduleBody.partial().strict();

export const moduleIdParam = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid(),
});

export const reorderModulesBody = z.object({
  moduleIds: z.array(z.string().uuid()).min(1),
});

export const reorderLessonsBody = z.object({
  lessonIds: z.array(z.string().uuid()).min(1),
});

export const coursePrerequisitesBody = z.object({
  prerequisiteCourseIds: z.array(z.string().uuid()),
});

export const assignCourseBody = z.object({
  targetType: z.enum(['ORGANIZATION', 'DIVISION', 'DEPARTMENT', 'TEAM', 'USER']),
  targetId: z.string().uuid(),
  dueAt: z.string().datetime().nullable().optional(),
  recertifyEveryDays: z.number().int().min(1).nullable().optional(),
  reminderDaysBefore: z.number().int().min(0).nullable().optional(),
});

export const patchAssignmentBody = z.object({
  dueAt: z.string().datetime().nullable().optional(),
  recertifyEveryDays: z.number().int().min(1).nullable().optional(),
  reminderDaysBefore: z.number().int().min(0).nullable().optional(),
}).strict();

const questionInput = z.object({
  prompt: z.string().min(1),
  type: z
    .enum(['MCQ', 'TRUE_FALSE', 'MULTI_SELECT', 'SHORT_ANSWER', 'FILL_BLANK', 'MATCHING', 'ESSAY'])
    .optional(),
  options: z.array(z.string().min(1)).optional(),
  correctOptionIndex: z.number().int().min(0).optional(),
  correctOptionIndices: z.array(z.number().int().min(0)).optional(),
  points: z.number().int().min(1).max(100).optional(),
  explanation: z.string().max(2000).optional(),
  difficulty: z.string().max(40).optional(),
  blanks: z
    .array(
      z.object({
        acceptableAnswers: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
  pairs: z
    .array(
      z.object({
        left: z.string().min(1),
        right: z.string().min(1),
      }),
    )
    .optional(),
  minWords: z.number().int().min(1).optional(),
  maxWords: z.number().int().min(1).optional(),
});

export const assessmentBody = z.object({
  title: z.string().min(1).max(200),
  kind: z.enum(['PRE', 'FINAL', 'SURVEY', 'MODULE_QUIZ']).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  maxAttempts: z.number().int().min(1).nullable().optional(),
  timeLimitSeconds: z.number().int().min(60).nullable().optional(),
  bankId: z.string().uuid().nullable().optional(),
  drawCount: z.number().int().min(1).nullable().optional(),
  drawTags: z.array(z.string().min(1).max(40)).optional(),
  lessonId: z.string().uuid().nullable().optional(),
  anonymous: z.boolean().optional(),
  questions: z.array(questionInput).optional(),
}).refine(
  (v) => Boolean(v.bankId) || (v.questions && v.questions.length > 0),
  { message: 'Provide questions or a question bank' },
).refine(
  (v) => v.kind !== 'MODULE_QUIZ' || Boolean(v.lessonId),
  { message: 'lessonId is required for module quiz' },
);

export const patchAssessmentBody = z
  .object({
    title: z.string().min(1).max(200).optional(),
    passingScore: z.number().int().min(0).max(100).optional(),
    maxAttempts: z.number().int().min(1).nullable().optional(),
    timeLimitSeconds: z.number().int().min(60).nullable().optional(),
    bankId: z.string().uuid().nullable().optional(),
    drawCount: z.number().int().min(1).nullable().optional(),
    drawTags: z.array(z.string().min(1).max(40)).optional(),
    questions: z.array(questionInput).min(1).optional(),
  })
  .strict();

export const startAssessmentBody = z.object({
  enrollmentId: z.string().uuid(),
});

export const submitAssessmentBody = z.object({
  enrollmentId: z.string().uuid(),
  attemptId: z.string().uuid().optional(),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      optionId: z.string().min(1).optional(),
      optionIds: z.array(z.string().min(1)).optional(),
      text: z.string().optional(),
      blanks: z
        .array(
          z.object({
            blankId: z.string().min(1),
            text: z.string(),
          }),
        )
        .optional(),
      matches: z
        .array(
          z.object({
            leftId: z.string().min(1),
            rightId: z.string().min(1),
          }),
        )
        .optional(),
    }),
  ),
});

export const gradeAttemptBody = z.object({
  score: z.number().int().min(0).max(100),
  passed: z.boolean(),
  instructorFeedback: z.string().max(2000).optional(),
});

export const questionBankBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
});

export const bankQuestionBody = z.object({
  question: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  type: z
    .enum(['MCQ', 'TRUE_FALSE', 'MULTI_SELECT', 'SHORT_ANSWER', 'FILL_BLANK', 'MATCHING', 'ESSAY'])
    .optional(),
  options: z.array(z.string().min(1)).optional(),
  correctOptionIndex: z.number().int().min(0).optional(),
  correctOptionIndices: z.array(z.number().int().min(0)).optional(),
  tags: z.array(z.string()).optional(),
  points: z.number().int().min(1).max(100).optional(),
  explanation: z.string().max(2000).optional(),
  difficulty: z.string().max(40).optional(),
  blanks: z
    .array(
      z.object({
        acceptableAnswers: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
  pairs: z
    .array(
      z.object({
        left: z.string().min(1),
        right: z.string().min(1),
      }),
    )
    .optional(),
  minWords: z.number().int().min(1).optional(),
  maxWords: z.number().int().min(1).optional(),
}).refine((v) => Boolean(v.question?.trim() || v.prompt?.trim()), {
  message: 'question or prompt is required',
});

export const patchBankQuestionBody = z.object({
  question: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  type: z
    .enum(['MCQ', 'TRUE_FALSE', 'MULTI_SELECT', 'SHORT_ANSWER', 'FILL_BLANK', 'MATCHING', 'ESSAY'])
    .optional(),
  options: z.array(z.string().min(1)).optional(),
  correctOptionIndex: z.number().int().min(0).optional(),
  correctOptionIndices: z.array(z.number().int().min(0)).optional(),
  tags: z.array(z.string()).optional(),
  points: z.number().int().min(1).max(100).optional(),
  explanation: z.string().max(2000).optional(),
  difficulty: z.string().max(40).optional(),
  blanks: z
    .array(
      z.object({
        acceptableAnswers: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
  pairs: z
    .array(
      z.object({
        left: z.string().min(1),
        right: z.string().min(1),
      }),
    )
    .optional(),
  minWords: z.number().int().min(1).optional(),
  maxWords: z.number().int().min(1).optional(),
});

export const learningPathBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
});

export const pathCoursesBody = z.object({
  courses: z.array(
    z.object({
      courseId: z.string().uuid(),
      orderIndex: z.number().int().min(0),
      required: z.boolean().optional(),
    }),
  ),
});

export const assignPathBody = z.object({
  targetType: z.enum(['ORGANIZATION', 'DIVISION', 'DEPARTMENT', 'TEAM', 'USER']),
  targetId: z.string().uuid(),
});

export const pathEnrollBody = z.object({
  userId: z.string().uuid(),
});

export const createEnrollmentBody = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
});

export const progressBody = z.object({
  completed: z.boolean().optional(),
  positionSeconds: z.number().min(0).optional(),
});

export const revokeCertBody = z.object({
  reason: z.string().min(1).max(500),
});

export const platformCreateOrgBody = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(3).max(48),
  adminEmail: z.string().email(),
  adminFirstName: z.string().min(1).max(80),
  adminLastName: z.string().min(1).max(80),
});

export const platformPatchOrgBody = z.object({
  name: z.string().min(2).max(120).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  settings: z.record(z.unknown()).optional(),
}).strict();

export const certificateTemplateBody = z.object({
  theme: z.enum(['midnight', 'ivory', 'slate']).optional(),
  title: z.string().min(1).max(80).optional(),
  eyebrow: z.string().max(80).optional(),
  body: z.string().max(120).optional(),
  accentColor: z.string().regex(/^#([0-9A-Fa-f]{6})$/).optional(),
  signatoryName: z.string().max(80).optional(),
  signatoryTitle: z.string().max(80).optional(),
  footerNote: z.string().max(160).optional(),
  logoUrl: z.string().max(500).optional(),
  signatureUrl: z.string().max(500).optional(),
  backgroundUrl: z.string().max(500).optional(),
  organizationName: z.string().max(120).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  fontFamily: z.enum(['serif', 'sans', 'display', 'script']).optional(),
  fontWeight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  orgNameSize: z.number().int().min(10).max(22).optional(),
  titleSize: z.number().int().min(22).max(56).optional(),
  nameSize: z.number().int().min(22).max(56).optional(),
  bodySize: z.number().int().min(11).max(22).optional(),
  courseSize: z.number().int().min(14).max(40).optional(),
});

export const certificateAssetBody = z.object({
  kind: z.enum(['logo', 'signature', 'background']),
  dataUrl: z.string().min(32).max(2_200_000),
});

export const orgPatchBody = z.object({
  name: z.string().min(2).max(120).optional(),
  logoUrl: z.string().url().nullable().optional(),
  settings: z
    .object({
      timezone: z.string().optional(),
      allowDivisionlessDepts: z.boolean().optional(),
      allowSelfEnrollment: z.boolean().optional(),
      certificatePrefix: z.string().min(2).max(12).optional(),
      showAnswersAfterAttempt: z.boolean().optional(),
      certificateTemplate: certificateTemplateBody.optional(),
      sso: z
        .object({
          issuer: z.string().url().optional(),
          clientId: z.string().max(200).optional(),
          clientSecret: z.string().max(500).optional(),
          domains: z.array(z.string().max(120)).optional(),
          enabled: z.boolean().optional(),
        })
        .optional(),
    })
    .passthrough()
    .optional(),
}).strict();

export const bulkUserStatusBody = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export const mfaVerifyBody = z.object({
  code: z.string().min(6).max(8),
});

export const mfaDisableBody = z.object({
  code: z.string().min(6).max(8),
  password: z.string().min(1),
});

export const mfaLoginBody = z.object({
  mfaToken: z.string().min(10),
  code: z.string().min(6).max(8),
});

export const listNotificationsQuery = paginationQuery.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const ssoExchangeBody = z.object({
  token: z.string().min(10),
});

export const ssoSlugParam = z.object({
  slug: z.string().min(1).max(48),
});

export const announcementBody = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  courseId: z.string().uuid().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const patchAnnouncementBody = announcementBody.partial().strict();

export const listAnnouncementsQuery = paginationQuery.extend({
  courseId: z.string().uuid().optional(),
});

export const forumThreadBody = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  lessonId: z.string().uuid().optional(),
});

export const forumPostBody = z.object({
  body: z.string().min(1).max(10000),
});

export const forumPinBody = z.object({
  pinned: z.boolean(),
});

export const threadIdParam = z.object({ threadId: z.string().uuid() });

export const sessionIdParam = z.object({
  courseId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const sessionBody = z.object({
  lessonId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  deliveryMode: z.enum(['ILT', 'VILT']),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().max(64).optional(),
  location: z.string().max(500).nullable().optional(),
  meetingUrl: z.string().url().nullable().optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  instructorUserId: z.string().uuid().nullable().optional(),
});

export const patchSessionBody = sessionBody
  .omit({ lessonId: true, deliveryMode: true })
  .partial()
  .strict();

export const listSessionsQuery = z.object({
  lessonId: z.string().uuid().optional(),
});

export const sessionAttendanceBody = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  status: z.enum(['ATTENDED', 'NO_SHOW']),
});
