import type { NotificationKind, Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class NotificationRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new NotificationRepository(tx);
  }

  create(data: {
    organizationId: string;
    userId: string;
    kind: NotificationKind;
    title: string;
    body: string;
    href?: string | null;
    enrollmentId?: string | null;
    courseId?: string | null;
  }) {
    return this.db.notification.create({ data });
  }

  listForUser(
    organizationId: string,
    userId: string,
    params: { skip: number; take: number; unreadOnly?: boolean },
  ) {
    return this.db.notification.findMany({
      where: {
        organizationId,
        userId,
        ...(params.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
  }

  countForUser(organizationId: string, userId: string, unreadOnly?: boolean) {
    return this.db.notification.count({
      where: {
        organizationId,
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
    });
  }

  findById(organizationId: string, userId: string, id: string) {
    return this.db.notification.findFirst({
      where: { id, organizationId, userId },
    });
  }

  markRead(organizationId: string, userId: string, id: string, readAt: Date) {
    return this.db.notification.updateMany({
      where: { id, organizationId, userId, readAt: null },
      data: { readAt },
    });
  }

  markAllRead(organizationId: string, userId: string, readAt: Date) {
    return this.db.notification.updateMany({
      where: { organizationId, userId, readAt: null },
      data: { readAt },
    });
  }
}

export const notificationRepository = new NotificationRepository();
