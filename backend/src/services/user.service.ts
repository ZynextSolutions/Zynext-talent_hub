import { randomBytes } from 'node:crypto';
import { AppError } from '../errors/app-error';
import { parsePagination, paginationMeta, parseSort, toSkipTake } from '../lib/pagination';
import { toUserDto } from '../lib/mappers';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { teamRepository } from '../repositories/team.repository';
import { passwordService } from './password.service';
import { assignableRoles, canAdministerUser } from '../lib/rbac';
import { rbacService } from './rbac.service';
import { authService } from './auth.service';
import { loginLockoutRepository } from '../repositories/login-lockout.repository';
import { mailService } from './mail.service';
import { tokenService } from './token.service';
import { orgMoveService } from './org-move.service';
import { organizationRepository } from '../repositories/organization.repository';
import { auditService } from './audit.service';
import { assertUserInScope } from '../lib/user-scope';
import type { AuthPrincipal, DataScope } from '../types/auth';
import type { RoleName } from '../domain/roles';
import type { UserStatus } from '@prisma/client';

class UserService {
  async list(
    organizationId: string,
    query: {
      page?: number;
      pageSize?: number;
      q?: string;
      role?: RoleName;
      status?: UserStatus;
      divisionId?: string;
      departmentId?: string;
      teamId?: string;
      sort?: string;
    },
    scope?: DataScope,
  ) {
    const pg = parsePagination(query.page, query.pageSize);
    const sort = parseSort(query.sort, ['lastName', 'email', 'createdAt'], {
      field: 'lastName',
      direction: 'asc',
    });
    const { items, total } = await userRepository.list(organizationId, {
      ...toSkipTake(pg),
      q: query.q,
      roleName: query.role,
      status: query.status,
      divisionId: query.divisionId,
      departmentId: query.departmentId,
      teamId: query.teamId,
      sort,
      scope,
    });
    return { items: items.map(toUserDto), pagination: paginationMeta(pg.page, pg.pageSize, total) };
  }

  async get(organizationId: string, id: string, actor: AuthPrincipal, scope?: DataScope) {
    const row = await userRepository.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    if (scope?.kind === 'self' && row.id !== actor.sub) throw AppError.from('NOT_FOUND');
    if (scope?.kind === 'department' && row.departmentId !== scope.departmentId) {
      throw AppError.from('NOT_FOUND');
    }
    return toUserDto(row);
  }

  async invite(
    organizationId: string,
    body: { email: string; firstName: string; lastName: string; role: RoleName; teamId: string },
    actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    if (!assignableRoles(actor.role).includes(body.role)) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    const team = await teamRepository.getById(organizationId, body.teamId);
    if (!team) throw AppError.from('NOT_FOUND');
    if (scope?.kind === 'department' && team.departmentId !== scope.departmentId) {
      throw AppError.from('RBAC_SCOPE_VIOLATION');
    }
    const existing = await userRepository.findByEmail(organizationId, body.email);
    if (existing) throw AppError.from('AUTH_EMAIL_TAKEN');
    if (body.role === 'MANAGER' && !team.departmentId) {
      throw AppError.from('RBAC_SCOPE_MISSING');
    }
    const roleId = await rbacService.getSystemRoleId(body.role);
    const dummy = await passwordService.hash(randomBytes(32).toString('hex'));
    const user = await userRepository.create({
      email: body.email.trim().toLowerCase(),
      firstName: body.firstName,
      lastName: body.lastName,
      passwordHash: dummy,
      status: 'INVITED',
      organization: { connect: { id: organizationId } },
      role: { connect: { id: roleId } },
      team: { connect: { id: team.id } },
      department: { connect: { id: team.departmentId } },
      ...(team.department.divisionId
        ? { division: { connect: { id: team.department.divisionId } } }
        : {}),
    });
    const token = await authService.createInviteToken(organizationId, user.id);
    const org = await organizationRepository.findById(organizationId);
    const url = `${env.PUBLIC_WEB_URL}/accept-invite?token=${encodeURIComponent(token)}`;
    await mailService.sendInvite(user.email, org?.name ?? 'your organization', url, {
      orgSlug: org?.slug,
      email: user.email,
    });
    return toUserDto(user);
  }

