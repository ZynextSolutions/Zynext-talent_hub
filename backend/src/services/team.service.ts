import { AppError } from '../errors/app-error';
import { parsePagination, paginationMeta, toSkipTake } from '../lib/pagination';
import { toTeamDto } from '../lib/mappers';
import { teamRepository } from '../repositories/team.repository';
import { departmentRepository } from '../repositories/department.repository';

class TeamService {
  async list(
    organizationId: string,
    query: { page?: number; pageSize?: number; q?: string; departmentId?: string },
  ) {
    const pg = parsePagination(query.page, query.pageSize);
    const { items, total } = await teamRepository.list(organizationId, {
      ...toSkipTake(pg),
      q: query.q,
      departmentId: query.departmentId,
    });
    return { items: items.map(toTeamDto), pagination: paginationMeta(pg.page, pg.pageSize, total) };
  }

  async get(organizationId: string, id: string) {
    const row = await teamRepository.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    return toTeamDto(row);
  }

  async create(
    organizationId: string,
    body: { name: string; departmentId: string; code?: string | null; sortOrder?: number },
  ) {
    const dept = await departmentRepository.getById(organizationId, body.departmentId);
    if (!dept) throw AppError.from('NOT_FOUND');
    const row = await teamRepository.create(organizationId, body);
    return toTeamDto(row);
  }

  async update(
    organizationId: string,
    id: string,
    body: { name?: string; code?: string | null; sortOrder?: number; departmentId?: string },
  ) {
    if (body.departmentId) {
      const dept = await departmentRepository.getById(organizationId, body.departmentId);
      if (!dept) throw AppError.from('NOT_FOUND');
    }
    const row = await teamRepository.update(organizationId, id, body);
    if (!row) throw AppError.from('NOT_FOUND');
    return toTeamDto(row);
  }

  async remove(organizationId: string, id: string) {
    const users = await teamRepository.countUsers(organizationId, id);
    if (users > 0) throw AppError.from('TEAM_HAS_USERS');
    await teamRepository.softDelete(organizationId, id);
    return { id };
  }
}

export const teamService = new TeamService();
