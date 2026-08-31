import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { assertSingle, orgWhere } from './base.repository';

export class DivisionRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new DivisionRepository(tx);
  }

  findById(organizationId: string, id: string) {
    return this.db.division.findFirst({ where: { id, ...orgWhere(organizationId) } });
  }

  getById(organizationId: string, id: string) {
    return this.findById(organizationId, id);
  }

  list(organizationId: string, params: { skip: number; take: number; q?: string }) {
    const where: Prisma.DivisionWhereInput = {
      ...orgWhere(organizationId),
      ...(params.q ? { name: { contains: params.q, mode: 'insensitive' } } : {}),
    };
    return Promise.all([
      this.db.division.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'asc' },
      }),
      this.db.division.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  listAll(organizationId: string) {
    return this.db.division.findMany({
      where: orgWhere(organizationId),
      orderBy: { createdAt: 'asc' },
    });
  }

  create(organizationId: string, data: { name: string; code?: string | null; sortOrder?: number }) {
    return this.db.division.create({
      data: {
        organizationId,
        name: data.name,
        code: data.code ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async update(organizationId: string, id: string, data: Prisma.DivisionUncheckedUpdateManyInput) {
    const res = await this.db.division.updateMany({
      where: { id, ...orgWhere(organizationId) },
      data,
    });
    assertSingle(res.count);
    return this.findById(organizationId, id);
  }

  async softDelete(organizationId: string, id: string) {
    const res = await this.db.division.updateMany({
      where: { id, ...orgWhere(organizationId) },
      data: { deletedAt: new Date() },
    });
    assertSingle(res.count);
    return { id };
  }

  async countDepartments(organizationId: string, divisionId: string) {
    return this.db.department.count({
      where: { organizationId, divisionId, deletedAt: null },
    });
  }

  async requireById(organizationId: string, id: string) {
    const row = await this.findById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND', 'Division not found.');
    return row;
  }

  lockForUpdate(organizationId: string, id: string) {
    return this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM divisions
      WHERE id = ${id} AND organization_id = ${organizationId} AND deleted_at IS NULL
      FOR UPDATE
    `;
  }
}

export const divisionRepository = new DivisionRepository();
