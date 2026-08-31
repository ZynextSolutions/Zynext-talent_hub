import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { assertSingle, orgWhere } from './base.repository';

export class DepartmentRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new DepartmentRepository(tx);
  }

  findById(organizationId: string, id: string) {
    return this.db.department.findFirst({ where: { id, ...orgWhere(organizationId) } });
  }

  getById(organizationId: string, id: string) {
    return this.findById(organizationId, id);
  }

  list(organizationId: string, params: { skip: number; take: number; q?: string; divisionId?: string }) {
    const where: Prisma.DepartmentWhereInput = {
      ...orgWhere(organizationId),
      ...(params.q ? { name: { contains: params.q, mode: 'insensitive' } } : {}),
      ...(params.divisionId ? { divisionId: params.divisionId } : {}),
    };
    return Promise.all([
      this.db.department.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'asc' },
      }),
      this.db.department.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  listAll(organizationId: string) {
    return this.db.department.findMany({
      where: orgWhere(organizationId),
      orderBy: { createdAt: 'asc' },
    });
  }

  create(
    organizationId: string,
    data: { name: string; divisionId?: string | null; code?: string | null; sortOrder?: number },
  ) {
    return this.db.department.create({
      data: {
        organizationId,
        name: data.name,
        divisionId: data.divisionId ?? null,
        code: data.code ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async update(organizationId: string, id: string, data: Prisma.DepartmentUncheckedUpdateManyInput) {
    const res = await this.db.department.updateMany({
      where: { id, ...orgWhere(organizationId) },
      data,
    });
    assertSingle(res.count);
    return this.findById(organizationId, id);
  }

  async softDelete(organizationId: string, id: string) {
    const res = await this.db.department.updateMany({
      where: { id, ...orgWhere(organizationId) },
      data: { deletedAt: new Date() },
    });
    assertSingle(res.count);
    return { id };
  }

  countTeams(organizationId: string, departmentId: string) {
    return this.db.team.count({
      where: { organizationId, departmentId, deletedAt: null },
    });
  }

  async requireById(organizationId: string, id: string) {
    const row = await this.findById(organizationId, id);
    if (!row) throw AppError.from('ORG_MOVE_TARGET_NOT_FOUND', 'Department not found.');
    return row;
  }

  lockForUpdate(organizationId: string, id: string) {
    return this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM departments
      WHERE id = ${id} AND organization_id = ${organizationId} AND deleted_at IS NULL
      FOR UPDATE
    `;
  }

  setDivision(organizationId: string, id: string, divisionId: string | null) {
    return this.update(organizationId, id, { divisionId });
  }

  detachFromDivision(organizationId: string, divisionId: string) {
    return this.db.department.updateMany({
      where: { organizationId, divisionId, deletedAt: null },
      data: { divisionId: null },
    });
  }
}

export const departmentRepository = new DepartmentRepository();
