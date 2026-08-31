export const ROLE_NAMES = ['ORG_ADMIN', 'MANAGER', 'INSTRUCTOR', 'EMPLOYEE'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const PERMISSIONS = [
  'platform:org:read',
  'platform:org:write',
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
  'progress:write',
  'assessment:write',
  'assessment:submit',
  'assessment:grade',
  'question-bank:write',
  'learning-path:write',
  'certificate:read',
  'certificate:revoke',
  'analytics:read',
  'compliance:read',
  'reports:read',
  'reports:read:own',
  'reports:export',
  'reports:schedule',
  'skills:read',
  'skills:write',
  'audit:read',
  'compliance:export',
  'xapi:read',
  'api-key:write',
  'webhook:write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isRoleName(value: string): value is RoleName {
  return (ROLE_NAMES as readonly string[]).includes(value);
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function filterApiKeyScopes(scopes: string[]): Permission[] {
  return scopes.filter((scope): scope is Permission => isPermission(scope) && !scope.startsWith('platform:'));
}
