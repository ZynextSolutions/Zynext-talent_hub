import type { NotificationKind } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { parsePagination, paginationMeta, toSkipTake } from '../lib/pagination';
import { toNotificationDto } from '../lib/mappers';
import { notificationRepository } from '../repositories/notification.repository';
import type { AuthPrincipal } from '../types/auth';
import { clock } from '../lib/clock';
import { env } from '../config/env';

class NotificationService {
  create(input: {
    organizationId: string;
    userId: string;
    kind: NotificationKind;
    title: string;
    body: string;
    href?: string | null;
    enrollmentId?: string | null;
    courseId?: string | null;
  }) {
    return notificationRepository.create(input);
  }

  async list(
    organizationId: string,
    actor: AuthPrincipal,
    query: { page?: number; pageSize?: number; unreadOnly?: boolean },
  ) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    const pg = parsePagination(query.page, query.pageSize);
    const skipTake = toSkipTake(pg);
    const [items, total] = await Promise.all([
      notificationRepository.listForUser(organizationId, actor.sub, {
        ...skipTake,
        unreadOnly: query.unreadOnly,
      }),
      notificationRepository.countForUser(organizationId, actor.sub, query.unreadOnly),
    ]);
    return {
      items: items.map(toNotificationDto),
      pagination: paginationMeta(pg.page, pg.pageSize, total),
    };
  }

  async unreadCount(organizationId: string, actor: AuthPrincipal) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    const count = await notificationRepository.countForUser(organizationId, actor.sub, true);
    return { count };
  }

  async markRead(organizationId: string, actor: AuthPrincipal, id: string) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    const row = await notificationRepository.findById(organizationId, actor.sub, id);
    if (!row) throw AppError.from('NOT_FOUND');
    await notificationRepository.markRead(organizationId, actor.sub, id, clock.now());
    return { read: true };
  }

  async markAllRead(organizationId: string, actor: AuthPrincipal) {
    if (actor.actorType !== 'user') throw AppError.from('RBAC_FORBIDDEN');
    await notificationRepository.markAllRead(organizationId, actor.sub, clock.now());
    return { read: true };
  }

  courseHref(courseId: string) {
    return `${env.publicWebUrl}/learn/${courseId}`;
  }

  catalogHref() {
    return `${env.publicWebUrl}/catalog`;
  }
}

export const notificationService = new NotificationService();
