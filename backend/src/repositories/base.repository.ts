import { Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';
import type { ErrorCode } from '../errors/codes';
import type { DataScope } from '../types/tenant';

export function orgWhere(organizationId: string) {
  return { organizationId, deletedAt: null };
}

export function assertSingle(count: number, code: ErrorCode = 'NOT_FOUND'): void {
  if (count !== 1) throw AppError.from(code);
}

export function applyUserScope(where: Prisma.UserWhereInput, scope?: DataScope): Prisma.UserWhereInput {
  if (!scope || scope.kind === 'org') return where;
  if (scope.kind === 'department' && scope.departmentId) {
    return { ...where, departmentId: scope.departmentId };
  }
  if (scope.kind === 'team' && scope.teamId) {
    return { ...where, teamId: scope.teamId };
  }
  if (scope.kind === 'self' && scope.userId) {
    return { ...where, id: scope.userId };
  }
  return where;
}

export function userScopeWhere(organizationId: string, scope?: DataScope): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { organizationId, deletedAt: null };
  if (!scope || scope.kind === 'org') return where;
  if (scope.kind === 'department' && scope.departmentId) {
    where.departmentId = scope.departmentId;
  } else if (scope.kind === 'team' && scope.teamId) {
    where.teamId = scope.teamId;
  } else if (scope.kind === 'self' && scope.userId) {
    where.id = scope.userId;
  }
  return where;
}
