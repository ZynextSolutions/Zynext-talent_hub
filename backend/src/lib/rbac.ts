import type { Permission, RoleName } from '../domain/roles';
import { PERMISSIONS } from '../domain/roles';

const ALL_ORG: Permission[] = PERMISSIONS.filter((p) => !p.startsWith('platform:'));

const ORG_ADMIN: Permission[] = [
  'org:read',
  'org:write',
  'org:tree:read',
  'org:tree:write',
  'org:move',
  'division:read',
  'division:write',
  'department:read',
  'department:write',
  'team:read',
  'team:write',
  'user:read',
  'user:write',
  'user:invite',
  'course:read',
  'course:write',
  'course:publish',
  'course:assign',
  'enrollment:read',
  'enrollment:write',
  'assessment:write',
  'assessment:grade',
  'question-bank:write',
  'learning-path:write',
  'certificate:read',
  'certificate:revoke',
  'analytics:read',
  'compliance:read',
  'reports:read',
  'reports:export',
  'reports:schedule',
  'skills:read',
  'skills:write',
  'audit:read',
  'compliance:export',
  'xapi:read',
  'api-key:write',
  'webhook:write',
];

const MANAGER: Permission[] = [
  'org:read',
  'org:tree:read',
  'division:read',
  'department:read',
  'team:read',
  'user:read',
  'user:write',
  'user:invite',
  'course:read',
  'course:assign',
  'enrollment:read',
  'enrollment:write',
  'progress:write',
  'assessment:submit',
  'certificate:read',
  'analytics:read',
  'compliance:read',
  'reports:read',
  'reports:export',
  'reports:export',
  'reports:schedule',
  'skills:read',
  'audit:read',
  'compliance:export',
  'xapi:read',
];

const INSTRUCTOR: Permission[] = [
  'org:read',
  'org:tree:read',
  'course:read',
  'course:write',
  'course:publish',
  'course:assign',
  'enrollment:read',
  'progress:write',
  'assessment:write',
  'assessment:submit',
  'assessment:grade',
  'question-bank:write',
  'certificate:read',
  'analytics:read',
  'skills:read',
  'xapi:read',
  'reports:read',
];

const EMPLOYEE: Permission[] = [
  'org:read',
  'user:read',
  'course:read',
  'enrollment:read',
  'progress:write',
  'assessment:submit',
  'certificate:read',
  'reports:read:own',
];

const SUPER_ADMIN: Permission[] = ['platform:org:read', 'platform:org:write', ...ALL_ORG];

export const ROLE_PERMISSIONS: Record<RoleName | 'SUPER_ADMIN', readonly Permission[]> = {
  SUPER_ADMIN,
  ORG_ADMIN,
  MANAGER,
  INSTRUCTOR,
  EMPLOYEE,
};

export const SYSTEM_ROLE_NAMES: RoleName[] = ['ORG_ADMIN', 'MANAGER', 'INSTRUCTOR', 'EMPLOYEE'];

export function permissionsFor(role: RoleName | 'SUPER_ADMIN' | string): Permission[] {
  const mapped = ROLE_PERMISSIONS[role as RoleName | 'SUPER_ADMIN'];
  return mapped ? [...mapped] : [];
}

export function getPermissions(role: RoleName | 'SUPER_ADMIN' | string): Permission[] {
  return permissionsFor(role);
}

export function hasPermission(
  granted: readonly string[],
  required: Permission | Permission[],
): boolean {
  const need = Array.isArray(required) ? required : [required];
  return need.some((p) => granted.includes(p));
}

export function roleHasPermission(roleName: string, permission: string): boolean {
  return permissionsFor(roleName).includes(permission as Permission);
}

/** Roles the actor may assign when inviting or editing a user. */
export function assignableRoles(actorRole: RoleName | 'SUPER_ADMIN' | string): RoleName[] {
  if (actorRole === 'ORG_ADMIN' || actorRole === 'SUPER_ADMIN') {
    return ['EMPLOYEE', 'MANAGER', 'INSTRUCTOR', 'ORG_ADMIN'];
  }
  if (actorRole === 'MANAGER') return ['EMPLOYEE'];
  return [];
}

/** Managers may only administer employees in their department. */
export function canAdministerUser(
  actorRole: RoleName | 'SUPER_ADMIN' | string,
  targetRole: string,
): boolean {
  if (actorRole === 'ORG_ADMIN' || actorRole === 'SUPER_ADMIN') return true;
  if (actorRole === 'MANAGER') return targetRole === 'EMPLOYEE';
  return false;
}
