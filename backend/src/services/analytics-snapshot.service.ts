import { analyticsRepository } from '../repositories/analytics.repository';
import { analyticsSnapshotRepository } from '../repositories/analytics-snapshot.repository';
import { prisma } from '../lib/prisma';
import { clock } from '../lib/clock';

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

class AnalyticsSnapshotService {
  async captureDay(organizationId: string, date = clock.now()) {
    const day = startOfUtcDay(date);
    const from = day;
    const to = new Date(day.getTime() + 24 * 60 * 60 * 1000 - 1);
    const dashboard = await analyticsRepository.dashboard(organizationId, from, to, { kind: 'org' });
    const metrics = {
      completionRate: dashboard.kpis.lifetime.completionRate,
      complianceRate: dashboard.kpis.lifetime.complianceRate,
      enrolledUserCount: dashboard.kpis.lifetime.enrolledUserCount,
      periodActiveUsers: dashboard.kpis.period.activeUserCount,
      periodLearningHours: dashboard.kpis.period.estimatedLearningHours,
      certificatesIssued: dashboard.kpis.period.certificatesIssued,
      overdueCount: dashboard.kpis.lifetime.overdueCount,
    };
    return analyticsSnapshotRepository.upsert(organizationId, day, metrics);
  }

  async run(organizationId?: string) {
    const yesterday = new Date(clock.now().getTime() - 24 * 60 * 60 * 1000);
    if (organizationId) {
      await this.captureDay(organizationId, yesterday);
      return { organizations: 1, captured: 1 };
    }
    const orgs = await prisma.organization.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    for (const org of orgs) {
      await this.captureDay(org.id, yesterday);
    }
    return { organizations: orgs.length, captured: orgs.length };
  }
}

export const analyticsSnapshotService = new AnalyticsSnapshotService();
