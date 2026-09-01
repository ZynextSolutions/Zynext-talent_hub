import type {
  Assessment,
  AssessmentAttempt,
  AssessmentQuestion,
  BankQuestion,
  Certificate,
  Course,
  CourseAssignment,
  CourseModule,
  CourseRevision,
  Department,
  Division,
  Enrollment,
  LearningPath,
  Lesson,
  Notification,
  Organization,
  PathCertificate,
  PathAssignment,
  PathCourse,
  PathEnrollment,
  PlatformAdmin,
  Progress,
  QuestionBank,
  Team,
  User,
} from '@prisma/client';
import { env } from '../config/env';
import type { RoleName } from '../domain/roles';
import { DEFAULT_ORG_SETTINGS, parseCertificateTemplate, type OrgSettings } from '../types/dto';
import { parseTrainingCurrency, resolveDefaultTrainingCostMinor } from './money';
import { publicSsoSettings } from './sso-public';
import type {
  AssessmentAttemptDto,
  AssessmentDto,
  BankQuestionDto,
  CertificateDto,
  CourseAssignmentDto,
  CourseDto,
  CourseModuleDto,
  CourseRevisionDetailDto,
  CourseRevisionSnapshotDto,
  CourseRevisionSummaryDto,
  CourseStatus,
  DepartmentDto,
  DivisionDto,
  EnrollmentDto,
  LearningPathDto,
  LessonDto,
  LessonProgressDto,
  NotificationDto,
  OrganizationDto,
  PathCertificateDto,
  PathCourseDto,
  PathAssignmentDto,
  PathEnrollmentDto,
  QuestionBankDto,
  QuestionDto,
  TeamDto,
  UserDto,
  UserPublicDto,
} from '../types/dto';
import type { AssignmentTargetType } from '../domain/assignment-targets';
import type { EnrollmentSourceName, EnrollmentStatusName } from '../domain/enrollment-status';

export function parseSettings(raw: unknown): OrgSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    timezone: typeof obj.timezone === 'string' ? obj.timezone : DEFAULT_ORG_SETTINGS.timezone,
    allowDivisionlessDepts:
      typeof obj.allowDivisionlessDepts === 'boolean'
        ? obj.allowDivisionlessDepts
        : DEFAULT_ORG_SETTINGS.allowDivisionlessDepts,
    allowSelfEnrollment:
      typeof obj.allowSelfEnrollment === 'boolean'
        ? obj.allowSelfEnrollment
        : DEFAULT_ORG_SETTINGS.allowSelfEnrollment,
    certificatePrefix:
      typeof obj.certificatePrefix === 'string'
        ? obj.certificatePrefix
        : DEFAULT_ORG_SETTINGS.certificatePrefix,
    showAnswersAfterAttempt:
      typeof obj.showAnswersAfterAttempt === 'boolean'
        ? obj.showAnswersAfterAttempt
        : DEFAULT_ORG_SETTINGS.showAnswersAfterAttempt,
    certificateTemplate: parseCertificateTemplate(obj.certificateTemplate),
    trainingCurrency: parseTrainingCurrency(obj.trainingCurrency, DEFAULT_ORG_SETTINGS.trainingCurrency),
    defaultTrainingCostMinor: resolveDefaultTrainingCostMinor(obj),
    ...(parseSsoSettings(obj.sso) ? { sso: parseSsoSettings(obj.sso) } : {}),
  };
}

function parseSsoSettings(raw: unknown): OrgSettings['sso'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw as Record<string, unknown>;
  const issuer = typeof s.issuer === 'string' ? s.issuer : undefined;
  const clientId = typeof s.clientId === 'string' ? s.clientId : undefined;
  const clientSecret = typeof s.clientSecret === 'string' ? s.clientSecret : undefined;
  const domains = Array.isArray(s.domains)
    ? s.domains.filter((d): d is string => typeof d === 'string')
    : undefined;
  const enabled = typeof s.enabled === 'boolean' ? s.enabled : undefined;
  if (!issuer && !clientId && !clientSecret && !domains?.length && enabled === undefined) {
    return undefined;
  }
  return { issuer, clientId, clientSecret, domains, enabled };
}

export { publicSsoSettings } from './sso-public';

export function toClientOrgSettings(settings: OrgSettings): OrgSettings {
  return {
    ...settings,
    ...(settings.sso ? { sso: publicSsoSettings(settings.sso) } : {}),
  };
}

export function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

