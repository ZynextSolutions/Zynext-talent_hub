import type { Prisma, UserStatus } from '@prisma/client';
import { prisma, type DbClient } from './prisma';
import { applyUserScope, assertSingle, orgWhere } from './base.repository';
import { AppError } from '../errors/AppError';
import type { DataScope } from '../types/auth';
import type { RoleName } from '../domain/roles';

const userInclude = { role: true } as const;

export type UserWithRole = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export class UserRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient): UserRepository {
    return new UserRepository(tx);
  }

  getById(organizationId: string, id: string) {
    return this.db.user.findFirst({
      where: { id, ...orgWhere(organizationId) },
      include: userInclude,
    });
  }

  getByIdAnyStatus(organizationId: string, id: string) {
    return this.db.user.findFirst({
      where: { id, organizationId },
      include: userInclude,
    });
  }

  findByEmail(organizationId: string, email: string) {
    return this.db.user.findFirst({
      where: { organizationId, email: email.toLowerCase(), deletedAt: null },
      include: userInclude,
    });
  }

  findByIdAndOrg(id: string, organizationId: string) {
    return this.db.user.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { role: true, organization: true },
    });
  }

  list(
    organizationId: string,
    opts: {
      skip: number;
      take: number;
      q?: string;
      roleName?: RoleName;
      status?: UserStatus;
      divisionId?: string;
      departmentId?: string;
      teamId?: string;
      sort: { field: string; direction: 'asc' | 'desc' };
      scope?: DataScope;
    },
  ) {
    const where: Prisma.UserWhereInput = applyUserScope(
      {
        ...orgWhere(organizationId),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.divisionId ? { divisionId: opts.divisionId } : {}),
        ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
        ...(opts.teamId ? { teamId: opts.teamId } : {}),
        ...(opts.roleName ? { role: { name: opts.roleName } } : {}),
        ...(opts.q
          ? {
              OR: [
                { firstName: { contains: opts.q, mode: 'insensitive' } },
                { lastName: { contains: opts.q, mode: 'insensitive' } },
                { email: { contains: opts.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      opts.scope,
    );

    const orderBy: Prisma.UserOrderByWithRelationInput =
      opts.sort.field === 'email'
        ? { email: opts.sort.direction }
        : opts.sort.field === 'createdAt'
          ? { createdAt: opts.sort.direction }
          : { lastName: opts.sort.direction };

    return Promise.all([
      this.db.user.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        orderBy,
        include: userInclude,
      }),
      this.db.user.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  listAll(organizationId: string, scope?: DataScope) {
    return this.db.user.findMany({
      where: applyUserScope(orgWhere(organizationId), scope),
      include: userInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  listIdsUnder(
    organizationId: string,
    filter: Prisma.UserWhereInput,
  ) {
    return this.db.user.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'INVITED'] },
        ...filter,
      },
      select: { id: true, status: true, divisionId: true, departmentId: true, teamId: true },
    });
  }

  create(data: Prisma.UserCreateInput) {
    return this.db.user.create({ data, include: userInclude });
  }

  async update(organizationId: string, id: string, data: Prisma.UserUncheckedUpdateManyInput) {
    const res = await this.db.user.updateMany({
      where: { id, ...orgWhere(organizationId) },
      data,
    });
    assertSingle(res.count);
    return this.getById(organizationId, id);
  }

  async updateHierarchy(
    organizationId: string,
    filter: Prisma.UserWhereInput,
    data: Prisma.UserUncheckedUpdateManyInput,
  ) {
    return this.db.user.updateMany({
      where: { organizationId, deletedAt: null, ...filter },
      data,
    });
  }

  async softDelete(organizationId: string, id: string) {
    const res = await this.db.user.updateMany({
      where: { id, ...orgWhere(organizationId) },
      data: { deletedAt: new Date(), status: 'DEACTIVATED' },
    });
    assertSingle(res.count);
  }

  countOrgAdmins(organizationId: string) {
    return this.db.user.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'INVITED'] },
        role: { name: 'ORG_ADMIN' },
      },
    });
  }

  lockForUpdate(organizationId: string, id: string) {
    return this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users
      WHERE id = ${id} AND organization_id = ${organizationId} AND deleted_at IS NULL
      FOR UPDATE
    `;
  }

  findByIds(organizationId: string, ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.db.user.findMany({
      where: { organizationId, id: { in: ids }, deletedAt: null },
      include: userInclude,
    });
  }

  findById(organizationId: string, id: string) {
    return this.getById(organizationId, id);
  }

  async requireById(organizationId: string, id: string) {
    const row = await this.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND', 'User not found.');
    return row;
  }

  updatePassword(organizationId: string, id: string, passwordHash: string) {
    return this.update(organizationId, id, { passwordHash });
  }
}

export const userRepository = new UserRepository();
