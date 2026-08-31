import type { Permission, RoleName } from '../domain/roles';
import { permissionsFor, SYSTEM_ROLE_NAMES } from '../lib/rbac';
import { roleRepository } from '../repositories/role.repository';

class RbacService {
  getPermissions(role: RoleName | 'SUPER_ADMIN'): Permission[] {
    return permissionsFor(role);
  }

  async ensureSystemRoles(): Promise<void> {
    await roleRepository.ensureSystemRoles(SYSTEM_ROLE_NAMES);
  }

  async getSystemRoleId(name: RoleName): Promise<string> {
    const role = await roleRepository.findSystemByName(name);
    if (role) return role.id;
    await this.ensureSystemRoles();
    const created = await roleRepository.findSystemByName(name);
    if (!created) throw new Error(`Failed to ensure system role ${name}`);
    return created.id;
  }
}

export const rbacService = new RbacService();
