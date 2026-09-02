import { Prisma, type CourseStatus } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { parsePagination, paginationMeta, toSkipTake } from '../lib/pagination';
import {
  toAssignmentDto,
  toCourseDto,
  toCourseModuleDto,
  toEnrollmentDto,
  toLessonDto,
  enrollmentComplianceFlags,
} from '../lib/mappers';
import { courseRepository } from '../repositories/course.repository';
import { courseModuleRepository } from '../repositories/module.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { prisma } from '../repositories/prisma';
import type { AuthPrincipal } from '../types/auth';
import { assertHttpsUrl, assertMediaUrl } from '../lib/url';
import { saveCourseThumbnail, saveCourseIntroVideo } from '../lib/uploads';
import {
  assertCourseAvailableNow,
  getCatalogAvailability,
} from '../lib/course-availability';
import { organizationRepository } from '../repositories/organization.repository';
import { coursePrerequisiteRepository } from '../repositories/course-prerequisite.repository';
import { courseRevisionRepository } from '../repositories/course-revision.repository';
import { courseFavoriteRepository } from '../repositories/course-favorite.repository';
import { assessmentRepository } from '../repositories/assessment.repository';
import type { CatalogCourseDto, CoursePrerequisiteSummaryDto } from '../types/dto';
import { buildCourseRevisionSnapshot } from '../lib/course-revision-snapshot';
import {
  toCourseRevisionDetailDto,
  toCourseRevisionSummaryDto,
} from '../lib/mappers';
import { parseSettings } from '../lib/mappers';
import {
  assertCoursePrerequisitesMet,
  getUnmetCoursePrerequisites,
  validateCoursePrerequisiteIds,
} from '../lib/course-prerequisites';
import { assertValidCompletionSettings } from '../lib/completion-rules';
import { assertQuizLessonsHaveAssessment, assertVideoLessonsHaveDuration } from '../lib/lesson-completion';

class CourseService {
  async list(
    organizationId: string,
    query: { page?: number; pageSize?: number; q?: string; status?: CourseStatus },
    actor: AuthPrincipal,
  ) {
    const pg = parsePagination(query.page, query.pageSize);
    const canAuthor = actor.permissions.includes('course:write');
    const { items, total } = await courseRepository.list(organizationId, {
      ...toSkipTake(pg),
      q: query.q,
      status: canAuthor || actor.role === 'EMPLOYEE' ? query.status : 'PUBLISHED',
      enrolledUserId: actor.role === 'EMPLOYEE' ? actor.sub : undefined,
    });
    return {
      items: items.map((c) => toCourseDto(c, c._count.lessons)),
      pagination: paginationMeta(pg.page, pg.pageSize, total),
    };
  }

  async get(organizationId: string, id: string, actor: AuthPrincipal) {
    const course = await this.assertCanRead(organizationId, id, actor);
    const dto = toCourseDto(course, course._count.lessons);
    const canSeeAssignments = actor.permissions.includes('course:assign') || actor.permissions.includes('org:write');
    const prerequisiteRows = await coursePrerequisiteRepository.listByCourse(organizationId, id);
    const prerequisites: CoursePrerequisiteSummaryDto[] = prerequisiteRows.map((row) => ({
      id: row.prerequisiteCourse.id,
      title: row.prerequisiteCourse.title,
    }));
    const unmetPrerequisites =
      actor.actorType === 'user'
        ? await getUnmetCoursePrerequisites(organizationId, actor.sub, id)
        : undefined;
    return {
      ...dto,
      lessons: course.lessons.map(toLessonDto),
      modules: (course.modules ?? []).map(toCourseModuleDto),
      assignments: canSeeAssignments ? course.courseAssignments.map(toAssignmentDto) : undefined,
      prerequisites,
      unmetPrerequisites,
    };
  }

