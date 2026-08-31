import type { ForumScope, Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class ForumRepository {
  constructor(private db: DbClient = prisma) {}

  createThread(data: Prisma.ForumThreadUncheckedCreateInput) {
    return this.db.forumThread.create({
      data,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { posts: true } },
      },
    });
  }

  findThread(organizationId: string, id: string) {
    return this.db.forumThread.findFirst({
      where: { id, organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { posts: true } },
      },
    });
  }

  listThreads(
    organizationId: string,
    params: { scope: ForumScope; courseId?: string; skip: number; take: number },
  ) {
    return this.db.forumThread.findMany({
      where: {
        organizationId,
        scope: params.scope,
        ...(params.scope === 'COURSE' && params.courseId ? { courseId: params.courseId } : {}),
        ...(params.scope === 'ORGANIZATION' ? { courseId: null } : {}),
      },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      skip: params.skip,
      take: params.take,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { posts: true } },
      },
    });
  }

  countThreads(organizationId: string, scope: ForumScope, courseId?: string) {
    return this.db.forumThread.count({
      where: {
        organizationId,
        scope,
        ...(scope === 'COURSE' && courseId ? { courseId } : {}),
        ...(scope === 'ORGANIZATION' ? { courseId: null } : {}),
      },
    });
  }

  updateThread(organizationId: string, id: string, data: Prisma.ForumThreadUncheckedUpdateInput) {
    return this.db.forumThread.updateMany({ where: { id, organizationId }, data });
  }

  deleteThread(organizationId: string, id: string) {
    return this.db.forumThread.deleteMany({ where: { id, organizationId } });
  }

  createPost(data: Prisma.ForumPostUncheckedCreateInput) {
    return this.db.forumPost.create({
      data,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  listPosts(organizationId: string, threadId: string) {
    return this.db.forumPost.findMany({
      where: { organizationId, threadId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  touchThread(threadId: string) {
    return this.db.forumThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });
  }
}

export const forumRepository = new ForumRepository();
