import { AppError } from '../errors/app-error';
import { parsePagination, paginationMeta, toSkipTake } from '../lib/pagination';
import { parseSettings, toDepartmentDto } from '../lib/mappers';
import { departmentRepository } from '../repositories/department.repository';
import { divisionRepository } from '../repositories/division.repository';
import { organizationRepository } from '../repositories/organization.repository';

class DepartmentService {
  async list(
    organizationId: string,
    query: { page?: number; pageSize?: number; q?: string; divisionId?: string },
  ) {
    const pg = parsePagination(query.page, query.pageSize);
    const { items, total } = await departmentRepository.list(organizationId, {
      ...toSkipTake(pg),
      q: query.q,
      divisionId: query.divisionId,
    });
    return { items: items.map(toDepartmentDto), pagination: paginationMeta(pg.page, pg.pageSize, total) };
  }

  async get(organizationId: string, id: string) {
    const row = await departmentRepository.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    return toDepartmentDto(row);
  }

  async create(
    organizationId: string,
    body: { name: string; code?: string | null; divisionId?: string | null; sortOrder?: number },
  ) {
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
    if (body.divisionId) {
      const div = await divisionRepository.getById(organizationId, body.divisionId);
      if (!div) throw AppError.from('NOT_FOUND');
    } else if (!parseSettings(org.settings).allowDivisionlessDepts) {
      throw AppError.from('ORG_MOVE_DIVISION_REQUIRED');
    }
    const row = await departmentRepository.create(organizationId, body);
    return toDepartmentDto(row);
  }

  async update(
    organizationId: string,
    id: string,
    body: { name?: string; code?: string | null; divisionId?: string | null; sortOrder?: number },
  ) {
    if (body.divisionId) {
      const div = await divisionRepository.getById(organizationId, body.divisionId);
      if (!div) throw AppError.from('NOT_FOUND');
    }
    const row = await departmentRepository.update(organizationId, id, body);
    if (!row) throw AppError.from('NOT_FOUND');
    return toDepartmentDto(row);
  }

  async remove(organizationId: string, id: string) {
    const teams = await departmentRepository.countTeams(organizationId, id);
    if (teams > 0) throw AppError.from('DEPARTMENT_HAS_TEAMS');
    await departmentRepository.softDelete(organizationId, id);
    return { id };
  }
}

export const departmentService = new DepartmentService();
