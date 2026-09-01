import { Prisma } from '@prisma/client';
import { DEFAULT_ORG_SETTINGS } from '../config/constants';
import { AppError } from '../errors/AppError';
import { hashPassword } from '../lib/password';
import { randomToken } from '../lib/crypto';
import { paginated, parsePagination } from '../lib/pagination';
import { toOrganizationDto } from '../lib/mappers';
import { auditLogRepository } from '../repositories/audit-log.repository';
import { organizationRepository } from '../repositories/organization.repository';
import { roleRepository } from '../repositories/role.repository';
import { userRepository } from '../repositories/user.repository';
import { prisma } from '../lib/prisma';
import { authService } from './auth.service';
import { mailService } from './mail.service';
import { env } from '../config/env';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

export class PlatformService {
  async listOrganizations(query: Record<string, unknown>) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const { items, total } = await organizationRepository.listAll({
      skip,
      take,
      q: typeof query.q === 'string' ? query.q : undefined,
      status: typeof query.status === 'string' ? query.status : undefined,
    });
    const mapped = items.map((o) => ({
      ...toOrganizationDto(o),
      userCount: o._count.users,
      courseCount: o._count.courses,
    }));
    const pageResult = paginated(mapped, total, page, pageSize);
    return {
      ...pageResult,
      rows: mapped,
      pagination: { page, pageSize, total, totalPages: pageResult.totalPages },
    };
  }

  async patchOrganization(
    id: string,
    data: { name?: string; status?: string; settings?: Record<string, unknown> },
    actorId: string,
  ) {
    return this.updateOrganization(id, data, actorId);
  }

  async getOrganization(id: string) {
    const org = await organizationRepository.findById(id);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
    const [userCount, courseCount] = await Promise.all([
      prisma.user.count({ where: { organizationId: id, deletedAt: null } }),
      prisma.course.count({ where: { organizationId: id, deletedAt: null } }),
    ]);
    return { ...toOrganizationDto(org), userCount, courseCount };
  }

  async createOrganization(input: {
    name: string;
    slug: string;
    adminEmail: string;
    adminFirstName: string;
    adminLastName: string;
  }) {
    const slug = input.slug.toLowerCase();
    if (!SLUG_RE.test(slug)) {
      throw AppError.from('VALIDATION_ERROR', 'Invalid organization slug.');
    }
    if (await organizationRepository.findBySlug(slug)) {
      throw AppError.from('ORGANIZATION_SLUG_TAKEN');
    }
    const email = input.adminEmail.trim().toLowerCase();
    const passwordHash = await hashPassword(randomToken(24));

    const created = await prisma.$transaction(async (tx) => {
      const org = await organizationRepository.withTx(tx).create({
        name: input.name.trim(),
        slug,
        settings: DEFAULT_ORG_SETTINGS as unknown as Prisma.InputJsonValue,
      });
      const roles = await roleRepository.withTx(tx).ensureOrgRoles(org.id);
      const division = await tx.division.create({
        data: { organizationId: org.id, name: 'Headquarters' },
      });
      const department = await tx.department.create({
        data: { organizationId: org.id, divisionId: division.id, name: 'Administration' },
      });
      const team = await tx.team.create({
        data: { organizationId: org.id, departmentId: department.id, name: 'Leadership' },
      });
      const admin = await userRepository.withTx(tx).create({
        organization: { connect: { id: org.id } },
        role: { connect: { id: roles.ORG_ADMIN } },
        team: { connect: { id: team.id } },
        department: { connect: { id: department.id } },
        division: { connect: { id: division.id } },
        email,
        passwordHash,
        firstName: input.adminFirstName.trim(),
        lastName: input.adminLastName.trim(),
        status: 'INVITED',
      });
      return { org, admin };
    });

    const token = await authService.createInviteToken(created.org.id, created.admin.id);
    const url = `${env.PUBLIC_WEB_URL}/accept-invite?token=${encodeURIComponent(token)}`;
    await mailService.sendInvite(email, created.org.name, url, {
      orgSlug: created.org.slug,
      email,
    });
    return {
      organization: toOrganizationDto(created.org),
      invite: { email, sent: true, expiresInDays: 7, acceptUrl: url },
    };
  }

  async updateOrganization(
    id: string,
    data: { name?: string; status?: string; settings?: Record<string, unknown> },
    actorId: string,
  ) {
    const org = await organizationRepository.findById(id);
    if (!org) throw AppError.from('ORGANIZATION_NOT_FOUND');
    const updated = await organizationRepository.update(id, {
      ...(data.name ? { name: data.name } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.settings ? { settings: data.settings as Prisma.InputJsonValue } : {}),
    });
    if (data.status === 'SUSPENDED') {
      await auditLogRepository.create({
        organizationId: id,
        actorType: 'platform',
        actorId,
        action: 'ORG_SUSPEND',
        resourceType: 'organization',
        resourceId: id,
      });
    }
    return toOrganizationDto(updated!);
  }

  async deleteOrganization(id: string) {
    return organizationRepository.softDelete(id);
  }

  async listAuditLogs(query: Record<string, unknown>) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const { items, total } = await auditLogRepository.list({
      skip,
      take,
      organizationId: typeof query.organizationId === 'string' ? query.organizationId : undefined,
      actorId: typeof query.actorId === 'string' ? query.actorId : undefined,
      action: typeof query.action === 'string' ? query.action : undefined,
      from: typeof query.from === 'string' ? new Date(query.from) : undefined,
      to: typeof query.to === 'string' ? new Date(query.to) : undefined,
    });
    return paginated(
      items.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    );
  }
}

export const platformService = new PlatformService();