const DUE_SOON_MS = 7 * 24 * 60 * 60 * 1000;

export function enrollmentComplianceFlags(row: Enrollment, now = new Date()) {
  if (row.status === 'COMPLETED' || row.status === 'REVOKED' || !row.dueAt) {
    return { isOverdue: false, isDueSoon: false };
  }
  const dueMs = row.dueAt.getTime();
  const nowMs = now.getTime();
  return {
    isOverdue: dueMs < nowMs,
    isDueSoon: dueMs >= nowMs && dueMs - nowMs <= DUE_SOON_MS,
  };
}

export function toOrganizationDto(org: Organization): OrganizationDto {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    settings: toClientOrgSettings(parseSettings(org.settings)),
    status: org.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export function toPublicOrganizationDto(org: Organization): OrganizationDto {
  const full = toOrganizationDto(org);
  return {
    ...full,
    settings: {
      timezone: full.settings.timezone,
      allowDivisionlessDepts: full.settings.allowDivisionlessDepts,
      allowSelfEnrollment: full.settings.allowSelfEnrollment,
      certificatePrefix: full.settings.certificatePrefix,
      showAnswersAfterAttempt: full.settings.showAnswersAfterAttempt,
      certificateTemplate: full.settings.certificateTemplate,
      trainingCurrency: full.settings.trainingCurrency,
      defaultTrainingCostMinor: full.settings.defaultTrainingCostMinor,
    },
  };
}

export function toDivisionDto(row: Division): DivisionDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    code: row.code,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDepartmentDto(row: Department): DepartmentDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    divisionId: row.divisionId,
    name: row.name,
    code: row.code,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTeamDto(row: Team): TeamDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    departmentId: row.departmentId,
    name: row.name,
    code: row.code,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toUserDto(user: User & { role: { name: string } }): UserDto {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role.name as RoleName,
    status: user.status,
    divisionId: user.divisionId,
    departmentId: user.departmentId,
    teamId: user.teamId,
    mfaEnabled: user.mfaEnabled,
    lastLoginAt: toIso(user.lastLoginAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toUserPublicDto(user: User & { role: { name: string } }): UserPublicDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role.name as RoleName,
  };
}

export function toCourseDto(
  course: Course & { _count?: { lessons?: number; enrollments?: number } },
  lessonCount = 0,
): CourseDto {
  return {
    id: course.id,
    organizationId: course.organizationId,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    videoUrl: course.videoUrl,
    scormPackageUrl: course.scormPackageUrl,
    scormVersion: course.scormVersion,
    status: course.status,
    durationMinutes: course.durationMinutes,
    costCents: course.costCents,
    availableFrom: toIso(course.availableFrom),
    availableUntil: toIso(course.availableUntil),
  completionMode: course.completionMode,
  completionPercent: course.completionPercent,
  requirePreAssessment: course.requirePreAssessment,
  createdByUserId: course.createdByUserId,
    lessonCount,
    enrollmentCount: course._count?.enrollments,
    publishedAt: toIso(course.publishedAt),
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

export function toLessonDto(lesson: Lesson & { moduleQuiz?: { id: string } | null }): LessonDto {
  return {
    id: lesson.id,
    organizationId: lesson.organizationId,
    courseId: lesson.courseId,
    moduleId: lesson.moduleId,
    title: lesson.title,
    description: lesson.description,
    kind: lesson.kind,
    order: lesson.orderIndex,
    content: lesson.content,
    videoUrl: lesson.videoUrl,
    resourceUrl: lesson.resourceUrl,
    durationSeconds: lesson.durationSeconds,
    required: lesson.required,
    prerequisiteLessonId: lesson.prerequisiteLessonId,
    quizAssessmentId: lesson.moduleQuiz?.id ?? null,
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
  };
}

export function toCourseModuleDto(
  module: CourseModule & { lessons?: Lesson[] },
): CourseModuleDto {
  return {
    id: module.id,
    courseId: module.courseId,
    title: module.title,
    description: module.description,
    order: module.orderIndex,
    lessons: (module.lessons ?? []).map(toLessonDto),
  };
}

export function toAssignmentDto(row: CourseAssignment): CourseAssignmentDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    courseId: row.courseId,
    targetType: row.targetType as AssignmentTargetType,
    targetId: row.targetId,
    createdByUserId: row.createdByUserId,
    dueAt: toIso(row.dueAt),
    recertifyEveryDays: row.recertifyEveryDays,
    reminderDaysBefore: row.reminderDaysBefore,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toEnrollmentDto(
  row: Enrollment & {
    user?: { id: string; firstName: string; lastName: string; email?: string };
    course?: { id: string; title: string; status: string };
  },
): EnrollmentDto {
  const flags = enrollmentComplianceFlags(row);
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    courseId: row.courseId,
    status: row.status as EnrollmentStatusName,
    source: row.source as EnrollmentSourceName,
    assignmentId: row.assignmentId,
    pathEnrollmentId: row.pathEnrollmentId,
    dueAt: toIso(row.dueAt),
    isOverdue: flags.isOverdue,
    isDueSoon: flags.isDueSoon,
    progressPercent: Math.floor(row.progressPct),
    completedAt: toIso(row.completedAt),
    enrolledAt: row.enrolledAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastLessonId: row.lastLessonId,
    ...(row.user
      ? {
          user: {
            id: row.user.id,
            firstName: row.user.firstName,
            lastName: row.user.lastName,
            email: row.user.email,
          },
        }
      : {}),
    ...(row.course
      ? {
          course: {
            id: row.course.id,
            title: row.course.title,
            status: row.course.status as CourseStatus,
          },
        }
      : {}),
  };
}

export function toProgressDto(row: Progress): LessonProgressDto {
  return {
    id: row.id,
    enrollmentId: row.enrollmentId,
    lessonId: row.lessonId,
    completed: row.completed,
    positionSeconds: row.positionSeconds,
    watchedSeconds: row.watchedSeconds,
    percentage: row.percentage,
    openedAt: toIso(row.openedAt),
    completedAt: toIso(row.completedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCertificateDto(
  row: Certificate & {
    user?: { firstName: string; lastName: string };
    course?: { title: string };
    organization?: { name: string };
  },
): CertificateDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    kind: 'course',
    enrollmentId: row.enrollmentId,
    userId: row.userId,
    courseId: row.courseId,
    certificateNumber: row.certificateNumber,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: toIso(row.expiresAt),
    revokedAt: toIso(row.revokedAt),
    verificationUrl: `${env.PUBLIC_WEB_URL}/verify/${row.certificateNumber}`,
    ...(row.user ? { user: { firstName: row.user.firstName, lastName: row.user.lastName } } : {}),
    ...(row.course ? { course: { title: row.course.title } } : {}),
    ...(row.organization ? { organization: { name: row.organization.name } } : {}),
  };
}

export function toAssessmentDto(row: Assessment, questionCount: number): AssessmentDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    courseId: row.courseId,
    title: row.title,
    kind: row.kind,
    passingScore: row.passingScore,
    maxAttempts: row.maxAttempts,
    timeLimitSeconds: row.timeLimitSeconds,
    bankId: row.bankId,
    drawCount: row.drawCount,
    drawTags: row.drawTags ?? [],
    lessonId: row.lessonId,
    anonymous: row.anonymous,
    questionCount,
  };
}

function parseQuestionMetadata(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function questionExtras(row: {
  points?: number;
  explanation?: string | null;
  difficulty?: string | null;
  metadata?: unknown;
}) {
  return {
    points: row.points ?? 1,
    ...(row.explanation ? { explanation: row.explanation } : {}),
    ...(row.difficulty ? { difficulty: row.difficulty } : {}),
    metadata: parseQuestionMetadata(row.metadata),
  };
}

function parseOptions(raw: unknown): Array<{ id: string; text: string }> {
  return Array.isArray(raw) ? (raw as Array<{ id: string; text: string }>) : [];
}

export function toQuestionDto(row: AssessmentQuestion, includeAnswer: boolean): QuestionDto {
  const options = parseOptions(row.options);
  const correctOptionIds = Array.isArray(row.correctOptionIds)
    ? (row.correctOptionIds as string[])
    : undefined;
  return {
    id: row.id,
    prompt: row.question,
    type: row.type,
    options,
    order: row.orderIndex,
    ...questionExtras(row),
    ...(includeAnswer
      ? {
          ...(row.correctOptionId ? { correctOptionId: row.correctOptionId } : {}),
          ...(correctOptionIds ? { correctOptionIds } : {}),
        }
      : {}),
  };
}

export function toQuestionDtoFromSnapshot(
  snapshot: Record<string, unknown>,
  includeAnswer: boolean,
): QuestionDto {
  const options = parseOptions(snapshot.options);
  const correctOptionIds = Array.isArray(snapshot.correctOptionIds)
    ? (snapshot.correctOptionIds as string[])
    : undefined;
  return {
    id: String(snapshot.id),
    prompt: String(snapshot.prompt ?? snapshot.question ?? ''),
    type: (snapshot.type as QuestionDto['type']) ?? 'MCQ',
    options,
    order: Number(snapshot.order ?? snapshot.orderIndex ?? 0),
    points: typeof snapshot.points === 'number' ? snapshot.points : 1,
    ...(typeof snapshot.explanation === 'string' ? { explanation: snapshot.explanation } : {}),
    metadata: parseQuestionMetadata(snapshot.metadata),
    ...(includeAnswer
      ? {
          ...(snapshot.correctOptionId ? { correctOptionId: String(snapshot.correctOptionId) } : {}),
          ...(correctOptionIds ? { correctOptionIds } : {}),
          ...(snapshot.correctBlanks ? { correctBlanks: snapshot.correctBlanks as Record<string, string[]> } : {}),
          ...(snapshot.correctMatches ? { correctMatches: snapshot.correctMatches as Record<string, string> } : {}),
        }
      : {}),
  };
}

export function toAttemptDto(row: AssessmentAttempt): AssessmentAttemptDto {
  const snapshot = Array.isArray(row.questionSnapshot)
    ? (row.questionSnapshot as Record<string, unknown>[]).map((q) => toQuestionDtoFromSnapshot(q, false))
    : undefined;
  return {
    id: row.id,
    score: row.score,
    passed: row.passed,
    attemptNumber: row.attemptNumber,
    gradingStatus: row.gradingStatus,
    startedAt: toIso(row.startedAt),
    expiresAt: toIso(row.expiresAt),
    submittedAt: row.createdAt.toISOString(),
    instructorFeedback: row.instructorFeedback,
    ...(snapshot ? { questionSnapshot: snapshot } : {}),
    answers: row.answers,
  };
}

export function toQuestionBankDto(row: QuestionBank, questionCount = 0): QuestionBankDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    questionCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toBankQuestionDto(row: BankQuestion, includeAnswer = true): BankQuestionDto {
  const options = parseOptions(row.options);
  const correctOptionIds = Array.isArray(row.correctOptionIds)
    ? (row.correctOptionIds as string[])
    : null;
  return {
    id: row.id,
    bankId: row.bankId,
    question: row.question,
    type: row.type,
    options,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    ...questionExtras(row),
    ...(includeAnswer
      ? {
          correctOptionId: row.correctOptionId,
          correctOptionIds,
        }
      : {}),
  };
}

export function toLearningPathDto(row: LearningPath, courseCount = 0): LearningPathDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description,
    status: row.status,
    courseCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPathCourseDto(row: PathCourse & { course?: Course }): PathCourseDto {
  return {
    id: row.id,
    pathId: row.pathId,
    courseId: row.courseId,
    orderIndex: row.orderIndex,
    required: row.required,
    ...(row.course
      ? { course: { id: row.course.id, title: row.course.title, status: row.course.status } }
      : {}),
  };
}

export function toPathAssignmentDto(row: PathAssignment): PathAssignmentDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    pathId: row.pathId,
    targetType: row.targetType,
    targetId: row.targetId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPathEnrollmentDto(
  row: PathEnrollment & {
    user?: { id: string; firstName: string; lastName: string; email?: string };
    path?: { id: string; title: string; status: string };
  },
): PathEnrollmentDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    pathId: row.pathId,
    userId: row.userId,
    status: row.status,
    progressPercent: Math.floor(row.progressPct),
    enrolledAt: row.enrolledAt.toISOString(),
    completedAt: toIso(row.completedAt),
    ...(row.user
      ? {
          user: {
            id: row.user.id,
            firstName: row.user.firstName,
            lastName: row.user.lastName,
            email: row.user.email,
          },
        }
      : {}),
    ...(row.path
      ? {
          path: {
            id: row.path.id,
            title: row.path.title,
            status: row.path.status as LearningPathDto['status'],
          },
        }
      : {}),
  };
}