  async create(
    organizationId: string,
    actor: AuthPrincipal,
    body: {
      title: string;
      description?: string;
      thumbnailUrl?: string | null;
      videoUrl?: string | null;
      scormPackageUrl?: string | null;
      durationMinutes?: number | null;
    },
  ) {
    assertMediaUrl(body.thumbnailUrl);
    assertMediaUrl(body.videoUrl);
    assertHttpsUrl(body.scormPackageUrl);
    const createdByUserId = actor.actorType === 'user' ? actor.sub : null;
    const row = await courseRepository.create(organizationId, {
      organizationId,
      title: body.title,
      description: body.description ?? '',
      thumbnailUrl: body.thumbnailUrl ?? null,
      videoUrl: body.videoUrl ?? null,
      scormPackageUrl: body.scormPackageUrl ?? null,
      durationMinutes: body.durationMinutes ?? null,
      createdByUserId,
      status: 'DRAFT',
    });
    await courseModuleRepository.create({
      organizationId,
      courseId: row.id,
      title: 'Week 1',
      description: null,
      orderIndex: 0,
    });
    return toCourseDto(row, 0);
  }

  async update(
    organizationId: string,
    id: string,
    actor: AuthPrincipal,
    body: {
      title?: string;
      description?: string;
      thumbnailUrl?: string | null;
      videoUrl?: string | null;
      scormPackageUrl?: string | null;
      durationMinutes?: number | null;
      costCents?: number | null;
      availableFrom?: string | null;
      availableUntil?: string | null;
      completionMode?: 'ALL_LESSONS' | 'REQUIRED_LESSONS' | 'PERCENTAGE';
      completionPercent?: number | null;
      requirePreAssessment?: boolean;
    },
  ) {
    await this.assertCanWrite(organizationId, id, actor);
    assertMediaUrl(body.thumbnailUrl);
    assertMediaUrl(body.videoUrl);
    assertHttpsUrl(body.scormPackageUrl);
    const { availableFrom, availableUntil, ...rest } = body;
    const row = await courseRepository.update(organizationId, id, {
      ...rest,
      ...(availableFrom !== undefined
        ? { availableFrom: availableFrom ? new Date(availableFrom) : null }
        : {}),
      ...(availableUntil !== undefined
        ? { availableUntil: availableUntil ? new Date(availableUntil) : null }
        : {}),
    });
    if (!row) throw AppError.from('NOT_FOUND');
    return toCourseDto(row, row._count.lessons);
  }

  async publish(organizationId: string, id: string, actor: AuthPrincipal) {
    const course = await this.assertCanWrite(organizationId, id, actor);
    if (!course.title.trim()) throw AppError.from('VALIDATION_ERROR', 'Title is required.');
    assertValidCompletionSettings(course.completionMode, course.completionPercent);
    const videoDurationError = assertVideoLessonsHaveDuration(course.lessons ?? []);
    if (videoDurationError) throw AppError.from('VALIDATION_ERROR', videoDurationError);
    const quizAssessmentError = assertQuizLessonsHaveAssessment(course.lessons ?? []);
    if (quizAssessmentError) throw AppError.from('VALIDATION_ERROR', quizAssessmentError);
    const hasScormPackage = Boolean(course.scormPackageUrl?.startsWith('/uploads/scorm/'));
    if (course._count.lessons < 1 && !hasScormPackage) throw AppError.from('COURSE_NO_LESSONS');

    const publishedAt = new Date();
    const row = await prisma.$transaction(async (tx) => {
      const freshCourse = await courseRepository.withTx(tx).getById(organizationId, id);
      if (!freshCourse) throw AppError.from('NOT_FOUND');
      const assessments = await assessmentRepository.withTx(tx).listByCourseWithQuestions(organizationId, id);
      const prerequisites = await coursePrerequisiteRepository.withTx(tx).listByCourse(organizationId, id);
      const snapshot = buildCourseRevisionSnapshot(freshCourse, assessments, prerequisites);
      const versionNumber = await courseRevisionRepository.withTx(tx).nextVersionNumber(id);
      await courseRevisionRepository.withTx(tx).create({
        organizationId,
        courseId: id,
        versionNumber,
        publishedAt,
        publishedByUserId: actor.actorType === 'user' ? actor.sub : null,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      });
      return courseRepository.withTx(tx).update(organizationId, id, {
        status: 'PUBLISHED',
        publishedAt,
      });
    });
    return toCourseDto(row!, row!._count.lessons);
  }

