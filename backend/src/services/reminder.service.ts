import { prisma } from '../repositories/prisma';
import { reminderDeliveryRepository } from '../repositories/reminder-delivery.repository';
import { notificationService } from './notification.service';
import { mailService } from './mail.service';
import { clock } from '../lib/clock';
import { daysUntilDue, startOfUtcDay } from '../lib/date';
import { organizationRepository } from '../repositories/organization.repository';

class ReminderService {
  async run(organizationId: string) {
    const now = clock.now();
    const today = startOfUtcDay(now);
    const enrollments = await prisma.enrollment.findMany({
      where: {
        organizationId,
        status: { in: ['ENROLLED', 'IN_PROGRESS'] },
        dueAt: { not: null },
      },
      include: { user: true, course: true },
    });
    const assignmentIds = [
      ...new Set(enrollments.map((row) => row.assignmentId).filter((id): id is string => !!id)),
    ];
    const assignments = assignmentIds.length
      ? await prisma.courseAssignment.findMany({
          where: { organizationId, id: { in: assignmentIds } },
        })
      : [];
    const assignmentById = new Map(assignments.map((row) => [row.id, row]));

    let dueRemindersSent = 0;
    let overdueSent = 0;

    for (const enrollment of enrollments) {
      if (!enrollment.dueAt) continue;
      const reminderDays = (enrollment.assignmentId
        ? assignmentById.get(enrollment.assignmentId)?.reminderDaysBefore
        : null) ?? 7;
      const daysLeft = daysUntilDue(enrollment.dueAt, now);
      const dueLabel = enrollment.dueAt.toISOString().slice(0, 10);
      const href = notificationService.courseHref(enrollment.courseId);

      if (daysLeft >= 0 && daysLeft <= reminderDays) {
        const sent = await this.sendDueReminder({
          organizationId,
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          email: enrollment.user.email,
          courseTitle: enrollment.course.title,
          daysLeft,
          dueLabel,
          today,
          href,
          kind: 'due_reminder',
          notificationKind: 'DUE_REMINDER',
          title:
            daysLeft === 0
              ? `${enrollment.course.title} is due today`
              : `${enrollment.course.title} due in ${daysLeft} day(s)`,
          body: `Complete ${enrollment.course.title} by ${dueLabel}.`,
        });
        if (sent) dueRemindersSent += 1;
      } else if (daysLeft < 0) {
        const overdueDays = Math.abs(daysLeft);
        const sent = await this.sendDueReminder({
          organizationId,
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          email: enrollment.user.email,
          courseTitle: enrollment.course.title,
          daysLeft: overdueDays,
          dueLabel,
          today,
          href,
          kind: 'overdue',
          notificationKind: 'OVERDUE',
          title: `${enrollment.course.title} is overdue`,
          body: `This course was due on ${dueLabel} (${overdueDays} day(s) ago).`,
        });
        if (sent) overdueSent += 1;
      }
    }

    return { dueRemindersSent, overdueSent };
  }

  async runAllOrganizations() {
    const orgs = await organizationRepository.listAll({
      skip: 0,
      take: 500,
      status: 'ACTIVE',
    });
    let dueRemindersSent = 0;
    let overdueSent = 0;
    for (const org of orgs.items) {
      const result = await this.run(org.id);
      dueRemindersSent += result.dueRemindersSent;
      overdueSent += result.overdueSent;
    }
    return { organizations: orgs.items.length, dueRemindersSent, overdueSent };
  }

  private async sendDueReminder(input: {
    organizationId: string;
    enrollmentId: string;
    userId: string;
    courseId: string;
    email: string;
    courseTitle: string;
    daysLeft: number;
    dueLabel: string;
    today: Date;
    href: string;
    kind: string;
    notificationKind: 'DUE_REMINDER' | 'OVERDUE';
    title: string;
    body: string;
  }) {
    const claimedInApp = await reminderDeliveryRepository.tryClaim({
      organizationId: input.organizationId,
      userId: input.userId,
      enrollmentId: input.enrollmentId,
      channel: 'in_app',
      kind: input.kind,
      sentOnDate: input.today,
    });
    if (!claimedInApp) return false;

    await notificationService.create({
      organizationId: input.organizationId,
      userId: input.userId,
      kind: input.notificationKind,
      title: input.title,
      body: input.body,
      href: input.href,
      enrollmentId: input.enrollmentId,
      courseId: input.courseId,
    });

    const claimedEmail = await reminderDeliveryRepository.tryClaim({
      organizationId: input.organizationId,
      userId: input.userId,
      enrollmentId: input.enrollmentId,
      channel: 'email',
      kind: input.kind,
      sentOnDate: input.today,
    });
    if (claimedEmail) {
      void mailService.sendDueReminder({
        to: input.email,
        courseTitle: input.courseTitle,
        dueLabel: input.dueLabel,
        daysLeft: input.kind === 'overdue' ? -input.daysLeft : input.daysLeft,
      });
    }

    return true;
  }
}

export const reminderService = new ReminderService();