export function toPathCertificateDto(
  row: PathCertificate & {
    user?: { firstName: string; lastName: string };
    path?: { title: string };
    organization?: { name: string };
  },
): CertificateDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    kind: 'path',
    pathEnrollmentId: row.pathEnrollmentId,
    pathId: row.pathId,
    userId: row.userId,
    certificateNumber: row.certificateNumber,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: null,
    revokedAt: null,
    verificationUrl: `${env.PUBLIC_WEB_URL}/verify/${row.certificateNumber}`,
    ...(row.user ? { user: { firstName: row.user.firstName, lastName: row.user.lastName } } : {}),
    ...(row.path ? { path: { title: row.path.title } } : {}),
    ...(row.organization ? { organization: { name: row.organization.name } } : {}),
  };
}

type CourseRevisionRow = CourseRevision & {
  publishedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
};

function revisionCounts(snapshot: unknown): { lessonCount: number; moduleCount: number; title: string } {
  const parsed = snapshot as CourseRevisionSnapshotDto;
  return {
    lessonCount: parsed.lessons?.length ?? 0,
    moduleCount: parsed.modules?.length ?? 0,
    title: parsed.course?.title ?? 'Untitled course',
  };
}

export function toCourseRevisionSummaryDto(row: CourseRevisionRow): CourseRevisionSummaryDto {
  const counts = revisionCounts(row.snapshot);
  return {
    id: row.id,
    courseId: row.courseId,
    versionNumber: row.versionNumber,
    publishedAt: row.publishedAt.toISOString(),
    publishedBy: row.publishedBy
      ? {
          id: row.publishedBy.id,
          firstName: row.publishedBy.firstName,
          lastName: row.publishedBy.lastName,
          email: row.publishedBy.email,
        }
      : null,
    lessonCount: counts.lessonCount,
    moduleCount: counts.moduleCount,
    title: counts.title,
  };
}