  async listRevisions(organizationId: string, id: string, actor: AuthPrincipal) {
    await this.assertCanRead(organizationId, id, actor);
    const rows = await courseRevisionRepository.listByCourse(organizationId, id);
    return rows.map(toCourseRevisionSummaryDto);
  }

  async getRevision(
    organizationId: string,
    courseId: string,
    revisionId: string,
    actor: AuthPrincipal,
  ) {
    await this.assertCanRead(organizationId, courseId, actor);
    const row = await courseRevisionRepository.getById(organizationId, courseId, revisionId);
    if (!row) throw AppError.from('NOT_FOUND');
    return toCourseRevisionDetailDto(row);
  }

  async archive(organizationId: string, id: string, actor: AuthPrincipal) {
    await this.assertCanWrite(organizationId, id, actor);
    const row = await courseRepository.update(organizationId, id, { status: 'ARCHIVED' });
    return toCourseDto(row!, row!._count.lessons);
  }

  async unarchive(organizationId: string, id: string, actor: AuthPrincipal) {
    const course = await courseRepository.getById(organizationId, id);
    if (!course) throw AppError.from('NOT_FOUND');
    if (course.status !== 'ARCHIVED') {
      throw AppError.from('VALIDATION_ERROR', 'Only archived courses can be unarchived.');
    }
    if (actor.role === 'INSTRUCTOR' && course.createdByUserId !== actor.sub) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    const row = await courseRepository.update(organizationId, id, { status: 'DRAFT' });
    return toCourseDto(row!, row!._count.lessons);
  }

  async catalog(
    organizationId: string,
    query: {
      page?: number;
      pageSize?: number;
      q?: string;
      availability?: 'open' | 'upcoming';
      enrolled?: boolean;
      prerequisitesMet?: boolean;
      duration?: 'short' | 'medium' | 'long';
    },
    actor: AuthPrincipal,
  ) {
    const pg = parsePagination(query.page, query.pageSize);
    const enrolledCourseIds = new Set<string>();
    const completedCourseIds = new Set<string>();
    const favoriteCourseIds = new Set<string>();
    const enrollmentByCourseId = new Map<
      string,
      Awaited<ReturnType<typeof enrollmentRepository.list>>['items'][number]
    >();
    if (actor.actorType === 'user') {
      const [enrollments, favorites] = await Promise.all([
        enrollmentRepository.list(organizationId, {
          userId: actor.sub,
          skip: 0,
          take: 500,
        }),
        courseFavoriteRepository.listCourseIds(organizationId, actor.sub),
      ]);
      for (const courseId of favorites) favoriteCourseIds.add(courseId);
      for (const row of enrollments.items) {
        if (row.status !== 'REVOKED') {
          enrolledCourseIds.add(row.courseId);
          enrollmentByCourseId.set(row.courseId, row);
        }
        if (row.status === 'COMPLETED') completedCourseIds.add(row.courseId);
      }
    }
    const { items, total } = await courseRepository.listCatalog(organizationId, {
      ...toSkipTake(pg),
      q: query.q,
      availability: query.availability,
      enrolledUserId: query.enrolled === true && actor.actorType === 'user' ? actor.sub : undefined,
      excludeEnrolledUserId: query.enrolled === false && actor.actorType === 'user' ? actor.sub : undefined,
      prerequisitesMetCompletedIds: query.prerequisitesMet
        ? [...completedCourseIds]
        : undefined,
      duration: query.duration,
    });
    const prerequisiteDetails = await Promise.all(
      items.map((course) => coursePrerequisiteRepository.listByCourse(organizationId, course.id)),
    );
    const catalogItems: CatalogCourseDto[] = items.map((course, index) => {
      const prerequisites = prerequisiteDetails[index]!.map((row) => ({
        id: row.prerequisiteCourse.id,
        title: row.prerequisiteCourse.title,
      }));
      const prerequisitesMet =
        actor.actorType !== 'user' ||
        prerequisites.every((prerequisite) => completedCourseIds.has(prerequisite.id));
      const enrollment = enrollmentByCourseId.get(course.id);
      const dueFlags = enrollment ? enrollmentComplianceFlags(enrollment) : null;
      return {
        ...toCourseDto(course, course._count.lessons),
        catalogAvailability: getCatalogAvailability(course),
        enrolled: enrolledCourseIds.has(course.id),
        favorited: favoriteCourseIds.has(course.id),
        prerequisites,
        prerequisitesMet,
        ...(enrollment && enrollment.status !== 'COMPLETED'
          ? {
              dueAt: enrollment.dueAt?.toISOString() ?? null,
              isOverdue: dueFlags?.isOverdue ?? false,
              isDueSoon: dueFlags?.isDueSoon ?? false,
              progressPercent: Math.floor(enrollment.progressPct),
            }
          : {}),
      };
    });
    return {
      items: catalogItems,
      pagination: paginationMeta(pg.page, pg.pageSize, total),
    };
  }

