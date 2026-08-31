import { AppError } from '../errors/app-error';
import { toLessonDto } from '../lib/mappers';
import { assertMediaUrl } from '../lib/url';
import {
  isLessonAssetKind,
  publicAssetUrl,
  saveLessonAsset,
  type LessonAssetKind,
} from '../lib/uploads';
import { prisma } from '../repositories/prisma';
import { courseService } from './course.service';
import { courseModuleRepository } from '../repositories/module.repository';
import { lessonRepository } from '../repositories/lesson.repository';
import { progressRepository } from '../repositories/progress.repository';
import type { AuthPrincipal } from '../types/auth';
import type { LessonKind } from '@prisma/client';
import { lessonPrerequisiteCreatesCycle } from '../lib/course-prerequisites';

function inferLessonKind(body: {
  kind?: LessonKind;
  videoUrl?: string | null;
  resourceUrl?: string | null;
}): LessonKind {
  if (body.kind) return body.kind;
  if (body.videoUrl) return 'VIDEO';
  if (body.resourceUrl) return 'DOCUMENT';
  return 'READING';
}

class LessonService {
  async list(organizationId: string, courseId: string, actor: AuthPrincipal) {
    await courseService.assertCanRead(organizationId, courseId, actor);
    const lessons = await lessonRepository.listByCourse(organizationId, courseId);
    return lessons.map(toLessonDto);
  }

  async create(
    organizationId: string,
    courseId: string,
    actor: AuthPrincipal,
    body: {
      title: string;
      description?: string | null;
      kind?: LessonKind;
      content?: string | null;
      videoUrl?: string | null;
      resourceUrl?: string | null;
      durationSeconds?: number | null;
      required?: boolean;
      prerequisiteLessonId?: string | null;
      order?: number;
      moduleId?: string | null;
    },
  ) {
    await courseService.assertCanWrite(organizationId, courseId, actor);
    assertMediaUrl(body.videoUrl);
    assertMediaUrl(body.resourceUrl);
    if (body.prerequisiteLessonId) {
      const prerequisite = await lessonRepository.getById(organizationId, body.prerequisiteLessonId);
      if (!prerequisite || prerequisite.courseId !== courseId) {
        throw AppError.from('VALIDATION_ERROR', 'Prerequisite lesson must belong to this course.');
      }
    }
    const moduleId = await this.resolveModuleId(organizationId, courseId, body.moduleId);
    const existing = await lessonRepository.listByCourse(organizationId, courseId);
    const orderIndex = body.order ?? existing.length;
    const row = await lessonRepository.create(organizationId, {
      organizationId,
      courseId,
      moduleId,
      title: body.title,
      description: body.description ?? null,
      kind: inferLessonKind(body),
      content: body.content ?? '',
      videoUrl: body.videoUrl ?? null,
      resourceUrl: body.resourceUrl ?? null,
      durationSeconds: body.durationSeconds ?? null,
      required: body.required ?? true,
      prerequisiteLessonId: body.prerequisiteLessonId ?? null,
      orderIndex,
    });
    await this.reindex(organizationId, courseId);
    await progressRepository.recalcEnrollmentPercents(organizationId, courseId);
    return toLessonDto((await lessonRepository.getById(organizationId, row.id))!);
  }

