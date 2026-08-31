import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';
import { AppError } from '../errors/AppError';

export class OrganizationRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new OrganizationRepository(tx);
  }

  findById(id: string) {
    return this.db.organization.findFirst({ where: { id, deletedAt: null } });
  }

  getById(id: string) {
    return this.findById(id);
  }

  findBySlug(slug: string) {
    return this.db.organization.findFirst({ where: { slug, deletedAt: null } });
  }

  findByIdIncludingDeleted(id: string) {
    return this.db.organization.findUnique({ where: { id } });
  }

  listAll(params: {
    skip: number;
    take: number;
    q?: string;
    status?: string;
  }) {
    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' } },
              { slug: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.db.organization.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { users: true, courses: true } } },
      }),
      this.db.organization.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  create(data: Prisma.OrganizationCreateInput) {
    return this.db.organization.create({ data });
  }

  async update(id: string, data: Prisma.OrganizationUpdateManyMutationInput) {
    const res = await this.db.organization.updateMany({
      where: { id, deletedAt: null },
      data,
    });
    if (res.count !== 1) throw AppError.from('ORGANIZATION_NOT_FOUND');
    return this.findById(id);
  }

  async softDelete(id: string) {
    const now = new Date();
    const res = await this.db.organization.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: now },
    });
    if (res.count !== 1) throw AppError.from('ORGANIZATION_NOT_FOUND');
    return { id, deletedAt: now };
  }

  touch(id: string) {
    return this.db.organization.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }
}

export const organizationRepository = new OrganizationRepository();
