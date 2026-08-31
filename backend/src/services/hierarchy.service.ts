import { userRepository } from '../repositories/user.repository';
import { departmentRepository } from '../repositories/department.repository';
import { teamRepository } from '../repositories/team.repository';
import { divisionRepository } from '../repositories/division.repository';
import type { AssignmentTargetType } from '../domain/assignment-targets';
import type { DataScope } from '../types/auth';
import { AppError } from '../errors/app-error';

class HierarchyService {
  async usersUnder(
    organizationId: string,
    targetType: AssignmentTargetType,
    targetId: string,
  ) {
    const filter =
      targetType === 'ORGANIZATION'
        ? {}
        : targetType === 'DIVISION'
          ? { divisionId: targetId }
          : targetType === 'DEPARTMENT'
            ? { departmentId: targetId }
            : targetType === 'TEAM'
              ? { teamId: targetId }
              : { id: targetId };
    return userRepository.listIdsUnder(organizationId, filter);
  }

  assertTargetInScope(
    scope: DataScope | undefined,
    targetType: AssignmentTargetType,
    targetMeta: { departmentId?: string | null; teamId?: string | null; userDepartmentId?: string | null },
  ): void {
    if (!scope || scope.kind === 'org') return;
    if (scope.kind === 'self') throw AppError.from('RBAC_SCOPE_VIOLATION');
    if (scope.kind === 'department') {
      if (targetType === 'ORGANIZATION' || targetType === 'DIVISION') {
        throw AppError.from('RBAC_SCOPE_VIOLATION');
      }
      if (targetType === 'DEPARTMENT' && targetMeta.departmentId !== scope.departmentId) {
        throw AppError.from('RBAC_SCOPE_VIOLATION');
      }
      if (targetType === 'TEAM' && targetMeta.departmentId !== scope.departmentId) {
        throw AppError.from('RBAC_SCOPE_VIOLATION');
      }
      if (targetType === 'USER' && targetMeta.userDepartmentId !== scope.departmentId) {
        throw AppError.from('RBAC_SCOPE_VIOLATION');
      }
    }
  }

  async loadTargetMeta(
    organizationId: string,
    targetType: AssignmentTargetType,
    targetId: string,
  ) {
    if (targetType === 'ORGANIZATION') {
      if (targetId !== organizationId) throw AppError.from('NOT_FOUND');
      return { departmentId: null as string | null, teamId: null as string | null };
    }
    if (targetType === 'DIVISION') {
      const row = await divisionRepository.getById(organizationId, targetId);
      if (!row) throw AppError.from('NOT_FOUND');
      return { departmentId: null, teamId: null };
    }
    if (targetType === 'DEPARTMENT') {
      const row = await departmentRepository.getById(organizationId, targetId);
      if (!row) throw AppError.from('NOT_FOUND');
      return { departmentId: row.id, teamId: null };
    }
    if (targetType === 'TEAM') {
      const row = await teamRepository.getById(organizationId, targetId);
      if (!row) throw AppError.from('NOT_FOUND');
      return { departmentId: row.departmentId, teamId: row.id };
    }
    const user = await userRepository.getById(organizationId, targetId);
    if (!user) throw AppError.from('NOT_FOUND');
    return { departmentId: user.departmentId, teamId: user.teamId, userDepartmentId: user.departmentId };
  }
}

export const hierarchyService = new HierarchyService();
