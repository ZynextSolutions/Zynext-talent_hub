import { prisma } from '../repositories/prisma';
import { reminderDeliveryRepository } from '../repositories/reminder-delivery.repository';
import { notificationService } from './notification.service';
import { mailService } from './mail.service';
import { clock } from '../lib/clock';
import { startOfUtcDay, daysUntilDue } from '../lib/date';

const THRESHOLDS = [
  { days: 90, kind: 'cert_expiring_90', notificationKind: 'CERT_EXPIRING' as const },
  { days: 30, kind: 'cert_expiring_30', notificationKind: 'CERT_EXPIRING' as const },
  { days: 7, kind: 'cert_expiring_7', notificationKind: 'CERT_EXPIRING' as const },
  { days: 0, kind: 'cert_expired', notificationKind: 'CERT_EXPIRED' as const },
];

class CertExpiryService {
  async run(organizationId: string) {
    const now = clock.now();
    const today = startOfUtcDay(now);
    const certs = await prisma.certificate.findMany({
      where: {
        organizationId,
        revokedAt: null,
        expiresAt: { not: null },
      },
      include: {
        user: { select: { id: true, email: true } },
        course: { select: { id: true, title: true } },
        enrollment: { select: { id: true } },
      },
    });

    let sent = 0;
    for (const cert of certs) {
      if (!cert.expiresAt) continue;
      const daysLeft = daysUntilDue(cert.expiresAt, now);
      for (const threshold of THRESHOLDS) {
        if (threshold.days === 0) {
          if (daysLeft >= 0) continue;
        } else if (daysLeft !== threshold.days) {
          continue;
        }

        const claimed = await reminderDeliveryRepository.tryClaim({
          organizationId,
          userId: cert.userId,
          enrollmentId: cert.enrollmentId,
          channel: 'email',
          kind: threshold.kind,
          sentOnDate: today,
        });
        if (!claimed) continue;

        const expiryLabel = cert.expiresAt.toISOString().slice(0, 10);
        const title =
          threshold.days === 0
            ? `Certificate expired: ${cert.course.title}`
            : `Certificate expiring in ${threshold.days} day(s): ${cert.course.title}`;
        const body =
          threshold.days === 0
            ? `Your certificate for ${cert.course.title} expired on ${expiryLabel}. Recertification may be required.`
            : `Your certificate for ${cert.course.title} expires on ${expiryLabel}.`;

        await notificationService.create({
          organizationId,
          userId: cert.userId,
          kind: threshold.notificationKind,
          title,
          body,
          href: notificationService.courseHref(cert.courseId),
          enrollmentId: cert.enrollmentId,
          courseId: cert.courseId,
        });
        await mailService.sendCertExpiry({
          to: cert.user.email,
          courseTitle: cert.course.title,
          expiryLabel,
          daysLeft: threshold.days === 0 ? daysLeft : threshold.days,
        });
        sent += 1;
      }
    }
    return { checked: certs.length, sent };
  }

  async runAllOrganizations() {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    let checked = 0;
    let sent = 0;
    for (const org of orgs) {
      const result = await this.run(org.id);
      checked += result.checked;
      sent += result.sent;
    }
    return { organizations: orgs.length, checked, sent };
  }
}

export const certExpiryService = new CertExpiryService();
