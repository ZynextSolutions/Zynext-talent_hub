import type { ForumScope } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { parsePagination, paginationMeta, toSkipTake } from '../lib/pagination';
import { toForumPostDto, toForumThreadDto } from '../lib/mappers';
import { forumRepository } from '../repositories/forum.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { courseRepository } from '../repositories/course.repository';
import type { AuthPrincipal } from '../types/auth';

class ForumService {
  private async assertCourseAccess(organizationId: string, courseId: string, actor: AuthPrincipal) {
    const enrollment = await enrollmentRepository.findByUserCourse(organizationId, actor.sub, courseId);
    if (!enrollment || enrollment.status === 'REVOKED') {
      throw AppError.from('RBAC_FORBIDDEN', 'Enroll in this course to participate in the forum.');
    }
  }

  async listThreads(
    organizationId: string,
    actor: AuthPrincipal,
    params: { scope: ForumScope; courseId?: string; page?: number; pageSize?: number },
  ) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    if (params.scope === 'COURSE') {
      if (!params.courseId) throw AppError.from('VALIDATION_ERROR', 'courseId is required');
      await this.assertCourseAccess(organizationId, params.courseId, actor);
    }
    const pg = parsePagination(params.page, params.pageSize);
    const skipTake = toSkipTake(pg);
    const [items, total] = await Promise.all([
      forumRepository.listThreads(organizationId, { scope: params.scope, courseId: params.courseId, ...skipTake }),
      forumRepository.countThreads(organizationId, params.scope, params.courseId),
    ]);
    return {
      items: items.map(toForumThreadDto),
      pagination: paginationMeta(pg.page, pg.pageSize, total),
    };
  }

  async createThread(
    organizationId: string,
    actor: AuthPrincipal,
    params: {
      scope: ForumScope;
      courseId?: string;
      lessonId?: string;
      title: string;
      body: string;
    },
  ) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    if (params.scope === 'COURSE' && !actor.permissions.includes('progress:write')) {
      throw AppError.from('RBAC_FORBIDDEN');
    }

    if (params.scope === 'COURSE') {
      if (!params.courseId) throw AppError.from('VALIDATION_ERROR', 'courseId is required');
      await this.assertCourseAccess(organizationId, params.courseId, actor);
      const course = await courseRepository.getById(organizationId, params.courseId);
      if (!course) throw AppError.from('NOT_FOUND');
    }

    const row = await forumRepository.createThread({
      organizationId,
      scope: params.scope,
      courseId: params.scope === 'COURSE' ? params.courseId! : null,
      lessonId: params.lessonId ?? null,
      userId: actor.sub,
      title: params.title,
      body: params.body,
    });
    return toForumThreadDto(row);
  }

  async getThread(organizationId: string, actor: AuthPrincipal, threadId: string) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    const thread = await forumRepository.findThread(organizationId, threadId);
    if (!thread) throw AppError.from('NOT_FOUND');
    if (thread.scope === 'COURSE' && thread.courseId) {
      await this.assertCourseAccess(organizationId, thread.courseId, actor);
    }
    const posts = await forumRepository.listPosts(organizationId, threadId);
    return {
      thread: toForumThreadDto(thread),
      posts: posts.map(toForumPostDto),
    };
  }

  async createPost(organizationId: string, actor: AuthPrincipal, threadId: string, body: string) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');

    const thread = await forumRepository.findThread(organizationId, threadId);
    if (!thread) throw AppError.from('NOT_FOUND');
    if (thread.locked) throw AppError.from('VALIDATION_ERROR', 'Thread is locked.');
    if (thread.scope === 'COURSE' && thread.courseId) {
      if (!actor.permissions.includes('progress:write')) throw AppError.from('RBAC_FORBIDDEN');
      await this.assertCourseAccess(organizationId, thread.courseId, actor);
    } else if (!actor.permissions.includes('course:read')) {
      throw AppError.from('RBAC_FORBIDDEN');
    }

    const row = await forumRepository.createPost({
      organizationId,
      threadId,
      userId: actor.sub,
      body,
    });
    await forumRepository.touchThread(threadId);
    return toForumPostDto(row);
  }

  async pinThread(organizationId: string, actor: AuthPrincipal, threadId: string, pinned: boolean) {
    const thread = await forumRepository.findThread(organizationId, threadId);
    if (!thread) throw AppError.from('NOT_FOUND');
    if (thread.scope === 'ORGANIZATION') {
      if (!actor.permissions.includes('org:write')) throw AppError.from('RBAC_FORBIDDEN');
    } else if (!actor.permissions.includes('course:write')) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    await forumRepository.updateThread(organizationId, threadId, { pinned });
    return { pinned };
  }

  async removeThread(organizationId: string, actor: AuthPrincipal, threadId: string) {
    const thread = await forumRepository.findThread(organizationId, threadId);
    if (!thread) throw AppError.from('NOT_FOUND');
    const isAuthor = actor.actorType === 'user' && thread.userId === actor.sub;
    if (thread.scope === 'ORGANIZATION') {
      if (!actor.permissions.includes('org:write') && !isAuthor) throw AppError.from('RBAC_FORBIDDEN');
    } else if (!actor.permissions.includes('course:write') && !isAuthor) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    await forumRepository.deleteThread(organizationId, threadId);
    return { deleted: true };
  }
}

export const forumService = new ForumService();
