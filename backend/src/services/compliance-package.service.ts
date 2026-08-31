import AdmZip from 'adm-zip';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { auditService } from './audit.service';
import { reportsService } from './reports.service';
import { saveReportExport } from '../lib/report-uploads';
import { publicAssetUrl } from '../lib/uploads';
import type { DataScope } from '../types/auth';

const ORG_SCOPE: DataScope = { kind: 'org' };

class CompliancePackageService {
  async create(organizationId: string, userId: string, filters: Record<string, unknown>) {
    return prisma.compliancePackage.create({
      data: {
        organizationId,
        requestedByUserId: userId,
        filters: filters as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });
  }

  list(organizationId: string) {
    return prisma.compliancePackage.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async build(organizationId: string, packageId: string) {
    const pkg = await prisma.compliancePackage.findFirst({ where: { id: packageId, organizationId } });
    if (!pkg) throw new Error('Package not found');

    try {
      const filters = (pkg.filters ?? {}) as Record<string, string>;
      const query = {
        from: filters.from,
        to: filters.to,
        divisionId: filters.divisionId,
        departmentId: filters.departmentId,
        teamId: filters.teamId,
      };

      const [enrollmentsCsv, overdueCsv, auditRows] = await Promise.all([
        reportsService.exportCsv(organizationId, 'enrollments', ORG_SCOPE, query),
        reportsService.exportCsv(organizationId, 'overdue-training', ORG_SCOPE, query),
        auditService.list({ organizationId, skip: 0, take: 5000 }),
      ]);

      const auditCsv = [
        'time,action,actorType,actorId,resourceType,resourceId',
        ...auditRows.items.map(
          (r) =>
            `${r.createdAt.toISOString()},${r.action},${r.actorType},${r.actorId},${r.resourceType ?? ''},${r.resourceId ?? ''}`,
        ),
      ].join('\n');

      const zip = new AdmZip();
      zip.addFile('enrollments.csv', Buffer.from(enrollmentsCsv, 'utf8'));
      zip.addFile('overdue-training.csv', Buffer.from(overdueCsv, 'utf8'));
      zip.addFile('audit-log.csv', Buffer.from(auditCsv, 'utf8'));
      const manifest = {
        generatedAt: new Date().toISOString(),
        organizationId,
        filters: pkg.filters,
        files: ['enrollments.csv', 'overdue-training.csv', 'audit-log.csv'],
      };
      zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

      const filename = `compliance-${new Date().toISOString().slice(0, 10)}.zip`;
      const filePath = await saveReportExport(organizationId, filename, zip.toBuffer());

      await prisma.compliancePackage.update({
        where: { id: packageId },
        data: {
          status: 'READY',
          filePath,
          manifest,
          completedAt: new Date(),
        },
      });

      return { filePath, downloadUrl: publicAssetUrl(filePath) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.compliancePackage.update({
        where: { id: packageId },
        data: { status: 'FAILED', errorMessage: message.slice(0, 500) },
      });
      throw err;
    }
  }

  async createAndBuild(organizationId: string, userId: string, filters: Record<string, unknown>) {
    const pkg = await this.create(organizationId, userId, filters);
    return this.build(organizationId, pkg.id);
  }
}

export const compliancePackageService = new CompliancePackageService();
