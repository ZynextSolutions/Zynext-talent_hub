import { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class LoginEventRepository {
  constructor(private db: DbClient = prisma) {}

  record(input: {
    organizationId: string;
    userId: string;
    method: string;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    return this.db.loginEvent.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        method: input.method,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  countByUsersInRange(
    organizationId: string,
    userIds: string[],
    from: Date,
    to: Date,
  ): Promise<Array<{ userId: string; count: number }>> {
    if (!userIds.length) return Promise.resolve([]);
    return this.db.loginEvent
      .groupBy({
        by: ['userId'],
        where: {
          organizationId,
          userId: { in: userIds },
          createdAt: { gte: from, lte: to },
        },
        _count: { _all: true },
      })
      .then((rows) => rows.map((r) => ({ userId: r.userId, count: r._count._all })));
  }

  latestByUsers(organizationId: string, userIds: string[]) {
    if (!userIds.length) return Promise.resolve(new Map<string, Date>());
    return this.db.loginEvent
      .findMany({
        where: { organizationId, userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['userId'],
        select: { userId: true, createdAt: true },
      })
      .then((rows) => new Map(rows.map((r) => [r.userId, r.createdAt])));
  }

  countDistinctUsers(where: { organizationId: string; userId?: { in: string[] }; createdAt?: { gte: Date; lte: Date } }) {
    return this.db.loginEvent
      .groupBy({
        by: ['userId'],
        where,
      })
      .then((rows) => rows.length);
  }

  countLogins(where: { organizationId: string; userId?: { in: string[] }; createdAt?: { gte: Date; lte: Date } }) {
    return this.db.loginEvent.count({ where });
  }

  dailyTrend(organizationId: string, userIds: string[], from: Date, to: Date) {
    if (!userIds.length) return Promise.resolve([] as Array<{ day: Date; logins: number; users: number }>);
    return this.db.$queryRaw<Array<{ day: Date; logins: bigint; users: bigint }>>`
      SELECT DATE(created_at) AS day,
             COUNT(*)::bigint AS logins,
             COUNT(DISTINCT user_id)::bigint AS users
      FROM login_events
      WHERE organization_id = ${organizationId}
        AND user_id IN (${Prisma.join(userIds)})
        AND created_at >= ${from}
        AND created_at <= ${to}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `.then((rows) =>
      rows.map((r) => ({
        day: r.day,
        logins: Number(r.logins),
        users: Number(r.users),
      })),
    );
  }
}

export const loginEventRepository = new LoginEventRepository();
