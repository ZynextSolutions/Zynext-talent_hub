import type { AuditActorType, Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class AuditLogRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new AuditLogRepository(tx);
  }

  create(data: {
    organizationId?: string | null;
    actorType: AuditActorType;
    actorId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Prisma.InputJsonValue;
    ip?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
  }) {
    return this.db.auditLog.create({
      data: {
        organizationId: data.organizationId ?? null,
        actorType: data.actorType,
        actorId: data.actorId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        metadata: data.metadata ?? {},
        ip: data.ip ?? undefined,
        userAgent: data.userAgent ?? undefined,
        requestId: data.requestId ?? undefined,
      },
    });
  }

  list(params: {
    skip: number;
    take: number;
    organizationId?: string;
    actorId?: string;
    action?: string;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.action ? { action: params.action } : {}),
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
      this.db.auditLog.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.auditLog.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }
}

export const auditLogRepository = new AuditLogRepository();
