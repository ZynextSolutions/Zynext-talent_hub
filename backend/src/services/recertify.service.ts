import { prisma } from '../repositories/prisma';
import { assignmentRepository } from '../repositories/assignment.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { organizationRepository } from '../repositories/organization.repository';
import { certificateRepository } from '../repositories/certificate.repository';
import { assessmentRepository } from '../repositories/assessment.repository';
import { reminderDeliveryRepository } from '../repositories/reminder-delivery.repository';
import { auditService } from './audit.service';
import { mailService } from './mail.service';
import { notificationService } from './notification.service';
import { clock } from '../lib/clock';
import { startOfUtcDay } from '../lib/date';
import { logger } from '../lib/logger';

class RecertifyService {
  async run(organizationId: string) {
    const assignments = await assignmentRepository.listByOrg(organizationId);
    const recertAssignments = assignments.filter((a) => a.recertifyEveryDays && a.recertifyEveryDays > 0);
    let reEnrolled = 0;
    const today = startOfUtcDay(clock.now());

    for (const assignment of recertAssignments) {
      const enrollments = await prisma.enrollment.findMany({
        where: {
          organizationId,
          assignmentId: assignment.id,
          status: 'COMPLETED',
          certificate: { isNot: null },
        },
        include: { certificate: true, user: true, course: true },
      });

      const now = clock.now();
      for (const enrollment of enrollments) {
        const cert = enrollment.certificate;
        if (!cert || cert.revokedAt) continue;

        const ageDays = Math.floor((now.getTime() - cert.issuedAt.getTime()) / (24 * 60 * 60 * 1000));
        if (!assignment.recertifyEveryDays || ageDays < assignment.recertifyEveryDays) continue;

        const active = await enrollmentRepository.findByUserCourse(
          organizationId,
          enrollment.userId,
          enrollment.courseId,
        );
        if (active && active.status !== 'COMPLETED' && active.status !== 'REVOKED') continue;
        if (!active) continue;

        // Daily claim prevents concurrent cron duplicates; next day retries if reset crashed mid-flight.
        const claimed = await reminderDeliveryRepository.tryClaim({
          organizationId,
          userId: enrollment.userId,
          enrollmentId: active.id,
          channel: 'system',
          kind: 'recertify',
          sentOnDate: today,
        });
        if (!claimed) continue;

        try {
          await prisma.$transaction(async (tx) => {
            const certs = certificateRepository.withTx(tx);
            const enrollmentsTx = enrollmentRepository.withTx(tx);
            const assessments = assessmentRepository.withTx(tx);

            await auditService.record({
              organizationId,
              actorType: 'system',
              actorId: enrollment.userId,
              action: 'CERTIFICATE_REVOKED',
              resourceType: 'Certificate',
              resourceId: cert.id,
              metadata: { reason: 'Recertification required' },
            });
            await certs.deleteByEnrollment(active.id);

            const finalAssessment = await assessments.findFinalByCourse(
              organizationId,
              enrollment.courseId,
            );
            if (finalAssessment) {
              await assessments.invalidatePassingAttempts(finalAssessment.id, enrollment.userId);
            }

            await enrollmentsTx.update(organizationId, active.id, {
              status: 'ENROLLED',
              source: 'RECERTIFY',
              progressPct: 0,
              completedAt: null,
              dueAt: assignment.dueAt,
              assignmentId: assignment.id,
            });
            await tx.progress.deleteMany({ where: { enrollmentId: active.id } });
          });
        } catch (err) {
          // Claim already consumed for today; continue so other enrollments still process.
          logger.error(
            {
              job: 'recertify',
              enrollmentId: active.id,
              err: err instanceof Error ? err.message : String(err),
            },
            'recertify_enrollment_failed',
          );
          continue;
        }

        reEnrolled += 1;
        void mailService.send({
          to: enrollment.user.email,
          subject: `Recertification required: ${enrollment.course.title}`,
          text: `Your certification for ${enrollment.course.title} requires renewal. Please complete the course again.`,
        });
        void notificationService.create({
          organizationId,
          userId: enrollment.userId,
          kind: 'RECERTIFY_REQUIRED',
          title: `Recertification required: ${enrollment.course.title}`,
          body: `Your certification for ${enrollment.course.title} requires renewal.`,
          href: notificationService.courseHref(enrollment.courseId),
          enrollmentId: active.id,
          courseId: enrollment.courseId,
        });
      }
    }

    return { reEnrolled };
  }

  async runAllOrganizations() {
    const orgs = await organizationRepository.listAll({
      skip: 0,
      take: 500,
      status: 'ACTIVE',
    });
    let reEnrolled = 0;
    for (const org of orgs.items) {
      const result = await this.run(org.id);
      reEnrolled += result.reEnrolled;
    }
    return { organizations: orgs.items.length, reEnrolled };
  }
}

export const recertifyService = new RecertifyService();
