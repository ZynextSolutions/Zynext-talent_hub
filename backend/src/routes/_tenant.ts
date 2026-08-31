import type { RequestHandler } from 'express';
import type { Permission } from '../domain/roles';
import { authenticate } from '../middleware/authenticate';
import { resolveTenant } from '../middleware/resolve-tenant';
import { scopeManager } from '../middleware/scope-manager';
import { requirePermission } from '../middleware/require-permission';

export function tenant(permission: string, ...more: string[]): RequestHandler[] {
  const perms = [permission, ...more] as Permission[];
  return [
    authenticate,
    resolveTenant,
    scopeManager,
    requirePermission(perms.length === 1 ? perms[0]! : perms),
  ];
}
