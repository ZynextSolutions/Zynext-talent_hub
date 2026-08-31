import { Prisma } from '@prisma/client';
import { encryptSecret } from '../lib/secret-box';
import { AppError } from '../errors/AppError';
import { parseSettings, toOrganizationDto } from '../lib/mappers';
import {
  CERTIFICATE_ASSET_KINDS,
  publicAssetUrl,
  saveCertificateAsset,
  type CertificateAssetKind,
} from '../lib/uploads';
import { parseCertificateTemplate } from '../types/dto';
import { paginated, parsePagination } from '../lib/pagination';
import { departmentRepository } from '../repositories/department.repository';
import { divisionRepository } from '../repositories/division.repository';
import { organizationRepository } from '../repositories/organization.repository';
import { teamRepository } from '../repositories/team.repository';

export class OrganizationService {
  async getCurrent(organizationId: string) {
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
    return toOrganizationDto(org);
  }

  async updateCurrent(
    organizationId: string,
    data: { name?: string; settings?: Record<string, unknown> },
  ) {
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
    const settings = data.settings
      ? (() => {
          const current = parseSettings(org.settings);
          const incoming = data.settings;
          const nextTemplate =
            incoming.certificateTemplate && typeof incoming.certificateTemplate === 'object'
              ? { ...current.certificateTemplate, ...incoming.certificateTemplate }
              : current.certificateTemplate;
          const incomingSso =
            incoming.sso && typeof incoming.sso === 'object'
              ? (incoming.sso as Record<string, unknown>)
              : undefined;
          let sso = current.sso;
          if (incomingSso) {
            const keepSecret = current.sso?.clientSecret;
            let clientSecret = keepSecret;
            if ('clientSecret' in incomingSso) {
              if (incomingSso.clientSecret === '' || incomingSso.clientSecret === null) {
                clientSecret = undefined;
              } else if (typeof incomingSso.clientSecret === 'string') {
                clientSecret = encryptSecret(incomingSso.clientSecret);
              }
            }
            sso = {
              ...current.sso,
              ...incomingSso,
              clientSecret,
            };
          }
          const { sso: _ignored, clientSecretSet: _set, ...incomingRest } = incoming as Record<
            string,
            unknown
          >;
          return {
            ...current,
            ...incomingRest,
            certificateTemplate: parseCertificateTemplate(nextTemplate),
            ...(sso ? { sso } : {}),
          } as unknown as Prisma.InputJsonValue;
        })()
      : undefined;
    const updated = await organizationRepository.update(organizationId, {
      ...(data.name ? { name: data.name } : {}),
      ...(settings ? { settings } : {}),
    });
    return toOrganizationDto(updated!);
  }

  async uploadCertificateAsset(
    organizationId: string,
    kind: string,
    dataUrl: string,
  ) {
    if (!CERTIFICATE_ASSET_KINDS.includes(kind as CertificateAssetKind)) {
      throw AppError.from('VALIDATION_ERROR', 'kind must be logo, signature, or background.');
    }
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
    const relativePath = await saveCertificateAsset(
      organizationId,
      kind as CertificateAssetKind,
      dataUrl,
    );
    return { kind, url: publicAssetUrl(relativePath), path: relativePath };
  }

