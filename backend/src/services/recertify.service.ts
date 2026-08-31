import { prisma } from '../repositories/prisma';
import { assignmentRepository } from '../repositories/assignment.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { organizationRepository } from '../repositories/organization.repository';
import { certificateRepository } from '../repositories/certificate.repository';
import { assessmentRepository } from '../repositories/assessment.repository';
import { auditService } from './audit.service';
import { mailService } from './mail.service';
import { notificationService } from './notification.service';
import { clock } from '../lib/clock';

class RecertifyService {
  async run(organizationId: string) {
    const assignments = await assignmentRepository.listByOrg(organizationId);
    const recertAssignments = assignments.filter((a) => a.recertifyEveryDays && a.recertifyEveryDays > 0);
    let reEnrolled = 0;

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
        if (assignment.recertifyEveryDays && ageDays >= assignment.recertifyEveryDays) {
          const active = await enrollmentRepository.findByUserCourse(
            organizationId,
            enrollment.userId,
            enrollment.courseId,
          );
          if (active && active.status !== 'COMPLETED' && active.status !== 'REVOKED') continue;
          if (!active) continue;

          await auditService.record({
            organizationId,
            actorType: 'system',
            actorId: enrollment.userId,
            action: 'CERTIFICATE_REVOKED',
            resourceType: 'Certificate',
            resourceId: cert.id,
            metadata: { reason: 'Recertification required' },
          });
          await certificateRepository.deleteByEnrollment(active.id);

          const finalAssessment = await assessmentRepository.findFinalByCourse(
            organizationId,
            enrollment.courseId,
          );
          if (finalAssessment) {
            await assessmentRepository.invalidatePassingAttempts(finalAssessment.id, enrollment.userId);
          }

          await enrollmentRepository.update(organizationId, active.id, {
            status: 'ENROLLED',
            source: 'RECERTIFY',
            progressPct: 0,
            completedAt: null,
            dueAt: assignment.dueAt,
            assignmentId: assignment.id,
          });
          await prisma.progress.deleteMany({ where: { enrollmentId: active.id } });
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
