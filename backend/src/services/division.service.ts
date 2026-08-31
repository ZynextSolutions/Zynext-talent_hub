import { AppError } from '../errors/app-error';
import { parsePagination, paginationMeta, toSkipTake } from '../lib/pagination';
import { parseSettings, toDivisionDto } from '../lib/mappers';
import { divisionRepository } from '../repositories/division.repository';
import { departmentRepository } from '../repositories/department.repository';
import { organizationRepository } from '../repositories/organization.repository';

class DivisionService {
  async list(organizationId: string, query: { page?: number; pageSize?: number; q?: string }) {
    const pg = parsePagination(query.page, query.pageSize);
    const { items, total } = await divisionRepository.list(organizationId, {
      ...toSkipTake(pg),
      q: query.q,
    });
    return { items: items.map(toDivisionDto), pagination: paginationMeta(pg.page, pg.pageSize, total) };
  }

  async get(organizationId: string, id: string) {
    const row = await divisionRepository.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    return toDivisionDto(row);
  }

  async create(organizationId: string, body: { name: string; code?: string | null; sortOrder?: number }) {
    const row = await divisionRepository.create(organizationId, body);
    return toDivisionDto(row);
  }

  async update(
    organizationId: string,
    id: string,
    body: { name?: string; code?: string | null; sortOrder?: number },
  ) {
    const row = await divisionRepository.update(organizationId, id, body);
    if (!row) throw AppError.from('NOT_FOUND');
    return toDivisionDto(row);
  }

  async remove(
    organizationId: string,
    id: string,
    query: { reassignTo?: string; detachDepartments?: boolean },
  ) {
    const children = await divisionRepository.countDepartments(organizationId, id);
    if (children > 0) {
      if (query.reassignTo) {
        const target = await divisionRepository.getById(organizationId, query.reassignTo);
        if (!target) throw AppError.from('NOT_FOUND');
        await prismaUpdateDepartments(organizationId, id, query.reassignTo);
      } else if (query.detachDepartments) {
        const org = await organizationRepository.findById(organizationId);
        if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
        if (!parseSettings(org.settings).allowDivisionlessDepts) {
          throw AppError.from('ORG_MOVE_DIVISION_REQUIRED');
        }
        await departmentRepository.detachFromDivision(organizationId, id);
      } else {
        throw AppError.from('DIVISION_HAS_CHILDREN');
      }
    }
    await divisionRepository.softDelete(organizationId, id);
    return { id };
  }
}

async function prismaUpdateDepartments(organizationId: string, from: string, to: string) {
  const { prisma } = await import('../repositories/prisma');
  await prisma.department.updateMany({
    where: { organizationId, divisionId: from, deletedAt: null },
    data: { divisionId: to },
  });
}

export const divisionService = new DivisionService();
