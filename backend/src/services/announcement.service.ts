import { AppError } from '../errors/app-error';
import { parsePagination, paginationMeta, toSkipTake } from '../lib/pagination';
import { toAnnouncementDto } from '../lib/mappers';
import { announcementRepository } from '../repositories/announcement.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { courseRepository } from '../repositories/course.repository';
import { prisma } from '../repositories/prisma';
import { notificationService } from './notification.service';
import type { AuthPrincipal } from '../types/auth';
import { clock } from '../lib/clock';

class AnnouncementService {
  private canWrite(actor: AuthPrincipal, courseId?: string | null) {
    if (courseId) return actor.permissions.includes('course:write');
    return actor.permissions.includes('org:write');
  }

  async list(
    organizationId: string,
    actor: AuthPrincipal,
    query: { page?: number; pageSize?: number; courseId?: string },
  ) {
    if (!this.canWrite(actor, query.courseId ?? null) && !actor.permissions.includes('course:read')) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    const pg = parsePagination(query.page, query.pageSize);
    const skipTake = toSkipTake(pg);
    const [items, total] = await Promise.all([
      announcementRepository.list(organizationId, { ...skipTake, courseId: query.courseId }),
      announcementRepository.count(organizationId, query.courseId),
    ]);
    return {
      items: items.map(toAnnouncementDto),
      pagination: paginationMeta(pg.page, pg.pageSize, total),
    };
  }

  async listActive(organizationId: string, actor: AuthPrincipal) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    const enrollments = await enrollmentRepository.list(organizationId, {
      userId: actor.sub,
      skip: 0,
      take: 500,
    });
    const enrolledCourseIds = enrollments.items
      .filter((row) => row.status !== 'REVOKED')
      .map((row) => row.courseId);
    const now = clock.now();
    const items = await announcementRepository.listActive(organizationId, enrolledCourseIds, now);
    return items
      .filter((row) => !row.courseId || row.publishedAt)
      .map(toAnnouncementDto);
  }

  async create(
    organizationId: string,
    actor: AuthPrincipal,
    body: {
      title: string;
      body: string;
      courseId?: string | null;
      publishedAt?: string | null;
      expiresAt?: string | null;
    },
  ) {
    if (!this.canWrite(actor, body.courseId)) throw AppError.from('RBAC_FORBIDDEN');
    if (body.courseId) {
      const course = await courseRepository.getById(organizationId, body.courseId);
      if (!course) throw AppError.from('NOT_FOUND');
    }
    const publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;
    const row = await announcementRepository.create({
      organizationId,
      courseId: body.courseId ?? null,
      title: body.title,
      body: body.body,
      publishedAt,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      createdByUserId: actor.actorType === 'user' ? actor.sub : null,
    });
    if (publishedAt && publishedAt <= clock.now()) {
      await this.notifyAudience(organizationId, row.id, row.title, row.body, row.courseId, publishedAt);
    }
    const created = await announcementRepository.findById(organizationId, row.id);
    return toAnnouncementDto(created!);
  }

  async update(
    organizationId: string,
    actor: AuthPrincipal,
    id: string,
    body: {
      title?: string;
      body?: string;
      publishedAt?: string | null;
      expiresAt?: string | null;
    },
  ) {
    const existing = await announcementRepository.findById(organizationId, id);
    if (!existing) throw AppError.from('NOT_FOUND');
    if (!this.canWrite(actor, existing.courseId)) throw AppError.from('RBAC_FORBIDDEN');

    const wasPublished = existing.publishedAt && existing.publishedAt <= clock.now();
    const publishedAt =
      body.publishedAt !== undefined
        ? body.publishedAt
          ? new Date(body.publishedAt)
          : null
        : existing.publishedAt;

    await announcementRepository.update(organizationId, id, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.body !== undefined ? { body: body.body } : {}),
      ...(body.publishedAt !== undefined ? { publishedAt } : {}),
      ...(body.expiresAt !== undefined
        ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
        : {}),
    });

    const nowPublished = publishedAt && publishedAt <= clock.now();
    if (nowPublished && !wasPublished) {
      await this.notifyAudience(
        organizationId,
        id,
        body.title ?? existing.title,
        body.body ?? existing.body,
        existing.courseId,
        publishedAt,
      );
    }

    const updated = await announcementRepository.findById(organizationId, id);
    return toAnnouncementDto(updated!);
  }

  async remove(organizationId: string, actor: AuthPrincipal, id: string) {
    const existing = await announcementRepository.findById(organizationId, id);
    if (!existing) throw AppError.from('NOT_FOUND');
    if (!this.canWrite(actor, existing.courseId)) throw AppError.from('RBAC_FORBIDDEN');
    await announcementRepository.delete(organizationId, id);
    return { deleted: true };
  }

  private async notifyAudience(
    organizationId: string,
    announcementId: string,
    title: string,
    body: string,
    courseId: string | null,
    _publishedAt: Date,
  ) {
    let userIds: string[] = [];
    if (courseId) {
      const enrollments = await enrollmentRepository.list(organizationId, {
        courseId,
        skip: 0,
        take: 5000,
      });
      userIds = [...new Set(enrollments.items.filter((e) => e.status !== 'REVOKED').map((e) => e.userId))];
    } else {
      const users = await prisma.user.findMany({
        where: { organizationId, status: { in: ['ACTIVE', 'INVITED'] }, deletedAt: null },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }

    const href = courseId
      ? notificationService.courseHref(courseId)
      : `${notificationService.catalogHref()}`;

    await Promise.all(
      userIds.map((userId) =>
        notificationService.create({
          organizationId,
          userId,
          kind: 'ANNOUNCEMENT',
          title,
          body: body.slice(0, 200),
          href,
          courseId,
        }),
      ),
    );
  }
}

export const announcementService = new AnnouncementService();
