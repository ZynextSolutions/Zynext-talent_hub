import type { ReportFormat } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { clock } from '../lib/clock';
import { startOfUtcDay } from '../lib/date';
import { computeNextRun, initialNextRun } from '../lib/report-schedule';
import { saveReportExport } from '../lib/report-uploads';
import { publicAssetUrl } from '../lib/uploads';
import { reportDeliveryRepository } from '../repositories/report-delivery.repository';
import { scheduledReportRepository } from '../repositories/scheduled-report.repository';
import { integrationsService } from './integrations.service';
import { prisma } from '../repositories/prisma';
import { mailService } from './mail.service';
import { reportsService } from './reports.service';
import type { DataScope } from '../types/auth';
import type { ReportType } from '../validators/reports.schema';

const ORG_SCOPE: DataScope = { kind: 'org' };

type ScheduledFilters = {
  from?: string;
  to?: string;
  divisionId?: string;
  departmentId?: string;
  teamId?: string;
  courseId?: string;
  userId?: string;
  status?: string;
  certStatus?: 'active' | 'revoked' | 'expiring' | 'expired';
  q?: string;
};

function toDto(row: Awaited<ReturnType<typeof scheduledReportRepository.findById>>) {
  if (!row) return null;
  return {
    id: row.id,
    reportType: row.reportType,
    filters: row.filters,
    format: row.format,
    frequency: row.frequency,
    recipients: row.recipients,
    enabled: row.enabled,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    creator: row.creator
      ? {
          id: row.creator.id,
          name: `${row.creator.firstName} ${row.creator.lastName}`.trim(),
          email: row.creator.email,
        }
      : null,
  };
}

class ScheduledReportService {
  async list(organizationId: string) {
    const rows = await scheduledReportRepository.list(organizationId);
    return rows.map((r) => toDto(r)!);
  }

  async create(
    organizationId: string,
    userId: string,
    input: {
      reportType: ReportType;
      filters: ScheduledFilters;
      format: ReportFormat;
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      recipients: string[];
      enabled?: boolean;
    },
  ) {
    const row = await scheduledReportRepository.create({
      organizationId,
      createdByUserId: userId,
      reportType: input.reportType,
      filters: input.filters,
      format: input.format,
      frequency: input.frequency,
      recipients: input.recipients,
      nextRunAt: initialNextRun(),
    });
    if (input.enabled === false) {
      await scheduledReportRepository.update(organizationId, row.id, { enabled: false });
    }
    return toDto(await scheduledReportRepository.findById(organizationId, row.id));
  }

  async update(
    organizationId: string,
    id: string,
    input: Partial<{
      reportType: ReportType;
      filters: ScheduledFilters;
      format: ReportFormat;
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      recipients: string[];
      enabled: boolean;
    }>,
  ) {
    const existing = await scheduledReportRepository.findById(organizationId, id);
    if (!existing) throw AppError.from('NOT_FOUND');
    const data: Record<string, unknown> = { ...input };
    if (input.frequency && input.frequency !== existing.frequency) {
      data.nextRunAt = initialNextRun();
    }
    await scheduledReportRepository.update(organizationId, id, data);
    return toDto(await scheduledReportRepository.findById(organizationId, id));
  }

  async remove(organizationId: string, id: string) {
    const result = await scheduledReportRepository.delete(organizationId, id);
    if (result.count === 0) throw AppError.from('NOT_FOUND');
    return { deleted: true };
  }

  async run(organizationId?: string) {
    const now = clock.now();
    const today = startOfUtcDay(now);
    const due = await scheduledReportRepository.dueSchedules(now, organizationId);
    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const schedule of due) {
      processed += 1;
      const claimed = await reportDeliveryRepository.tryClaim({
        scheduledReportId: schedule.id,
        organizationId: schedule.organizationId,
        sentOnDate: today,
        status: 'PENDING',
      });
      if (!claimed) continue;

      try {
        const filters = (schedule.filters ?? {}) as ScheduledFilters;
        const format =
          schedule.format === 'PDF' ? 'pdf' : schedule.format === 'XLSX' ? 'xlsx' : 'csv';
        const { buffer, ext } = await reportsService.exportBuffer(
          schedule.organizationId,
          schedule.reportType as ReportType,
          ORG_SCOPE,
          filters,
          format,
        );
        const filename = `${schedule.reportType}-${today.toISOString().slice(0, 10)}.${ext}`;
        const filePath = await saveReportExport(schedule.organizationId, filename, buffer);
        const downloadUrl = publicAssetUrl(filePath);

        await mailService.sendScheduledReport({
          recipients: schedule.recipients,
          orgName: schedule.organization.name,
          reportType: schedule.reportType,
          downloadUrl,
          format: schedule.format,
        });

        await reportDeliveryRepository.update(schedule.id, today, {
          status: 'SENT',
          filePath,
        });
        await scheduledReportRepository.markRun(
          schedule.id,
          now,
          computeNextRun(schedule.frequency, now),
        );
        void integrationsService.dispatchWebhook(schedule.organizationId, 'report.delivered', {
          scheduleId: schedule.id,
          reportType: schedule.reportType,
          format: schedule.format,
          downloadUrl,
        });
        sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await reportDeliveryRepository.update(schedule.id, today, {
          status: 'FAILED',
          errorMessage: message.slice(0, 500),
        });
        await scheduledReportRepository.markRun(
          schedule.id,
          now,
          computeNextRun(schedule.frequency, now),
        );
        failed += 1;
      }
    }

    return { processed, sent, failed };
  }

  async runAllOrganizations() {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    let processed = 0;
    let sent = 0;
    let failed = 0;
    for (const org of orgs) {
      const result = await this.run(org.id);
      processed += result.processed;
      sent += result.sent;
      failed += result.failed;
    }
    return { organizations: orgs.length, processed, sent, failed };
  }
}

export const scheduledReportService = new ScheduledReportService();
