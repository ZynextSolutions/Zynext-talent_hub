import { prisma } from '../lib/prisma';

export class XapiRepository {
  create(input: {
    organizationId: string;
    userId?: string | null;
    verb: string;
    activityId?: string | null;
    statement: object;
  }) {
    return prisma.xapiStatement.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        verb: input.verb,
        activityId: input.activityId ?? null,
        statement: input.statement,
      },
    });
  }

  list(organizationId: string, params: { skip: number; take: number; verb?: string; from?: Date; to?: Date }) {
    const where = {
      organizationId,
      ...(params.verb ? { verb: params.verb } : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };
    return Promise.all([
      prisma.xapiStatement.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.xapiStatement.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  stats(organizationId: string, from: Date, to: Date) {
    return prisma.xapiStatement.groupBy({
      by: ['verb'],
      where: { organizationId, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      orderBy: { _count: { verb: 'desc' } },
    });
  }
}

export const xapiRepository = new XapiRepository();
