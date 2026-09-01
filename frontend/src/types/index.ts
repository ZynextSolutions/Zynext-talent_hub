export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type UserRole = "ORG_ADMIN" | "MANAGER" | "INSTRUCTOR" | "EMPLOYEE";

export type UserStatus = "ACTIVE" | "INVITED" | "SUSPENDED" | "DEACTIVATED";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string | null;
  mfaEnabled?: boolean;
  teamId?: string;
  departmentId?: string;
  divisionId?: string;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export type CertificateTheme = "midnight" | "ivory" | "slate";
export type CertificateAlign = "left" | "center" | "right";
export type CertificateFontFamily = "serif" | "sans" | "display" | "script";
export type CertificateFontWeight = "normal" | "medium" | "semibold" | "bold";
export type CertificateFontStyle = "normal" | "italic";

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

export interface SsoConfig {
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  clientSecretSet?: boolean;
  domains?: string[];
  enabled?: boolean;
}

export interface OrgSettings {
  timezone?: string;
  allowDivisionlessDepts?: boolean;
  allowSelfEnrollment?: boolean;
  certificatePrefix?: string;
  showAnswersAfterAttempt?: boolean;
  certificateTemplate?: CertificateTemplate;
  trainingCurrency?: "USD" | "MMK";
  defaultTrainingCostMinor?: number;
  /** @deprecated use defaultTrainingCostMinor */
  defaultTrainingCostCents?: number;
  sso?: SsoConfig;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  status?: string;
  settings?: OrgSettings;
  createdAt?: string;
}

export interface AuthBundle {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
  organization: Organization;
  permissions: string[];
}

/** Backend login/register response shape */
export interface AuthSessionResponse {
  user: User;
  organization: Organization;
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  };
  permissions?: string[];
}

export interface LoginResponse extends Partial<AuthSessionResponse> {
  mfaRequired?: boolean;
  mfaToken?: string;
}

export interface MfaSetupResponse {
  secret?: string;
  qrCodeUrl?: string;
  otpauthUrl?: string;
}

export interface UserImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors?: Array<{ row: number; message: string }>;
}

export interface BulkUserStatusResult {
  updated: number;
}

export interface MeResponse {
  user?: User;
  organization?: Organization;
  admin?: PlatformAdmin;
  permissions?: string[];
  type?: 'user' | 'platform';
}

export interface PlatformAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mfaEnabled?: boolean;
}

export interface MfaLoginResponse {
  admin?: PlatformAdmin;
  user?: User;
  organization?: Organization;
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  };
  permissions?: string[];
}

export interface PlatformAuthSessionResponse {
  admin?: PlatformAdmin;
  mfaRequired?: boolean;
  mfaToken?: string;
  tokens?: {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  };
}

export interface PlatformOrganization extends Organization {
  userCount: number;
  courseCount: number;
}

export interface AuditLogEntry {
  id: string;
  organizationId?: string | null;
  actorType: string;
  actorId: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ip?: string | null;
  createdAt: string;
}

export type NodeType = "ORGANIZATION" | "DIVISION" | "DEPARTMENT" | "TEAM" | "USER";

export interface OrgTreeUser {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  email: string;
}

export interface OrgTreeTeam {
  id: string;
  name: string;
  departmentId: string;
  sortOrder: number;
  users: OrgTreeUser[];
}

export interface OrgTreeDepartment {
  id: string;
  name: string;
  divisionId: string | null;
  sortOrder: number;
  teams: OrgTreeTeam[];
}

export interface OrgTreeDivision {
  id: string;
  name: string;
  sortOrder: number;
  departments: OrgTreeDepartment[];
}

export interface OrgTree {
  organization: Organization;
  divisions: OrgTreeDivision[];
  unassignedDepartments: OrgTreeDepartment[];
}

export interface MoveNodeRequest {
  nodeType: "DEPARTMENT" | "TEAM" | "USER";
  nodeId: string;
  targetParentType: "ORGANIZATION" | "DIVISION" | "DEPARTMENT" | "TEAM";
  targetParentId?: string;
}

export interface MoveNodeResponse {
  nodeType: string;
  nodeId: string;
  previousParent?: { type: string; id: string };
  parent?: { type: string; id: string };
  affectedUserIds?: string[];
  enrollmentsAdded?: number;
  enrollmentsRetained?: number;
  treeEtag?: string;
  unchanged?: boolean;
}

