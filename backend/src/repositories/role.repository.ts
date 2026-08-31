import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';
import { getPermissions } from '../lib/rbac';

const ROLE_NAMES = ['ORG_ADMIN', 'MANAGER', 'INSTRUCTOR', 'EMPLOYEE'] as const;

export class RoleRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new RoleRepository(tx);
  }

  findByName(organizationId: string, name: string) {
    return this.db.role.findFirst({ where: { organizationId, name } });
  }

  async ensureOrgRoles(organizationId: string) {
    const roles: Record<string, string> = {};
    for (const name of ROLE_NAMES) {
      const role = await this.db.role.upsert({
        where: { name_organizationId: { name, organizationId } },
        create: { name, organizationId, isSystem: true },
        update: {},
      });
      roles[name] = role.id;

      const perms = getPermissions(name);
      for (const key of perms) {
        const [resource, ...actionParts] = key.split(':');
        const action = actionParts.join(':');
        if (!resource || !action) continue;
        const permission = await this.db.permission.upsert({
          where: { resource_action: { resource, action } },
          create: { resource, action },
          update: {},
        });
        await this.db.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          create: { roleId: role.id, permissionId: permission.id },
          update: {},
        });
      }
    }
    return roles;
  }

  async ensureSystemRoles(names: readonly string[]) {
    for (const name of names) {
      const existing = await this.db.role.findFirst({ where: { name, isSystem: true } });
      if (!existing) {
        await this.db.role.create({ data: { name, isSystem: true } });
      }
    }
  }

  listByOrganization(organizationId: string) {
    return this.db.role.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { roleSkills: true, users: true } } },
    });
  }

  findById(organizationId: string, id: string) {
    return this.db.role.findFirst({ where: { id, organizationId } });
  }

  findSystemByName(name: string) {
    return this.db.role.findFirst({ where: { name, isSystem: true } });
  }
}

export const roleRepository = new RoleRepository();