  async update(
    organizationId: string,
    id: string,
    actor: AuthPrincipal,
    body: {
      title?: string;
      description?: string | null;
      kind?: LessonKind;
      content?: string | null;
      videoUrl?: string | null;
      resourceUrl?: string | null;
      durationSeconds?: number | null;
      moduleId?: string | null;
      required?: boolean;
      prerequisiteLessonId?: string | null;
    },
  ) {
    const lesson = await lessonRepository.getById(organizationId, id);
    if (!lesson) throw AppError.from('NOT_FOUND');
    await courseService.assertCanWrite(organizationId, lesson.courseId, actor);
    assertMediaUrl(body.videoUrl);
    assertMediaUrl(body.resourceUrl);
    if (body.prerequisiteLessonId !== undefined && body.prerequisiteLessonId !== null) {
      const prerequisite = await lessonRepository.getById(organizationId, body.prerequisiteLessonId);
      if (!prerequisite || prerequisite.courseId !== lesson.courseId) {
        throw AppError.from('VALIDATION_ERROR', 'Prerequisite lesson must belong to this course.');
      }
      if (prerequisite.id === id) {
        throw AppError.from('VALIDATION_ERROR', 'A lesson cannot require itself.');
      }
      const courseLessons = await lessonRepository.listByCourse(organizationId, lesson.courseId);
      if (
        lessonPrerequisiteCreatesCycle(
          id,
          body.prerequisiteLessonId,
          courseLessons.map((row) => ({
            id: row.id,
            prerequisiteLessonId:
              row.id === id ? (body.prerequisiteLessonId ?? null) : row.prerequisiteLessonId,
          })),
        )
      ) {
        throw AppError.from('VALIDATION_ERROR', 'Prerequisite would create a circular dependency.');
      }
    }
    const moduleId =
      body.moduleId !== undefined
        ? await this.resolveModuleId(organizationId, lesson.courseId, body.moduleId)
        : undefined;
    const row = await lessonRepository.update(organizationId, id, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.kind !== undefined ? { kind: body.kind } : {}),
      ...(body.content !== undefined ? { content: body.content ?? '' } : {}),
      ...(body.videoUrl !== undefined ? { videoUrl: body.videoUrl } : {}),
      ...(body.resourceUrl !== undefined ? { resourceUrl: body.resourceUrl } : {}),
      ...(body.durationSeconds !== undefined ? { durationSeconds: body.durationSeconds } : {}),
      ...(body.required !== undefined ? { required: body.required } : {}),
      ...(body.prerequisiteLessonId !== undefined
        ? { prerequisiteLessonId: body.prerequisiteLessonId }
        : {}),
      ...(moduleId !== undefined ? { moduleId } : {}),
    });
    if (body.required !== undefined) {
      await progressRepository.recalcEnrollmentPercents(organizationId, lesson.courseId);
    }
    return toLessonDto(row!);
  }

  async remove(organizationId: string, id: string, actor: AuthPrincipal) {
    const lesson = await lessonRepository.getById(organizationId, id);
    if (!lesson) throw AppError.from('NOT_FOUND');
    await courseService.assertCanWrite(organizationId, lesson.courseId, actor);
    await prisma.$transaction(async (tx) => {
      await lessonRepository.withTx(tx).delete(organizationId, id);
      const remaining = await lessonRepository.withTx(tx).listByCourse(organizationId, lesson.courseId);
      await lessonRepository.withTx(tx).rewriteOrder(
        organizationId,
        lesson.courseId,
        remaining.map((l) => l.id),
      );
      await progressRepository.withTx(tx).recalcEnrollmentPercents(organizationId, lesson.courseId);
    });
    return { id };
  }

  async reorder(organizationId: string, courseId: string, actor: AuthPrincipal, lessonIds: string[]) {
    await courseService.assertCanWrite(organizationId, courseId, actor);
    const existing = await lessonRepository.listByCourse(organizationId, courseId);
    const existingIds = existing.map((l) => l.id).sort();
    const incoming = [...lessonIds].sort();
    if (existingIds.length !== incoming.length || existingIds.some((id, i) => id !== incoming[i])) {
      throw AppError.from('VALIDATION_ERROR', 'lessonIds must be a permutation of all lessons.');
    }
    await prisma.$transaction(async (tx) => {
      await lessonRepository.withTx(tx).rewriteOrder(organizationId, courseId, lessonIds);
      await progressRepository.withTx(tx).recalcEnrollmentPercents(organizationId, courseId);
    });
    const lessons = await lessonRepository.listByCourse(organizationId, courseId);
    return lessons.map(toLessonDto);
  }

  async uploadAsset(
    organizationId: string,
    id: string,
    actor: AuthPrincipal,
    kindRaw: string,
    filename: string,
    buffer: Buffer,
  ) {
    const lesson = await lessonRepository.getById(organizationId, id);
    if (!lesson) throw AppError.from('NOT_FOUND');
    await courseService.assertCanWrite(organizationId, lesson.courseId, actor);
    if (!isLessonAssetKind(kindRaw)) {
      throw AppError.from('VALIDATION_ERROR', 'Upload a video or document.');
    }
    const kind: LessonAssetKind = kindRaw;
    const assetPath = await saveLessonAsset(
      organizationId,
      lesson.courseId,
      lesson.id,
      kind,
      filename,
      buffer,
    );
    const inferredKind: LessonKind | undefined =
      kind === 'video'
        ? lesson.kind === 'READING' || lesson.kind === 'VIDEO'
          ? 'VIDEO'
          : undefined
        : lesson.kind === 'READING' || lesson.kind === 'DOCUMENT'
          ? 'DOCUMENT'
          : undefined;
    const row = await lessonRepository.update(organizationId, id, {
      ...(kind === 'video' ? { videoUrl: assetPath } : { resourceUrl: assetPath }),
      ...(inferredKind ? { kind: inferredKind } : {}),
    });
    return {
      path: assetPath,
      url: publicAssetUrl(assetPath),
      lesson: toLessonDto(row!),
    };
  }

  private async resolveModuleId(
    organizationId: string,
    courseId: string,
    moduleId?: string | null,
  ): Promise<string | null> {
    if (!moduleId) return null;
    const module = await courseModuleRepository.getById(organizationId, moduleId);
    if (!module || module.courseId !== courseId) throw AppError.from('NOT_FOUND', 'Module not found.');
    return module.id;
  }

  private async reindex(organizationId: string, courseId: string) {
    const lessons = await lessonRepository.listByCourse(organizationId, courseId);
    await lessonRepository.rewriteOrder(
      organizationId,
      courseId,
      lessons.sort((a, b) => a.orderIndex - b.orderIndex).map((l) => l.id),
    );
  }
}

export const lessonService = new LessonService();