export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type CompletionMode = "ALL_LESSONS" | "REQUIRED_LESSONS" | "PERCENTAGE";

export interface Course {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  scormPackageUrl?: string | null;
  scormVersion?: string | null;
  durationMinutes?: number | null;
  costCents?: number | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  completionMode?: CompletionMode;
  completionPercent?: number | null;
  requirePreAssessment?: boolean;
  status: CourseStatus;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lessonCount?: number;
  enrollmentCount?: number;
  createdByUserId?: string | null;
  prerequisites?: CoursePrerequisiteSummary[];
  unmetPrerequisites?: CoursePrerequisiteSummary[];
}

export interface CoursePrerequisiteSummary {
  id: string;
  title: string;
}

export type CatalogAvailability = "open" | "upcoming" | "closed";

export interface CatalogCourse extends Course {
  catalogAvailability: CatalogAvailability;
  enrolled: boolean;
  prerequisites: CoursePrerequisiteSummary[];
  prerequisitesMet: boolean;
  dueAt?: string | null;
  isOverdue?: boolean;
  isDueSoon?: boolean;
  progressPercent?: number;
  favorited?: boolean;
}

export type LessonKind =
  | "VIDEO"
  | "READING"
  | "DOCUMENT"
  | "QUIZ"
  | "DISCUSSION"
  | "SCORM"
  | "ILT"
  | "VILT";

export interface Lesson {
  id: string;
  courseId: string;
  moduleId?: string | null;
  title: string;
  description?: string | null;
  kind?: LessonKind;
  content?: string | null;
  videoUrl?: string | null;
  resourceUrl?: string | null;
  durationSeconds?: number | null;
  required?: boolean;
  prerequisiteLessonId?: string | null;
  quizAssessmentId?: string | null;
  order: number;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  order: number;
  lessons: Lesson[];
}

export interface CourseDetail extends Course {
  lessons: Lesson[];
  modules?: CourseModule[];
}

export interface CourseRevisionSummary {
  id: string;
  courseId: string;
  versionNumber: number;
  publishedAt: string;
  publishedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  lessonCount: number;
  moduleCount: number;
  title: string;
}

export interface CourseRevisionSnapshot {
  course: Pick<
    Course,
    | "title"
    | "description"
    | "thumbnailUrl"
    | "videoUrl"
    | "scormPackageUrl"
    | "scormVersion"
    | "durationMinutes"
    | "availableFrom"
    | "availableUntil"
    | "completionMode"
    | "completionPercent"
    | "status"
  >;
  modules: CourseModule[];
  lessons: Lesson[];
  assessments: Array<{
    id: string;
    title: string;
    kind: "PRE" | "FINAL";
    passingScore: number;
    maxAttempts: number | null;
    timeLimitSeconds: number | null;
    questions: Array<{ question: string; type: string; orderIndex: number }>;
  }>;
  prerequisites: CoursePrerequisiteSummary[];
}

export interface CourseRevisionDetail extends CourseRevisionSummary {
  snapshot: CourseRevisionSnapshot;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: string;
  progressPercent: number;
  dueAt?: string | null;
  isOverdue?: boolean;
  isDueSoon?: boolean;
  enrolledAt?: string;
  updatedAt?: string;
  lastLessonId?: string | null;
  course?: Course;
  user?: Pick<User, "id" | "firstName" | "lastName" | "email">;
}

export interface LessonProgress {
  lessonId: string;
  completed: boolean;
  positionSeconds: number;
  watchedSeconds?: number;
  openedAt?: string | null;
}

export interface EnrollmentDetail extends Enrollment {
  progress: LessonProgress[];
  certificate?: Certificate | null;
}

export type NotificationKind =
  | "DUE_REMINDER"
  | "OVERDUE"
  | "ASSIGNED"
  | "PATH_COURSE_UNLOCKED"
  | "RECERTIFY_REQUIRED"
  | "ANNOUNCEMENT"
  | "CERT_EXPIRING"
  | "CERT_EXPIRED";