  async selfEnroll(organizationId: string, courseId: string, actor: AuthPrincipal) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    const org = await organizationRepository.getById(organizationId);
    if (!org) throw AppError.from('NOT_FOUND');
    const settings = parseSettings(org.settings);
    if (!settings.allowSelfEnrollment) throw AppError.from('RBAC_FORBIDDEN');

    const course = await courseRepository.getById(organizationId, courseId);
    if (!course || course.status !== 'PUBLISHED') throw AppError.from('NOT_FOUND');
    assertCourseAvailableNow(course);
    await assertCoursePrerequisitesMet(organizationId, actor.sub, courseId);

    const { enrollment, created } = await enrollmentRepository.upsertEnroll(
      organizationId,
      actor.sub,
      courseId,
    );
    return { enrollment: toEnrollmentDto(enrollment), created };
  }

  async setPrerequisites(
    organizationId: string,
    courseId: string,
    actor: AuthPrincipal,
    prerequisiteCourseIds: string[],
  ) {
    await this.assertCanWrite(organizationId, courseId, actor);
    await validateCoursePrerequisiteIds(organizationId, courseId, prerequisiteCourseIds);
    const rows = await coursePrerequisiteRepository.replace(
      organizationId,
      courseId,
      prerequisiteCourseIds,
    );
    return rows.map((row) => ({
      id: row.prerequisiteCourse.id,
      title: row.prerequisiteCourse.title,
    }));
  }

  async uploadThumbnail(
    organizationId: string,
    id: string,
    actor: AuthPrincipal,
    filename: string,
    buffer: Buffer,
  ) {
    await this.assertCanWrite(organizationId, id, actor);
    const thumbnailUrl = await saveCourseThumbnail(organizationId, id, filename, buffer);
    const row = await courseRepository.update(organizationId, id, { thumbnailUrl });
    return toCourseDto(row!, row!._count.lessons);
  }

  async uploadIntroVideo(
    organizationId: string,
    id: string,
    actor: AuthPrincipal,
    filename: string,
    buffer: Buffer,
  ) {
    await this.assertCanWrite(organizationId, id, actor);
    const videoUrl = await saveCourseIntroVideo(organizationId, id, filename, buffer);
    const row = await courseRepository.update(organizationId, id, { videoUrl });
    return toCourseDto(row!, row!._count.lessons);
  }

  async duplicate(
    organizationId: string,
    id: string,
    actor: AuthPrincipal,
    includeAssignments = false,
  ) {
    const course = await this.assertCanWrite(organizationId, id, actor);
    const copy = await prisma.$transaction(async (tx) => {
      const created = await tx.course.create({
        data: {
          organizationId,
          title: `${course.title} (copy)`,
          description: course.description,
          thumbnailUrl: course.thumbnailUrl,
          videoUrl: course.videoUrl,
          scormPackageUrl: null,
          scormVersion: null,
          durationMinutes: course.durationMinutes,
          availableFrom: course.availableFrom,
          availableUntil: course.availableUntil,
          completionMode: course.completionMode,
          completionPercent: course.completionPercent,
          createdByUserId: actor.actorType === 'user' ? actor.sub : course.createdByUserId,
          status: 'DRAFT',
        },
      });
      const moduleIdMap = new Map<string, string>();
      const sourceModules = [...(course.modules ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
      for (const module of sourceModules) {
        const copied = await tx.courseModule.create({
          data: {
            organizationId,
            courseId: created.id,
            title: module.title,
            description: module.description,
            orderIndex: module.orderIndex,
          },
        });
        moduleIdMap.set(module.id, copied.id);
      }
      const lessonIdMap = new Map<string, string>();
      const sortedLessons = [...course.lessons].sort((a, b) => a.orderIndex - b.orderIndex);
      for (const lesson of sortedLessons) {
        if (lesson.kind === 'SCORM') continue;
        const copiedLesson = await tx.lesson.create({
          data: {
            organizationId,
            courseId: created.id,
            moduleId: lesson.moduleId ? (moduleIdMap.get(lesson.moduleId) ?? null) : null,
            title: lesson.title,
            description: lesson.description,
            kind: lesson.kind,
            content: lesson.content,
            videoUrl: lesson.videoUrl,
            resourceUrl: lesson.resourceUrl,
            durationSeconds: lesson.durationSeconds,
            required: lesson.required,
            orderIndex: lesson.orderIndex,
          },
        });
        lessonIdMap.set(lesson.id, copiedLesson.id);
      }
      for (const lesson of sortedLessons) {
        if (lesson.kind === 'SCORM' || !lesson.prerequisiteLessonId) continue;
        const newLessonId = lessonIdMap.get(lesson.id);
        const newPrerequisiteId = lessonIdMap.get(lesson.prerequisiteLessonId);
        if (newLessonId && newPrerequisiteId) {
          await tx.lesson.update({
            where: { id: newLessonId },
            data: { prerequisiteLessonId: newPrerequisiteId },
          });
        }
      }
      const prerequisites = await tx.coursePrerequisite.findMany({
        where: { organizationId, courseId: course.id },
      });
      for (const prerequisite of prerequisites) {
        await tx.coursePrerequisite.create({
          data: {
            organizationId,
            courseId: created.id,
            prerequisiteCourseId: prerequisite.prerequisiteCourseId,
          },
        });
      }
      if (includeAssignments) {
        for (const assignment of course.courseAssignments ?? []) {
          await tx.courseAssignment.create({
            data: {
              organizationId,
              courseId: created.id,
              targetType: assignment.targetType,
              targetId: assignment.targetId,
              createdByUserId: actor.actorType === 'user' ? actor.sub : assignment.createdByUserId,
              dueAt: assignment.dueAt,
              recertifyEveryDays: assignment.recertifyEveryDays,
              reminderDaysBefore: assignment.reminderDaysBefore,
            },
          });
        }
      }
      const assessments = await tx.assessment.findMany({
        where: { organizationId, courseId: course.id },
        include: { questions: { orderBy: { orderIndex: 'asc' } } },
      });
      for (const assessment of assessments) {
        const copiedAssessment = await tx.assessment.create({
          data: {
            organizationId,
            courseId: created.id,
            title: assessment.title,
            kind: assessment.kind,
            passingScore: assessment.passingScore,
            maxAttempts: assessment.maxAttempts,
            timeLimitSeconds: assessment.timeLimitSeconds,
            bankId: assessment.bankId,
            drawCount: assessment.drawCount,
          },
        });
        for (const question of assessment.questions) {
          await tx.assessmentQuestion.create({
            data: {
              assessmentId: copiedAssessment.id,
              bankQuestionId: question.bankQuestionId,
              question: question.question,
              type: question.type,
              options: question.options as Prisma.InputJsonValue,
              correctOptionId: question.correctOptionId,
              correctOptionIds:
                question.correctOptionIds === null
                  ? Prisma.JsonNull
                  : (question.correctOptionIds as Prisma.InputJsonValue),
              orderIndex: question.orderIndex,
            },
          });
        }
      }
      return tx.course.findFirst({
        where: { id: created.id },
        include: { _count: { select: { lessons: true, enrollments: { where: { status: { not: 'REVOKED' } } } } } },
      });
    });
    return toCourseDto(copy!, copy!._count.lessons);
  }

  async remove(organizationId: string, id: string, actor: AuthPrincipal, force?: boolean) {
    await this.assertCanWrite(organizationId, id, actor);
    const blocking = await courseRepository.countBlockingEnrollments(organizationId, id);
    if (blocking > 0) {
      if (force !== true || actor.role !== 'ORG_ADMIN') throw AppError.from('COURSE_HAS_ACTIVE_ENROLLMENTS');
      await prisma.enrollment.updateMany({
        where: { organizationId, courseId: id, status: { in: ['ENROLLED', 'IN_PROGRESS'] } },
        data: { status: 'REVOKED' },
      });
    }
    await courseRepository.softDelete(organizationId, id);
    return { id };
  }

  async assertCanRead(organizationId: string, id: string, actor: AuthPrincipal) {
    const course = await courseRepository.getByIdWithLessons(organizationId, id);
    if (!course) throw AppError.from('NOT_FOUND');
    if (actor.role === 'EMPLOYEE') {
      const enrollment = await enrollmentRepository.findByUserCourse(organizationId, actor.sub, id);
      if (!enrollment || enrollment.status === 'REVOKED') throw AppError.from('NOT_FOUND');
      assertCourseAvailableNow(course);
      return course;
    }
    if (!actor.permissions.includes('course:write') && course.status !== 'PUBLISHED') {
      throw AppError.from('NOT_FOUND');
    }
    if (course.status === 'PUBLISHED' && !actor.permissions.includes('course:write')) {
      assertCourseAvailableNow(course);
    }
    return course;
  }

  async assertCanWrite(organizationId: string, id: string, actor: AuthPrincipal) {
    if (!actor.permissions.includes('course:write')) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    const course = await courseRepository.getById(organizationId, id);
    if (!course) throw AppError.from('NOT_FOUND');
    if (course.status === 'ARCHIVED') throw AppError.from('COURSE_ARCHIVED');
    if (actor.role === 'INSTRUCTOR' && course.createdByUserId !== actor.sub) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    return course;
  }

  async addFavorite(organizationId: string, courseId: string, actor: AuthPrincipal) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    const course = await courseRepository.getById(organizationId, courseId);
    if (!course || course.status !== 'PUBLISHED' || course.deletedAt) {
      throw AppError.from('NOT_FOUND');
    }
    assertCourseAvailableNow(course);
    try {
      await courseFavoriteRepository.add(organizationId, actor.sub, courseId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { favorited: true };
      }
      throw error;
    }
    return { favorited: true };
  }

  async removeFavorite(organizationId: string, courseId: string, actor: AuthPrincipal) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    await courseFavoriteRepository.remove(organizationId, actor.sub, courseId);
    return { favorited: false };
  }
}

export const courseService = new CourseService();
