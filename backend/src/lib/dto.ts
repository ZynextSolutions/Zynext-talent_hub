import type { Course, Enrollment, Lesson, Organization, User, Role } from '@prisma/client';
import { env } from '../config/env';
import { DEFAULT_ORG_SETTINGS } from '../config/constants';
import { parseCertificateTemplate } from '../types/dto';
import { parseTrainingCurrency, resolveDefaultTrainingCostMinor } from './money';

type OrgSettings = typeof DEFAULT_ORG_SETTINGS & Record<string, unknown>;

export function parseSettings(raw: unknown): OrgSettings {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    ...obj,
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
      typeof obj.certificatePrefix === 'string' ? obj.certificatePrefix : DEFAULT_ORG_SETTINGS.certificatePrefix,
    showAnswersAfterAttempt:
      typeof obj.showAnswersAfterAttempt === 'boolean'
        ? obj.showAnswersAfterAttempt
        : DEFAULT_ORG_SETTINGS.showAnswersAfterAttempt,
    certificateTemplate: parseCertificateTemplate(obj.certificateTemplate),
    trainingCurrency: parseTrainingCurrency(obj.trainingCurrency, DEFAULT_ORG_SETTINGS.trainingCurrency),
    defaultTrainingCostMinor: resolveDefaultTrainingCostMinor(obj),
  };
}

export function toOrganizationDto(org: Organization) {
  const settings = parseSettings(org.settings);
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: (settings.logoUrl as string | undefined) ?? null,
    settings,
    status: org.status,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export function toUserDto(user: User & { role: Role }) {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: null as string | null,
    role: user.role.name,
    status: user.status,
    divisionId: user.divisionId,
    departmentId: user.departmentId,
    teamId: user.teamId,
    lastLoginAt: null as string | null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toLessonDto(lesson: Lesson) {
  return {
    id: lesson.id,
    organizationId: lesson.organizationId,
    courseId: lesson.courseId,
    moduleId: lesson.moduleId ?? null,
    title: lesson.title,
    description: lesson.description,
    kind: lesson.kind,
    order: lesson.orderIndex,
    content: lesson.content,
    videoUrl: lesson.videoUrl,
    resourceUrl: lesson.resourceUrl,
    durationSeconds: lesson.durationSeconds,
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
  };
}

export function toCourseDto(
  course: Course & { _count?: { lessons: number; enrollments?: number }; lessons?: Lesson[] },
) {
  return {
    id: course.id,
    organizationId: course.organizationId,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    videoUrl: course.videoUrl,
    scormPackageUrl: course.scormPackageUrl,
    status: course.status,
    durationMinutes: course.durationMinutes,
    createdByUserId: course.createdByUserId,
    lessonCount: course._count?.lessons ?? course.lessons?.length ?? 0,
    enrollmentCount: course._count?.enrollments,
    publishedAt: course.publishedAt?.toISOString() ?? (course.status === 'PUBLISHED' ? course.updatedAt.toISOString() : null),
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

export function toEnrollmentDto(
  enrollment: Enrollment & {
    course?: Course;
    user?: { id: string; firstName: string; lastName: string; email: string };
  },
) {
  return {
    id: enrollment.id,
    organizationId: enrollment.organizationId,
    userId: enrollment.userId,
    courseId: enrollment.courseId,
    status: enrollment.status,
    progressPercent: Math.round(enrollment.progressPct),
    completedAt: enrollment.completedAt?.toISOString() ?? null,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    updatedAt: enrollment.updatedAt.toISOString(),
    course: enrollment.course ? toCourseDto(enrollment.course) : undefined,
    user: enrollment.user
      ? {
          id: enrollment.user.id,
          firstName: enrollment.user.firstName,
          lastName: enrollment.user.lastName,
          email: enrollment.user.email,
        }
      : undefined,
  };
}

export function verificationUrl(certificateNumber: string) {
  return `${env.publicWebUrl}/verify/${certificateNumber}`;
}
