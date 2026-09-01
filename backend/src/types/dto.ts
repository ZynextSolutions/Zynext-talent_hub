import type { RoleName } from '../domain/roles';
import type { AssignmentTargetType } from '../domain/assignment-targets';
import type { EnrollmentSourceName, EnrollmentStatusName } from '../domain/enrollment-status';

export type Uuid = string;
export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type CertificateTheme = 'midnight' | 'ivory' | 'slate';
export type CertificateAlign = 'left' | 'center' | 'right';
export type CertificateFontFamily = 'serif' | 'sans' | 'display' | 'script';
export type CertificateFontWeight = 'normal' | 'medium' | 'semibold' | 'bold';
export type CertificateFontStyle = 'normal' | 'italic';

export interface CertificateTemplate {
  theme: CertificateTheme;
  title: string;
  eyebrow: string;
  body: string;
  organizationName: string;
  accentColor: string;
  signatoryName: string;
  signatoryTitle: string;
  footerNote: string;
  logoUrl: string;
  signatureUrl: string;
  backgroundUrl: string;
  textAlign: CertificateAlign;
  fontFamily: CertificateFontFamily;
  fontWeight: CertificateFontWeight;
  fontStyle: CertificateFontStyle;
  orgNameSize: number;
  titleSize: number;
  nameSize: number;
  bodySize: number;
  courseSize: number;
}

export const DEFAULT_CERTIFICATE_TEMPLATE: CertificateTemplate = {
  theme: 'midnight',
  title: 'Certificate of Completion',
  eyebrow: 'This certifies that',
  body: 'has successfully completed',
  organizationName: '',
  accentColor: '#818cf8',
  signatoryName: '',
  signatoryTitle: '',
  footerNote: '',
  logoUrl: '',
  signatureUrl: '',
  backgroundUrl: '',
  textAlign: 'center',
  fontFamily: 'serif',
  fontWeight: 'semibold',
  fontStyle: 'normal',
  orgNameSize: 12,
  titleSize: 36,
  nameSize: 36,
  bodySize: 14,
  courseSize: 24,
};

const HEX_COLOR = /^#([0-9A-Fa-f]{6})$/;
const THEMES = new Set<CertificateTheme>(['midnight', 'ivory', 'slate']);
const ALIGNS = new Set<CertificateAlign>(['left', 'center', 'right']);
const FONTS = new Set<CertificateFontFamily>(['serif', 'sans', 'display', 'script']);
const WEIGHTS = new Set<CertificateFontWeight>(['normal', 'medium', 'semibold', 'bold']);
const STYLES = new Set<CertificateFontStyle>(['normal', 'italic']);

function asEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === 'string' && allowed.has(value as T) ? (value as T) : fallback;
}

function asSize(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asTrimmed(value: unknown, max: number, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, max);
}

function asAssetUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!url) return '';
  if (url.startsWith('/uploads/')) return url.slice(0, 240);
  if (/^https?:\/\//i.test(url)) return url.slice(0, 500);
  return '';
}

export function parseCertificateTemplate(raw: unknown): CertificateTemplate {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const theme = THEMES.has(obj.theme as CertificateTheme)
    ? (obj.theme as CertificateTheme)
    : DEFAULT_CERTIFICATE_TEMPLATE.theme;
  const accent =
    typeof obj.accentColor === 'string' && HEX_COLOR.test(obj.accentColor)
      ? obj.accentColor
      : DEFAULT_CERTIFICATE_TEMPLATE.accentColor;
  return {
    theme,
    title: asTrimmed(obj.title, 80, DEFAULT_CERTIFICATE_TEMPLATE.title) || DEFAULT_CERTIFICATE_TEMPLATE.title,
    eyebrow: asTrimmed(obj.eyebrow, 80, DEFAULT_CERTIFICATE_TEMPLATE.eyebrow),
    body: asTrimmed(obj.body, 120, DEFAULT_CERTIFICATE_TEMPLATE.body),
    accentColor: accent,
    signatoryName: asTrimmed(obj.signatoryName, 80, ''),
    signatoryTitle: asTrimmed(obj.signatoryTitle, 80, ''),
    footerNote: asTrimmed(obj.footerNote, 160, ''),
    organizationName: asTrimmed(obj.organizationName, 120, ''),
    logoUrl: asAssetUrl(obj.logoUrl),
    signatureUrl: asAssetUrl(obj.signatureUrl),
    backgroundUrl: asAssetUrl(obj.backgroundUrl),
    textAlign: asEnum(obj.textAlign, ALIGNS, DEFAULT_CERTIFICATE_TEMPLATE.textAlign),
    fontFamily: asEnum(obj.fontFamily, FONTS, DEFAULT_CERTIFICATE_TEMPLATE.fontFamily),
    fontWeight: asEnum(obj.fontWeight, WEIGHTS, DEFAULT_CERTIFICATE_TEMPLATE.fontWeight),
    fontStyle: asEnum(obj.fontStyle, STYLES, DEFAULT_CERTIFICATE_TEMPLATE.fontStyle),
    orgNameSize: asSize(obj.orgNameSize, 10, 22, DEFAULT_CERTIFICATE_TEMPLATE.orgNameSize),
    titleSize: asSize(obj.titleSize, 22, 56, DEFAULT_CERTIFICATE_TEMPLATE.titleSize),
    nameSize: asSize(obj.nameSize, 22, 56, DEFAULT_CERTIFICATE_TEMPLATE.nameSize),
    bodySize: asSize(obj.bodySize, 11, 22, DEFAULT_CERTIFICATE_TEMPLATE.bodySize),
    courseSize: asSize(obj.courseSize, 14, 40, DEFAULT_CERTIFICATE_TEMPLATE.courseSize),
  };
}