  async update(
    organizationId: string,
    id: string,
    body: { firstName?: string; lastName?: string; role?: RoleName; teamId?: string; status?: UserStatus },
    actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    const user = await userRepository.getById(organizationId, id);
    if (!user) throw AppError.from('NOT_FOUND');
    if (scope?.kind === 'department' && user.departmentId !== scope.departmentId) {
      throw AppError.from('RBAC_SCOPE_VIOLATION');
    }
    if (!canAdministerUser(actor.role, user.role.name)) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    if (body.role && body.role !== user.role.name) {
      if (!assignableRoles(actor.role).includes(body.role)) {
        throw AppError.from('RBAC_FORBIDDEN');
      }
      if (user.role.name === 'ORG_ADMIN' && body.role !== 'ORG_ADMIN') {
        const count = await userRepository.countOrgAdmins(organizationId);
        if (count <= 1) throw AppError.from('LAST_ORG_ADMIN');
      }
      const roleId = await rbacService.getSystemRoleId(body.role);
      await userRepository.update(organizationId, id, { roleId });
      await auditService.record(
        {
          organizationId,
          actorType: actor.actorType,
          actorId: actor.sub,
          action: 'USER_ROLE_CHANGE',
          resourceType: 'User',
          resourceId: id,
          metadata: { from: user.role.name, to: body.role },
        },
        { required: true },
      );
    }
    if (body.teamId && body.teamId !== user.teamId) {
      await orgMoveService.moveNode({
        organizationId,
        nodeType: 'USER',
        nodeId: id,
        targetParentType: 'TEAM',
        targetParentId: body.teamId,
        actorId: actor.sub,
      });
    }
    const updated = await userRepository.update(organizationId, id, {
      ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
      ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    });
    if (!updated) throw AppError.from('NOT_FOUND');
    return toUserDto(updated);
  }

  async remove(organizationId: string, id: string, actor: AuthPrincipal, scope?: DataScope) {
    if (actor.sub === id) throw AppError.from('RBAC_FORBIDDEN', 'Cannot delete yourself.');
    const user = await userRepository.getById(organizationId, id);
    if (!user) throw AppError.from('NOT_FOUND');
    assertUserInScope(user, scope);
    if (!canAdministerUser(actor.role, user.role.name)) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    if (user.role.name === 'ORG_ADMIN') {
      const count = await userRepository.countOrgAdmins(organizationId);
      if (count <= 1) throw AppError.from('LAST_ORG_ADMIN');
    }
    await userRepository.softDelete(organizationId, id);
    await tokenService.revokeAllForPrincipal('user', id);
    return { id };
  }

  async resendInvite(organizationId: string, id: string, actor: AuthPrincipal, scope?: DataScope) {
    const user = await userRepository.getById(organizationId, id);
    if (!user) throw AppError.from('NOT_FOUND');
    assertUserInScope(user, scope);
    if (user.status !== 'INVITED') throw AppError.from('VALIDATION_ERROR', 'User is not invited.');
    const token = await authService.createInviteToken(organizationId, user.id);
    const org = await organizationRepository.findById(organizationId);
    const url = `${env.PUBLIC_WEB_URL}/accept-invite?token=${encodeURIComponent(token)}`;
    await mailService.sendInvite(user.email, org?.name ?? 'your organization', url, {
      orgSlug: org?.slug,
      email: user.email,
    });
    return { sent: true };
  }

  async setStatus(
    organizationId: string,
    id: string,
    status: 'SUSPENDED' | 'ACTIVE',
    actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    if (actor.sub === id) throw AppError.from('RBAC_FORBIDDEN');
    const user = await userRepository.getById(organizationId, id);
    if (!user) throw AppError.from('NOT_FOUND');
    assertUserInScope(user, scope);
    if (!canAdministerUser(actor.role, user.role.name)) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    const updated = await userRepository.update(organizationId, id, { status });
    if (!updated) throw AppError.from('NOT_FOUND');
    if (status === 'SUSPENDED') await tokenService.revokeAllForPrincipal('user', id);
    return toUserDto(updated);
  }

  async unlock(organizationId: string, id: string, scope?: DataScope) {
    const user = await userRepository.getById(organizationId, id);
    if (!user) throw AppError.from('NOT_FOUND');
    assertUserInScope(user, scope);
    await loginLockoutRepository.clear(organizationId, user.email);
    return { unlocked: true };
  }

