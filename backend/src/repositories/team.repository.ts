import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from './prisma';
import { assertSingle, orgWhere } from './base.repository';
import { AppError } from '../errors/AppError';

export class TeamRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient): TeamRepository {
    return new TeamRepository(tx);
  }

  findById(organizationId: string, id: string) {
    return this.db.team.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { department: true },
    });
  }

  getById(organizationId: string, id: string) {
    return this.findById(organizationId, id);
  }

  list(organizationId: string, opts: { skip: number; take: number; q?: string; departmentId?: string }) {
    const where: Prisma.TeamWhereInput = {
      ...orgWhere(organizationId),
      ...(opts.q ? { name: { contains: opts.q, mode: 'insensitive' } } : {}),
      ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
    };
    return Promise.all([
      this.db.team.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.db.team.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  listAll(organizationId: string) {
    return this.db.team.findMany({
      where: orgWhere(organizationId),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  create(
    organizationId: string,
    data: { name: string; departmentId: string; code?: string | null; sortOrder?: number },
  ) {
    return this.db.team.create({
      data: {
        organizationId,
        name: data.name,
        departmentId: data.departmentId,
        code: data.code ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async update(organizationId: string, id: string, data: Prisma.TeamUncheckedUpdateManyInput) {
    const res = await this.db.team.updateMany({
      where: { id, ...orgWhere(organizationId) },
      data,
    });
    assertSingle(res.count);
    return this.getById(organizationId, id);
  }

  async setDepartment(organizationId: string, id: string, departmentId: string) {
    const res = await this.db.team.updateMany({
      where: { id, ...orgWhere(organizationId) },
      data: { departmentId },
    });
    assertSingle(res.count, 'ORG_MOVE_NODE_NOT_FOUND');
  }

  async softDelete(organizationId: string, id: string) {
    const res = await this.db.team.updateMany({
      where: { id, ...orgWhere(organizationId) },
      data: { deletedAt: new Date() },
    });
    assertSingle(res.count);
  }

  countUsers(organizationId: string, teamId: string) {
    return this.db.user.count({
      where: { organizationId, teamId, deletedAt: null },
    });
  }

  lockForUpdate(organizationId: string, id: string) {
    return this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM teams
      WHERE id = ${id} AND organization_id = ${organizationId} AND deleted_at IS NULL
      FOR UPDATE
    `;
  }

  async requireById(organizationId: string, id: string) {
    const row = await this.findById(organizationId, id);
    if (!row) throw AppError.from('ORG_MOVE_TARGET_NOT_FOUND', 'Team not found.');
    return row;
  }
}

export const teamRepository = new TeamRepository();
