import { enrollmentService } from './enrollment.service';
import { assignmentRepository } from '../repositories/assignment.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { toAssignmentDto } from '../lib/mappers';
import { AppError } from '../errors/app-error';
import type { AssignmentTargetType } from '../domain/assignment-targets';
import type { AuthPrincipal, DataScope } from '../types/auth';
import { auditService } from './audit.service';

class AssignmentService {
  list(organizationId: string, courseId: string) {
    return assignmentRepository.listByCourse(organizationId, courseId).then((rows) => rows.map(toAssignmentDto));
  }

  async assign(input: {
    organizationId: string;
    courseId: string;
    targetType: AssignmentTargetType;
    targetId: string;
    actor: AuthPrincipal;
    scope?: DataScope;
    idempotencyKey?: string;
    dueAt?: string | null;
    recertifyEveryDays?: number | null;
    reminderDaysBefore?: number | null;
  }) {
    const result = await enrollmentService.assignCourse(input);
    await auditService.record({
      organizationId: input.organizationId,
      actorType: input.actor.actorType,
      actorId: input.actor.sub,
      action: 'COURSE_ASSIGN',
      resourceType: 'Course',
      resourceId: input.courseId,
      metadata: { targetType: input.targetType, targetId: input.targetId },
    });
    return result;
  }

  unassign(organizationId: string, courseId: string, assignmentId: string) {
    return enrollmentService.unassign(organizationId, courseId, assignmentId);
  }

  async patch(
    organizationId: string,
    courseId: string,
    assignmentId: string,
    body: { dueAt?: string | null; recertifyEveryDays?: number | null; reminderDaysBefore?: number | null },
  ) {
    const assignment = await assignmentRepository.getById(organizationId, assignmentId);
    if (!assignment || assignment.courseId !== courseId) throw AppError.from('NOT_FOUND');
    const dueAt = body.dueAt === undefined ? undefined : body.dueAt ? new Date(body.dueAt) : null;
    await assignmentRepository.update(organizationId, assignmentId, {
      ...(dueAt !== undefined ? { dueAt } : {}),
      ...(body.recertifyEveryDays !== undefined ? { recertifyEveryDays: body.recertifyEveryDays } : {}),
      ...(body.reminderDaysBefore !== undefined ? { reminderDaysBefore: body.reminderDaysBefore } : {}),
    });
    if (dueAt !== undefined) {
      await enrollmentRepository.updateMany(
        organizationId,
        { assignmentId, status: { in: ['ENROLLED', 'IN_PROGRESS'] } },
        { dueAt },
      );
    }
    const updated = await assignmentRepository.getById(organizationId, assignmentId);
    return toAssignmentDto(updated!);
  }
}

export const assignmentService = new AssignmentService();