  async bulkSetStatus(
    organizationId: string,
    userIds: string[],
    status: UserStatus,
    actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    if (!['SUSPENDED', 'ACTIVE'].includes(status)) {
      throw AppError.from('VALIDATION_ERROR', 'Bulk status only supports ACTIVE or SUSPENDED.');
    }
    let updated = 0;
    for (const id of userIds) {
      if (actor.sub === id) continue;
      const user = await userRepository.getById(organizationId, id);
      if (!user) continue;
      try {
        assertUserInScope(user, scope);
      } catch {
        continue;
      }
      if (!canAdministerUser(actor.role, user.role.name)) continue;
      const row = await userRepository.update(organizationId, id, { status });
      if (row) {
        updated += 1;
        if (status === 'SUSPENDED') await tokenService.revokeAllForPrincipal('user', id);
      }
    }
    await auditService.record({
      organizationId,
      actorType: actor.actorType,
      actorId: actor.sub,
      action: 'USER_BULK_STATUS',
      resourceType: 'User',
      metadata: { status, count: updated },
    });
    return { updated };
  }

  async exportCsv(organizationId: string, scope?: DataScope): Promise<string> {
    const { items } = await userRepository.list(organizationId, {
      skip: 0,
      take: 10_000,
      sort: { field: 'lastName', direction: 'asc' },
      scope,
    });
    const header = 'email,firstName,lastName,role,status,teamId,departmentId';
    const lines = items.map((u) =>
      [
        csvEscape(u.email),
        csvEscape(u.firstName),
        csvEscape(u.lastName),
        csvEscape(u.role.name),
        csvEscape(u.status),
        csvEscape(u.teamId ?? ''),
        csvEscape(u.departmentId ?? ''),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  async importCsv(
    organizationId: string,
    csvText: string,
    actor: AuthPrincipal,
    scope?: DataScope,
  ) {
    const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw AppError.from('VALIDATION_ERROR', 'CSV must include a header and at least one row.');
    const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
    const emailIdx = header.indexOf('email');
    const firstIdx = header.indexOf('firstname');
    const lastIdx = header.indexOf('lastname');
    const roleIdx = header.indexOf('role');
    const teamIdx = header.indexOf('teamid');
    if (emailIdx < 0 || firstIdx < 0 || lastIdx < 0 || roleIdx < 0 || teamIdx < 0) {
      throw AppError.from('VALIDATION_ERROR', 'CSV must include email, firstName, lastName, role, teamId columns.');
    }
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseCsvLine(lines[i]!);
      const rowNum = i + 1;
      try {
        const email = cols[emailIdx]?.trim().toLowerCase();
        const firstName = cols[firstIdx]?.trim();
        const lastName = cols[lastIdx]?.trim();
        const role = cols[roleIdx]?.trim() as RoleName;
        const teamId = cols[teamIdx]?.trim();
        if (!email || !firstName || !lastName || !role || !teamId) {
          throw new Error('Missing required fields.');
        }
        if (!assignableRoles(actor.role).includes(role)) {
          throw new Error(`Cannot assign role ${role}.`);
        }
        const team = await teamRepository.getById(organizationId, teamId);
        if (!team) throw new Error('Team not found.');
        if (scope?.kind === 'department' && team.departmentId !== scope.departmentId) {
          throw new Error('Team is outside your scope.');
        }
        const existing = await userRepository.findByEmail(organizationId, email);
        if (existing) {
          assertUserInScope(existing, scope);
          if (!canAdministerUser(actor.role, existing.role.name)) {
            throw new Error('Not allowed to update this user.');
          }
          await userRepository.update(organizationId, existing.id, { firstName, lastName });
          if (existing.teamId !== teamId) {
            await orgMoveService.moveNode({
              organizationId,
              nodeType: 'USER',
              nodeId: existing.id,
              targetParentType: 'TEAM',
              targetParentId: teamId,
              actorId: actor.sub,
            });
          }
          if (existing.role.name !== role) {
            const roleId = await rbacService.getSystemRoleId(role);
            await userRepository.update(organizationId, existing.id, { roleId });
          }
          updated += 1;
        } else {
          await this.invite(
            organizationId,
            { email, firstName, lastName, role, teamId },
            actor,
            scope,
          );
          created += 1;
        }
      } catch (err) {
        skipped += 1;
        errors.push({ row: rowNum, message: err instanceof Error ? err.message : 'Import failed.' });
      }
    }
    await auditService.record({
      organizationId,
      actorType: actor.actorType,
      actorId: actor.sub,
      action: 'USER_IMPORT',
      resourceType: 'User',
      metadata: { created, updated, skipped },
    });
    return { created, updated, skipped, errors: errors.length ? errors : undefined };
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export const userService = new UserService();