export function toCourseRevisionDetailDto(row: CourseRevisionRow): CourseRevisionDetailDto {
  return {
    ...toCourseRevisionSummaryDto(row),
    snapshot: row.snapshot as unknown as CourseRevisionSnapshotDto,
  };
}

export function platformAdminName(admin: PlatformAdmin): string {
  return `${admin.firstName} ${admin.lastName}`.trim();
}

export function toNotificationDto(row: Notification): NotificationDto {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: toIso(row.readAt),
    enrollmentId: row.enrollmentId,
    courseId: row.courseId,
    createdAt: row.createdAt.toISOString(),
  };
}

type AnnouncementRow = {
  id: string;
  organizationId: string;
  courseId: string | null;
  title: string;
  body: string;
  publishedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  course?: { id: string; title: string } | null;
};

export function toAnnouncementDto(row: AnnouncementRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    courseId: row.courseId,
    courseTitle: row.course?.title ?? null,
    title: row.title,
    body: row.body,
    publishedAt: toIso(row.publishedAt),
    expiresAt: toIso(row.expiresAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ForumThreadRow = {
  id: string;
  scope: 'ORGANIZATION' | 'COURSE';
  courseId: string | null;
  lessonId: string | null;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; firstName: string; lastName: string };
  _count?: { posts: number };
};

export function toForumThreadDto(row: ForumThreadRow) {
  return {
    id: row.id,
    scope: row.scope,
    courseId: row.courseId,
    lessonId: row.lessonId,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    locked: row.locked,
    postCount: row._count?.posts ?? 0,
    author: row.user,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ForumPostRow = {
  id: string;
  threadId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; firstName: string; lastName: string };
};

export function toForumPostDto(row: ForumPostRow) {
  return {
    id: row.id,
    threadId: row.threadId,
    body: row.body,
    author: row.user,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type SessionRow = {
  id: string;
  courseId: string;
  lessonId: string;
  title: string;
  description: string;
  deliveryMode: 'ILT' | 'VILT';
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  capacity: number | null;
  instructorUserId: string | null;
  _count?: { registrations: number };
};

export function toSessionDto(row: SessionRow) {
  return {
    id: row.id,
    courseId: row.courseId,
    lessonId: row.lessonId,
    title: row.title,
    description: row.description,
    deliveryMode: row.deliveryMode,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timezone: row.timezone,
    location: row.location,
    meetingUrl: row.meetingUrl,
    capacity: row.capacity,
    registrationCount: row._count?.registrations ?? 0,
    instructorUserId: row.instructorUserId,
  };
}

type RegistrationRow = {
  id: string;
  sessionId: string;
  userId: string;
  status: string;
  registeredAt: Date;
  attendedAt: Date | null;
  user?: { id: string; firstName: string; lastName: string; email?: string };
};

export function toSessionRegistrationDto(row: RegistrationRow) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    status: row.status,
    registeredAt: row.registeredAt.toISOString(),
    attendedAt: toIso(row.attendedAt),
    ...(row.user ? { user: row.user } : {}),
  };
}