export interface SsoConfig {
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  clientSecretSet?: boolean;
  domains?: string[];
  enabled?: boolean;
}

export interface OrgSettings {
  timezone: string;
  allowDivisionlessDepts: boolean;
  allowSelfEnrollment: boolean;
  certificatePrefix: string;
  showAnswersAfterAttempt: boolean;
  certificateTemplate: CertificateTemplate;
  trainingCurrency: 'USD' | 'MMK';
  defaultTrainingCostMinor: number;
  sso?: SsoConfig;
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  timezone: 'UTC',
  allowDivisionlessDepts: true,
  allowSelfEnrollment: false,
  certificatePrefix: 'COR',
  showAnswersAfterAttempt: false,
  certificateTemplate: DEFAULT_CERTIFICATE_TEMPLATE,
  trainingCurrency: 'MMK',
  defaultTrainingCostMinor: 0,
};

export interface OrganizationDto {
  id: Uuid;
  name: string;
  slug: string;
  logoUrl: string | null;
  settings: OrgSettings;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface DivisionDto {
  id: Uuid;
  organizationId: Uuid;
  name: string;
  code: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentDto {
  id: Uuid;
  organizationId: Uuid;
  divisionId: Uuid | null;
  name: string;
  code: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamDto {
  id: Uuid;
  organizationId: Uuid;
  departmentId: Uuid;
  name: string;
  code: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserDto {
  id: Uuid;
  organizationId: Uuid;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: RoleName;
  status: UserStatus;
  divisionId: Uuid | null;
  departmentId: Uuid | null;
  teamId: Uuid | null;
  lastLoginAt: string | null;
  mfaEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPublicDto {
  id: Uuid;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: RoleName;
}

export interface CourseDto {
  id: Uuid;
  organizationId: Uuid;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  scormPackageUrl: string | null;
  scormVersion: string | null;
  status: CourseStatus;
  durationMinutes: number | null;
  costCents: number | null;
  availableFrom: string | null;
  availableUntil: string | null;
  completionMode: 'ALL_LESSONS' | 'REQUIRED_LESSONS' | 'PERCENTAGE';
  completionPercent: number | null;
  requirePreAssessment: boolean;
  createdByUserId: Uuid | null;
  lessonCount: number;
  enrollmentCount?: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRevisionSnapshotDto {
  course: {
    title: string;
    description: string;
    thumbnailUrl: string | null;
    videoUrl: string | null;
    scormPackageUrl: string | null;
    scormVersion: string | null;
    durationMinutes: number | null;
    availableFrom: string | null;
    availableUntil: string | null;
    completionMode: 'ALL_LESSONS' | 'REQUIRED_LESSONS' | 'PERCENTAGE';
    completionPercent: number | null;
    status: CourseStatus;
  };
  modules: CourseModuleDto[];
  lessons: LessonDto[];
  assessments: Array<{
    id: Uuid;
    title: string;
    kind: 'PRE' | 'FINAL' | 'SURVEY' | 'MODULE_QUIZ';
    passingScore: number;
    maxAttempts: number | null;
    timeLimitSeconds: number | null;
    questions: Array<{ question: string; type: string; orderIndex: number }>;
  }>;
  prerequisites: CoursePrerequisiteSummaryDto[];
}

export interface CourseRevisionSummaryDto {
  id: Uuid;
  courseId: Uuid;
  versionNumber: number;
  publishedAt: string;
  publishedBy?: { id: Uuid; firstName: string; lastName: string; email: string } | null;
  lessonCount: number;
  moduleCount: number;
  title: string;
}

export interface CourseRevisionDetailDto extends CourseRevisionSummaryDto {
  snapshot: CourseRevisionSnapshotDto;
}

export type CatalogAvailability = 'open' | 'upcoming' | 'closed';

export interface CatalogCourseDto extends CourseDto {
  catalogAvailability: CatalogAvailability;
  enrolled: boolean;
  prerequisites: CoursePrerequisiteSummaryDto[];
  prerequisitesMet: boolean;
  dueAt?: string | null;
  isOverdue?: boolean;
  isDueSoon?: boolean;
  progressPercent?: number;
  favorited?: boolean;
}

export interface CoursePrerequisiteSummaryDto {
  id: Uuid;
  title: string;
}

export type LessonKind =
  | 'VIDEO'
  | 'READING'
  | 'DOCUMENT'
  | 'QUIZ'
  | 'DISCUSSION'
  | 'SCORM'
  | 'ILT'
  | 'VILT';

export interface LessonDto {
  id: Uuid;
  organizationId: Uuid;
  courseId: Uuid;
  moduleId: Uuid | null;
  title: string;
  description: string | null;
  kind: LessonKind;
  order: number;
  content: string | null;
  videoUrl: string | null;
  resourceUrl: string | null;
  durationSeconds: number | null;
  required: boolean;
  prerequisiteLessonId: Uuid | null;
  quizAssessmentId?: Uuid | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseModuleDto {
  id: Uuid;
  courseId: Uuid;
  title: string;
  description: string | null;
  order: number;
  lessons: LessonDto[];
}

export interface CourseAssignmentDto {
  id: Uuid;
  organizationId: Uuid;
  courseId: Uuid;
  targetType: AssignmentTargetType;
  targetId: Uuid;
  createdByUserId: Uuid | null;
  dueAt: string | null;
  recertifyEveryDays: number | null;
  reminderDaysBefore: number | null;
  createdAt: string;
}

export interface EnrollmentDto {
  id: Uuid;
  organizationId: Uuid;
  userId: Uuid;
  courseId: Uuid;
  status: EnrollmentStatusName;
  source: EnrollmentSourceName;
  assignmentId: Uuid | null;
  pathEnrollmentId: Uuid | null;
  dueAt: string | null;
  isOverdue: boolean;
  isDueSoon: boolean;
  progressPercent: number;
  completedAt: string | null;
  enrolledAt: string;
  updatedAt: string;
  lastLessonId: Uuid | null;
  user?: { id: Uuid; firstName: string; lastName: string; email?: string };
  course?: Pick<CourseDto, 'id' | 'title' | 'status'>;
}

export interface LessonProgressDto {
  id: Uuid;
  enrollmentId: Uuid;
  lessonId: Uuid;
  completed: boolean;
  positionSeconds: number;
  watchedSeconds: number;
  percentage: number;
  openedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface CertificateDto {
  id: Uuid;
  organizationId: Uuid;
  userId: Uuid;
  certificateNumber: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  verificationUrl: string;
  kind: 'course' | 'path';
  enrollmentId?: Uuid;
  courseId?: Uuid;
  pathEnrollmentId?: Uuid;
  pathId?: Uuid;
  user?: { firstName: string; lastName: string };
  course?: { title: string };
  path?: { title: string };
  organization?: { name: string };
}

export interface AssessmentDto {
  id: Uuid;
  organizationId: Uuid;
  courseId: Uuid;
  title: string;
  kind: 'PRE' | 'FINAL' | 'SURVEY' | 'MODULE_QUIZ';
  passingScore: number;
  maxAttempts: number | null;
  timeLimitSeconds: number | null;
  bankId: Uuid | null;
  drawCount: number | null;
  drawTags?: string[];
  lessonId?: Uuid | null;
  anonymous?: boolean;
  questionCount: number;
}

export interface QuestionOptionDto {
  id: Uuid;
  text: string;
}

export interface QuestionDto {
  id: Uuid;
  prompt: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'MULTI_SELECT' | 'SHORT_ANSWER' | 'FILL_BLANK' | 'MATCHING' | 'ESSAY';
  options: QuestionOptionDto[];
  correctOptionId?: Uuid;
  correctOptionIds?: Uuid[];
  correctBlanks?: Record<string, string[]>;
  correctMatches?: Record<string, string>;
  points?: number;
  explanation?: string;
  difficulty?: string;
  metadata?: Record<string, unknown>;
  order: number;
}

export interface AssessmentAttemptDto {
  id: Uuid;
  score: number | null;
  passed: boolean;
  attemptNumber: number;
  gradingStatus: 'AUTO_GRADED' | 'PENDING_REVIEW' | 'GRADED' | 'EXPIRED';
  startedAt: string | null;
  expiresAt: string | null;
  submittedAt: string;
  instructorFeedback?: string | null;
  questionSnapshot?: QuestionDto[];
  answers?: unknown;
}

export interface QuestionBankDto {
  id: Uuid;
  organizationId: Uuid;
  name: string;
  description: string;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BankQuestionDto {
  id: Uuid;
  bankId: Uuid;
  question: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'MULTI_SELECT' | 'SHORT_ANSWER' | 'FILL_BLANK' | 'MATCHING' | 'ESSAY';
  options: QuestionOptionDto[];
  correctOptionId?: Uuid | null;
  correctOptionIds?: Uuid[] | null;
  points?: number;
  explanation?: string;
  difficulty?: string;
  metadata?: Record<string, unknown>;
  tags: string[];
  createdAt: string;
}

export interface LearningPathDto {
  id: Uuid;
  organizationId: Uuid;
  title: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  courseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PathCourseDto {
  id: Uuid;
  pathId: Uuid;
  courseId: Uuid;
  orderIndex: number;
  required: boolean;
  course?: Pick<CourseDto, 'id' | 'title' | 'status'>;
}

export interface PathAssignmentDto {
  id: Uuid;
  organizationId: Uuid;
  pathId: Uuid;
  targetType: AssignmentTargetType;
  targetId: Uuid;
  createdAt: string;
}

export interface PathEnrollmentDto {
  id: Uuid;
  organizationId: Uuid;
  pathId: Uuid;
  userId: Uuid;
  status: 'IN_PROGRESS' | 'COMPLETED';
  progressPercent: number;
  enrolledAt: string;
  completedAt: string | null;
  user?: { id: Uuid; firstName: string; lastName: string; email?: string };
  path?: Pick<LearningPathDto, 'id' | 'title' | 'status'>;
}

export type PathCourseLearnerState = 'LOCKED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface PathCourseLearnerProgressDto {
  courseId: Uuid;
  title: string;
  orderIndex: number;
  required: boolean;
  state: PathCourseLearnerState;
  progressPercent: number;
  enrollmentId: Uuid | null;
}

export interface PathLearnerProgressDto {
  path: Pick<LearningPathDto, 'id' | 'title' | 'description' | 'status'>;
  pathEnrollment: PathEnrollmentDto | null;
  courses: PathCourseLearnerProgressDto[];
}

export interface PathCertificateDto {
  id: Uuid;
  organizationId: Uuid;
  pathEnrollmentId: Uuid;
  userId: Uuid;
  pathId: Uuid;
  certificateNumber: string;
  issuedAt: string;
}

export interface ComplianceAnalyticsDto {
  overdueCount: number;
  dueSoonCount: number;
  onTrackCount: number;
  items: Array<{
    enrollmentId: Uuid;
    userId: Uuid;
    userName: string;
    courseId: Uuid;
    courseTitle: string;
    dueAt: string | null;
    status: EnrollmentStatusName;
    progressPercent: number;
    complianceStatus: 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK' | 'COMPLETED';
  }>;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  mandatoryTotal?: number;
  mandatoryCompleted?: number;
  expiringCerts?: Array<{
    certificateId: Uuid;
    userName: string;
    courseTitle: string;
    issuedAt: string;
    expiresAt: string;
    recertifyEveryDays: number | null;
  }>;
  riskDepartments?: Array<{
    id: Uuid;
    name: string;
    overdueCount: number;
    dueSoonCount: number;
  }>;
}

export interface AuthUserBundle {
  user: UserDto;
  organization: OrganizationDto;
  permissions: string[];
}

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type NotificationKindName =
  | 'DUE_REMINDER'
  | 'OVERDUE'
  | 'ASSIGNED'
  | 'PATH_COURSE_UNLOCKED'
  | 'RECERTIFY_REQUIRED'
  | 'ANNOUNCEMENT'
  | 'CERT_EXPIRING'
  | 'CERT_EXPIRED';

export interface NotificationDto {
  id: Uuid;
  kind: NotificationKindName;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  enrollmentId: Uuid | null;
  courseId: Uuid | null;
  createdAt: string;
}

export interface AnnouncementDto {
  id: Uuid;
  organizationId: Uuid;
  courseId: Uuid | null;
  courseTitle?: string | null;
  title: string;
  body: string;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ForumScopeName = 'ORGANIZATION' | 'COURSE';

export interface ForumThreadDto {
  id: Uuid;
  scope: ForumScopeName;
  courseId: Uuid | null;
  lessonId: Uuid | null;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  postCount: number;
  author: { id: Uuid; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface ForumPostDto {
  id: Uuid;
  threadId: Uuid;
  body: string;
  author: { id: Uuid; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSessionDto {
  id: Uuid;
  courseId: Uuid;
  lessonId: Uuid;
  title: string;
  description: string;
  deliveryMode: 'ILT' | 'VILT';
  startsAt: string;
  endsAt: string;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  capacity: number | null;
  registrationCount: number;
  instructorUserId: Uuid | null;
}

export interface SessionRegistrationDto {
  id: Uuid;
  sessionId: Uuid;
  userId: Uuid;
  status: string;
  registeredAt: string;
  attendedAt: string | null;
  user?: { id: Uuid; firstName: string; lastName: string; email?: string };
}