  async listDivisions(organizationId: string, query: Record<string, unknown>) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const { items, total } = await divisionRepository.list(organizationId, {
      skip,
      take,
      q: typeof query.q === 'string' ? query.q : undefined,
    });
    return paginated(
      items.map((d, i) => ({
        id: d.id,
        organizationId: d.organizationId,
        name: d.name,
        code: null,
        sortOrder: i,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    );
  }

  async getDivision(organizationId: string, id: string) {
    const d = await divisionRepository.requireById(organizationId, id);
    return {
      id: d.id,
      organizationId: d.organizationId,
      name: d.name,
      code: null,
      sortOrder: 0,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async createDivision(organizationId: string, name: string) {
    const d = await divisionRepository.create(organizationId, { name });
    return this.getDivision(organizationId, d.id);
  }

  async updateDivision(organizationId: string, id: string, name: string) {
    await divisionRepository.update(organizationId, id, { name });
    return this.getDivision(organizationId, id);
  }

  async deleteDivision(organizationId: string, id: string, detachDepartments: boolean) {
    const count = await divisionRepository.countDepartments(organizationId, id);
    if (count > 0) {
      if (!detachDepartments) throw AppError.from('DIVISION_HAS_CHILDREN');
      const org = await organizationRepository.findById(organizationId);
      const settings = parseSettings(org?.settings);
      if (!settings.allowDivisionlessDepts) throw AppError.from('ORG_MOVE_DIVISION_REQUIRED');
      const depts = await departmentRepository.listAll(organizationId);
      for (const d of depts.filter((x) => x.divisionId === id)) {
        await departmentRepository.update(organizationId, d.id, { divisionId: null });
      }
    }
    return divisionRepository.softDelete(organizationId, id);
  }

  async listDepartments(organizationId: string, query: Record<string, unknown>) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const { items, total } = await departmentRepository.list(organizationId, {
      skip,
      take,
      q: typeof query.q === 'string' ? query.q : undefined,
      divisionId: typeof query.divisionId === 'string' ? query.divisionId : undefined,
    });
    return paginated(
      items.map((d, i) => ({
        id: d.id,
        organizationId: d.organizationId,
        divisionId: d.divisionId,
        name: d.name,
        code: null,
        sortOrder: i,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    );
  }

  async getDepartment(organizationId: string, id: string) {
    const d = await departmentRepository.requireById(organizationId, id);
    return {
      id: d.id,
      organizationId: d.organizationId,
      divisionId: d.divisionId,
      name: d.name,
      code: null,
      sortOrder: 0,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async createDepartment(organizationId: string, data: { name: string; divisionId?: string | null }) {
    if (data.divisionId) {
      await divisionRepository.requireById(organizationId, data.divisionId);
    } else {
      const org = await organizationRepository.findById(organizationId);
      const settings = parseSettings(org?.settings);
      if (!settings.allowDivisionlessDepts) throw AppError.from('ORG_MOVE_DIVISION_REQUIRED');
    }
    const d = await departmentRepository.create(organizationId, data);
    return this.getDepartment(organizationId, d.id);
  }

  async updateDepartment(
    organizationId: string,
    id: string,
    data: { name?: string; divisionId?: string | null },
  ) {
    if (data.divisionId) await divisionRepository.requireById(organizationId, data.divisionId);
    await departmentRepository.update(organizationId, id, {
      ...(data.name ? { name: data.name } : {}),
      ...(data.divisionId !== undefined ? { divisionId: data.divisionId } : {}),
    });
    return this.getDepartment(organizationId, id);
  }

  async deleteDepartment(organizationId: string, id: string) {
    const count = await departmentRepository.countTeams(organizationId, id);
    if (count > 0) throw AppError.from('DEPARTMENT_HAS_TEAMS');
    return departmentRepository.softDelete(organizationId, id);
  }

  async listTeams(organizationId: string, query: Record<string, unknown>) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const { items, total } = await teamRepository.list(organizationId, {
      skip,
      take,
      q: typeof query.q === 'string' ? query.q : undefined,
      departmentId: typeof query.departmentId === 'string' ? query.departmentId : undefined,
    });
    return paginated(
      items.map((t, i) => ({
        id: t.id,
        organizationId: t.organizationId,
        departmentId: t.departmentId,
        name: t.name,
        code: null,
        sortOrder: i,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    );
  }

  async getTeam(organizationId: string, id: string) {
    const t = await teamRepository.requireById(organizationId, id);
    return {
      id: t.id,
      organizationId: t.organizationId,
      departmentId: t.departmentId,
      name: t.name,
      code: null,
      sortOrder: 0,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async createTeam(organizationId: string, data: { name: string; departmentId: string }) {
    await departmentRepository.requireById(organizationId, data.departmentId);
    const t = await teamRepository.create(organizationId, data);
    return this.getTeam(organizationId, t.id);
  }

  async updateTeam(organizationId: string, id: string, data: { name?: string; departmentId?: string }) {
    if (data.departmentId) await departmentRepository.requireById(organizationId, data.departmentId);
    await teamRepository.update(organizationId, id, {
      ...(data.name ? { name: data.name } : {}),
      ...(data.departmentId ? { departmentId: data.departmentId } : {}),
    });
    return this.getTeam(organizationId, id);
  }

  async deleteTeam(organizationId: string, id: string) {
    const count = await teamRepository.countUsers(organizationId, id);
    if (count > 0) throw AppError.from('TEAM_HAS_USERS');
    return teamRepository.softDelete(organizationId, id);
  }

  async current(_auth: { role?: string }, organizationId: string) {
    return this.getCurrent(organizationId);
  }
}

export const organizationService = new OrganizationService();
