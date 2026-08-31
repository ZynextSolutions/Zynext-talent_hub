import { AppError } from '../errors/app-error';
import type { DataScope } from '../types/auth';
import type { UserWithRole } from '../repositories/user.repository';

export function assertUserInScope(
  user: Pick<UserWithRole, 'id' | 'departmentId'>,
  scope?: DataScope,
): void {
  if (scope?.kind === 'department' && user.departmentId !== scope.departmentId) {
    throw AppError.from('RBAC_SCOPE_VIOLATION');
  }
}
