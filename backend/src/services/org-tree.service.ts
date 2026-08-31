import { AppError } from '../errors/app-error';
import { organizationRepository } from '../repositories/organization.repository';
import { divisionRepository } from '../repositories/division.repository';
import { departmentRepository } from '../repositories/department.repository';
import { teamRepository } from '../repositories/team.repository';
import { userRepository } from '../repositories/user.repository';
import type { DataScope } from '../types/auth';

class OrgTreeService {
  async getTree(organizationId: string, includeUsers: boolean, scope?: DataScope) {
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');

    const [divisions, departments, teams, users] = await Promise.all([
      divisionRepository.listAll(organizationId),
      departmentRepository.listAll(organizationId),
      teamRepository.listAll(organizationId),
      includeUsers ? userRepository.listAll(organizationId, scope?.kind === 'department' ? scope : undefined) : [],
    ]);

    let visibleDepartments = departments;
    let visibleDivisions = divisions;
    if (scope?.kind === 'department' && scope.departmentId) {
      visibleDepartments = departments.filter((d) => d.id === scope.departmentId);
      const divIds = new Set(visibleDepartments.map((d) => d.divisionId).filter(Boolean));
      visibleDivisions = divisions.filter((d) => divIds.has(d.id));
    }

    const teamsByDept = new Map<string, typeof teams>();
    for (const team of teams) {
      if (scope?.kind === 'department' && team.departmentId !== scope.departmentId) continue;
      const list = teamsByDept.get(team.departmentId) ?? [];
      list.push(team);
      teamsByDept.set(team.departmentId, list);
    }
    const usersByTeam = new Map<string, typeof users>();
    for (const user of users) {
      if (!user.teamId) continue;
      const list = usersByTeam.get(user.teamId) ?? [];
      list.push(user);
      usersByTeam.set(user.teamId, list);
    }

    const mapDept = (dept: (typeof departments)[number]) => ({
      id: dept.id,
      name: dept.name,
      divisionId: dept.divisionId,
      sortOrder: dept.sortOrder,
      teams: (teamsByDept.get(dept.id) ?? []).map((team) => ({
        id: team.id,
        name: team.name,
        departmentId: team.departmentId,
        sortOrder: team.sortOrder,
        users: includeUsers
          ? (usersByTeam.get(team.id) ?? []).map((u) => ({
              id: u.id,
              firstName: u.firstName,
              lastName: u.lastName,
              role: u.role.name,
              email: u.email,
            }))
          : [],
      })),
    });

    const deptsByDiv = new Map<string, typeof departments>();
    const unassigned = [];
    for (const dept of visibleDepartments) {
      if (!dept.divisionId) {
        unassigned.push(mapDept(dept));
        continue;
      }
      const list = deptsByDiv.get(dept.divisionId) ?? [];
      list.push(dept);
      deptsByDiv.set(dept.divisionId, list);
    }

    return {
      organization: { id: org.id, name: org.name, slug: org.slug },
      divisions: visibleDivisions.map((div) => ({
        id: div.id,
        name: div.name,
        sortOrder: div.sortOrder,
        departments: (deptsByDiv.get(div.id) ?? []).map(mapDept),
      })),
      unassignedDepartments: unassigned,
    };
  }
}

export const orgTreeService = new OrgTreeService();