export interface Announcement {
  id: string;
  organizationId: string;
  courseId: string | null;
  courseTitle?: string | null;
  title: string;
  body: string;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ForumScope = "ORGANIZATION" | "COURSE";

export interface ForumThread {
  id: string;
  scope: ForumScope;
  courseId: string | null;
  lessonId: string | null;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  postCount: number;
  author: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface ForumPost {
  id: string;
  threadId: string;
  body: string;
  author: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSession {
  id: string;
  courseId: string;
  lessonId: string;
  title: string;
  description: string;
  deliveryMode: "ILT" | "VILT";
  startsAt: string;
  endsAt: string;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  capacity: number | null;
  registrationCount: number;
  instructorUserId: string | null;
}

export interface SessionRegistration {
  id: string;
  sessionId: string;
  userId: string;
  status: string;
  registeredAt: string;
  attendedAt: string | null;
  user?: { id: string; firstName: string; lastName: string; email?: string };
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string | null;
  readAt?: string | null;
  enrollmentId?: string | null;
  courseId?: string | null;
  createdAt: string;
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  userId: string;
  issuedAt: string;
  revokedAt?: string | null;
  verificationUrl?: string;
  kind?: "course" | "path";
  enrollmentId?: string;
  courseId?: string;
  pathEnrollmentId?: string;
  pathId?: string;
  user?: Pick<User, "firstName" | "lastName">;
  course?: Pick<Course, "title">;
  path?: { title: string };
  organization?: { name: string };
}

export interface AnalyticsRiskAlert {
  severity: "high" | "medium" | "low";
  message: string;
}

export interface DashboardAnalytics {
  kpis: {
    lifetime: {
      userCount: number;
      activeUserCount: number;
      courseCount: number;
      publishedCourseCount: number;
      enrollmentCount: number;
      completionRate: number;
      certificatesIssued: number;
      averageProgressPercent: number;
      enrolledUserCount: number;
      complianceRate: number;
      estimatedLearningHours: number;
      overdueCount: number;
      dueSoonCount: number;
      staleLoginCount: number;
    };
    period: {
      activeUserCount: number;
      enrollmentCount: number;
      completionCount: number;
      certificatesIssued: number;
      estimatedLearningHours: number;
    };
  };
  enrollmentsOverTime: Array<{
    date: string;
    enrolled: number;
    completed: number;
  }>;
  topCourses: Array<{
    courseId: string;
    title: string;
    enrolled: number;
    completed: number;
    completionRate: number;
  }>;
  topDepartments?: Array<{
    id: string;
    name: string;
    enrollmentCount: number;
    completionRate: number;
  }>;
  riskAlerts?: AnalyticsRiskAlert[];
}

export interface OrgLevelRow {
  id: string;
  name: string;
  userCount: number;
  enrollmentCount: number;
  completionRate: number;
  avgProgress: number;
  participationRate?: number;
}

export interface OrgLevelAnalytics {
  rows: OrgLevelRow[];
}

export interface CourseAnalytics {
  kpis: {
    lifetime: {
      enrollmentCount: number;
      completionRate: number;
      avgDaysToComplete: number;
      dropOffRate: number;
    };
    period: {
      enrollmentCount: number;
      completionRate: number;
      passRate: number;
      avgScore: number;
    };
  };
  courses: Array<{
    courseId: string;
    title: string;
    enrolled: number;
    completed: number;
    completionRate: number;
    avgDaysToComplete: number;
    dropOffCount: number;
  }>;
  mostCompleted: CourseAnalytics["courses"];
  leastCompleted: CourseAnalytics["courses"];
}

export interface LearnerAnalytics {
  kpis: {
    lifetime: {
      userCount: number;
      estimatedLearningHours: number;
      avgHoursPerLearner: number;
      lastLoginLast7Days: number;
      lastLoginLast30Days: number;
      staleLoginCount: number;
    };
    period: {
      activeCount: number;
      inactiveCount: number;
      estimatedLearningHours: number;
    };
  };
  buckets: {
    notStarted: number;
    inProgress: number;
    completed: number;
  };
  topPerformers: Array<{
    userId: string;
    name: string;
    lastLoginAt: string | null;
    completedCount: number;
    enrollmentCount: number;
    avgProgress: number;
    estimatedHours: number;
  }>;
  atRisk: Array<{
    userId: string;
    name: string;
    reason: string;
    overdueCount: number;
    lastLoginAt: string | null;
    progressPercent: number;
  }>;
}

export interface EngagementAnalytics {
  kpis: {
    period: {
      totalLogins: number;
      activeUsers: number;
      avgDailyActiveUsers: number;
      estimatedLearningHours: number;
    };
    wau: number;
    mau: number;
  };
  trend: Array<{
    date: string;
    logins: number;
    activeUsers: number;
  }>;
}

export interface TrendsAnalytics {
  granularity: "day" | "week" | "month";
  series: {
    enrollments: Array<{ period: string; value: number }>;
    completions: Array<{ period: string; value: number }>;
    engagement: Array<{ period: string; activeUsers: number; logins: number }>;
  };
  cohorts: Array<{
    month: string;
    enrolled: number;
    completed: number;
    completionRate: number;
  }>;
  forecast: {
    trailing90dCompletions: number;
    velocityPerWeek: number;
    projectedCompletions30d: number;
  };
}

export interface SkillsAnalytics {
  kpis: {
    skillCount: number;
    demonstratedCount: number;
    gapCount: number;
  };
  skills: Array<{
    skillId: string;
    skillName: string;
    category: string | null;
    demonstratedCount: number;
    requiredCount: number;
    coveredCount: number;
    gapCount: number;
  }>;
}

export interface RoiAnalytics {
  kpis: {
    completions: number;
    totalCostCents: number;
    costPerCompletionCents: number;
    pricedCompletions: number;
    defaultCostCents: number;
    currency: "USD" | "MMK";
    currencyExponent: number;
  };
  courses: Array<{
    courseId: string;
    title: string;
    completions: number;
    costCents: number;
    totalCents: number;
  }>;
}

export interface AnalyticsDailySnapshot {
  date: string;
  metrics: {
    completionRate?: number;
    complianceRate?: number;
    enrolledUserCount?: number;
    periodActiveUsers?: number;
    periodLearningHours?: number;
    certificatesIssued?: number;
    overdueCount?: number;
  };
  createdAt: string;
}

export interface AssessmentAnalytics {
  kpis: {
    totalAttempts: number;
    passed: number;
    failed: number;
    passRate: number;
    failRate: number;
    avgScore: number;
    retakeRate: number;
  };
  hardest: Array<{
    assessmentId: string;
    title: string;
    attempts: number;
    passRate: number;
    avgScore: number;
  }>;
}

export interface FlatOrgNode {
  id: string;
  name: string;
  type: NodeType;
  depth: number;
  parentId: string | null;
  parentType: NodeType | null;
  sortOrder: number;
  email?: string;
  role?: UserRole;
  childCount: number;
  path: Array<{ id: string; name: string; type: NodeType }>;
}

export interface AssessmentOption {
  id: string;
  text: string;
}

export interface Assessment {
  id: string;
  courseId: string;
  title: string;
  kind: "PRE" | "FINAL" | "SURVEY" | "MODULE_QUIZ";
  passingScore: number;
  maxAttempts: number | null;
  timeLimitSeconds?: number | null;
  bankId?: string | null;
  drawCount?: number | null;
  drawTags?: string[];
  lessonId?: string | null;
  anonymous?: boolean;
  questionCount: number;
  questions?: AssessmentQuestion[];
  activeAttempt?: AssessmentAttempt;
}

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  type?: "MCQ" | "TRUE_FALSE" | "MULTI_SELECT" | "SHORT_ANSWER" | "FILL_BLANK" | "MATCHING" | "ESSAY";
  options: AssessmentOption[];
  order: number;
  points?: number;
  explanation?: string;
  difficulty?: string;
  metadata?: Record<string, unknown>;
  correctOptionId?: string;
  correctOptionIds?: string[];
}

export interface AssessmentAttempt {
  id: string;
  score: number | null;
  passed: boolean;
  attemptNumber: number;
  gradingStatus?: string;
  startedAt?: string | null;
  expiresAt?: string | null;
  submittedAt?: string;
  createdAt?: string;
  instructorFeedback?: string | null;
  answers?: Array<{
    questionId: string;
    optionId?: string;
    optionIds?: string[];
    text?: string;
    blanks?: Array<{ blankId: string; text: string }>;
    matches?: Array<{ leftId: string; rightId: string }>;
  }>;
}

export interface AttemptReviewItem {
  questionId: string;
  prompt: string;
  type: "MCQ" | "TRUE_FALSE" | "MULTI_SELECT" | "SHORT_ANSWER" | "FILL_BLANK" | "MATCHING" | "ESSAY";
  options: AssessmentOption[];
  metadata?: Record<string, unknown>;
  points?: number;
  explanation?: string;
  learnerAnswer: {
    questionId: string;
    optionId?: string;
    optionIds?: string[];
    text?: string;
    blanks?: Array<{ blankId: string; text: string }>;
    matches?: Array<{ leftId: string; rightId: string }>;
  } | null;
  correct: boolean | null;
  correctOptionId?: string;
  correctOptionIds?: string[];
  correctBlanks?: Record<string, string[]>;
  correctMatches?: Record<string, string>;
}

export interface AssessmentAttemptReview {
  assessment: {
    id: string;
    title: string;
    passingScore: number;
    kind: "PRE" | "FINAL";
  };
  attempt: AssessmentAttempt;
  showAnswers: boolean;
  items: AttemptReviewItem[];
}

export interface AssessmentStartResult {
  attempt: AssessmentAttempt;
  questions: AssessmentQuestion[];
  expiresAt: string | null;
}

export interface QuestionBank {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  questions?: BankQuestion[];
}

export interface BankQuestion {
  id: string;
  bankId: string;
  question: string;
  type: "MCQ" | "TRUE_FALSE" | "MULTI_SELECT" | "SHORT_ANSWER";
  options: AssessmentOption[];
  tags?: string[];
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  courseCount: number;
  courses?: PathCourse[];
}

export interface PathCourse {
  id: string;
  pathId: string;
  courseId: string;
  orderIndex: number;
  required: boolean;
  course?: Pick<Course, "id" | "title" | "status">;
}

export interface PathEnrollment {
  id: string;
  pathId: string;
  userId: string;
  status: string;
  progressPercent: number;
  path?: Pick<LearningPath, "id" | "title" | "status">;
  user?: Pick<User, "id" | "firstName" | "lastName" | "email">;
}

export type PathCourseLearnerState = "LOCKED" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface PathCourseLearnerProgress {
  courseId: string;
  title: string;
  orderIndex: number;
  required: boolean;
  state: PathCourseLearnerState;
  progressPercent: number;
  enrollmentId: string | null;
}

export interface PathLearnerProgress {
  path: Pick<LearningPath, "id" | "title" | "description" | "status">;
  pathEnrollment: PathEnrollment | null;
  courses: PathCourseLearnerProgress[];
}

export interface PathAssignment {
  id: string;
  pathId: string;
  targetType: string;
  targetId: string;
  createdAt?: string;
}

export interface AssignPathResult {
  assignment: PathAssignment;
  enrolledCount: number;
  alreadyEnrolledCount: number;
  skippedInactiveCount: number;
  created: boolean;
}

export interface ComplianceAnalytics {
  overdueCount: number;
  dueSoonCount: number;
  onTrackCount: number;
  items: Array<{
    enrollmentId: string;
    userId: string;
    userName: string;
    courseId: string;
    courseTitle: string;
    dueAt: string | null;
    status: string;
    progressPercent: number;
    complianceStatus: "OVERDUE" | "DUE_SOON" | "ON_TRACK" | "COMPLETED";
    departmentId?: string | null;
    departmentName?: string | null;
  }>;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  mandatoryTotal?: number;
  mandatoryCompleted?: number;
  mandatoryCompletionRate?: number;
  riskDepartments?: Array<{
    id: string;
    name: string;
    overdueCount: number;
    dueSoonCount: number;
  }>;
  expiringCerts?: Array<{
    certificateId: string;
    userName: string;
    courseTitle: string;
    issuedAt: string;
    expiresAt: string;
    recertifyEveryDays: number;
  }>;
}

export interface PendingReviewAttempt {
  id: string;
  score: number | null;
  passed: boolean;
  attemptNumber: number;
  gradingStatus: string;
  submittedAt: string;
  assessment: { id: string; title: string; courseId: string; passingScore: number };
  user: { id: string; firstName: string; lastName: string; email: string };
  questions: AssessmentQuestion[];
  answers: Array<{
    questionId: string;
    optionId?: string;
    optionIds?: string[];
    text?: string;
  }>;
}

export interface AssessmentSubmitResult {
  attempt: AssessmentAttempt;
  certificate?: Certificate | null;
  pendingReview?: boolean;
  survey?: boolean;
}

export interface CertificateVerification {
  valid: boolean;
  reason?: string;
  kind?: "course" | "path";
  holderName?: string;
  courseTitle?: string;
  pathTitle?: string;
  issuedAt?: string;
  organizationName?: string;
  template?: CertificateTemplate;
}
