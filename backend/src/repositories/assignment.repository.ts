import type { AssignmentTargetType, Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class AssignmentRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new AssignmentRepository(tx);
  }

  listByCourse(organizationId: string, courseId: string) {
    return this.db.courseAssignment.findMany({
      where: { organizationId, courseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listByOrg(organizationId: string) {
    return this.db.courseAssignment.findMany({ where: { organizationId } });
  }

  findById(organizationId: string, id: string) {
    return this.db.courseAssignment.findFirst({ where: { id, organizationId } });
  }

  getById(organizationId: string, id: string) {
    return this.findById(organizationId, id);
  }

  findUnique(
    organizationId: string,
    courseId: string,
    targetType: AssignmentTargetType,
    targetId: string,
  ) {
    return this.db.courseAssignment.findUnique({
      where: {
        organizationId_courseId_targetType_targetId: {
          organizationId,
          courseId,
          targetType,
          targetId,
        },
      },
    });
  }

  upsert(
    organizationId: string,
    data: {
      courseId: string;
      targetType: AssignmentTargetType;
      targetId: string;
    },
  ) {
    return this.db.courseAssignment.upsert({
      where: {
        organizationId_courseId_targetType_targetId: {
          organizationId,
          courseId: data.courseId,
          targetType: data.targetType,
          targetId: data.targetId,
        },
      },
      create: {
        organizationId,
        courseId: data.courseId,
        targetType: data.targetType,
        targetId: data.targetId,
      },
      update: {},
    });
  }

  async delete(organizationId: string, idOrCourseId: string, assignmentId?: string) {
    const id = assignmentId ?? idOrCourseId;
    const res = await this.db.courseAssignment.deleteMany({ where: { id, organizationId } });
    return res.count;
  }

  findExisting(
    organizationId: string,
    courseId: string,
    targetType: AssignmentTargetType,
    targetId: string,
  ) {
    return this.db.courseAssignment.findFirst({
      where: { organizationId, courseId, targetType, targetId },
    });
  }

  create(data: {
    organizationId: string;
    courseId: string;
    targetType: AssignmentTargetType;
    targetId: string;
    createdByUserId?: string | null;
    dueAt?: Date | null;
    recertifyEveryDays?: number | null;
    reminderDaysBefore?: number | null;
  }) {
    return this.db.courseAssignment.create({
      data: {
        organizationId: data.organizationId,
        courseId: data.courseId,
        targetType: data.targetType,
        targetId: data.targetId,
        createdByUserId: data.createdByUserId ?? null,
        dueAt: data.dueAt ?? null,
        recertifyEveryDays: data.recertifyEveryDays ?? null,
        reminderDaysBefore: data.reminderDaysBefore ?? 7,
      },
    });
  }

  update(organizationId: string, id: string, data: Prisma.CourseAssignmentUncheckedUpdateInput) {
    return this.db.courseAssignment.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  listCoveringUser(
    organizationId: string,
    user: {
      id: string;
      divisionId: string | null;
      departmentId: string | null;
      teamId: string | null;
    },
  ) {
    const or: Prisma.CourseAssignmentWhereInput[] = [
      { targetType: 'ORGANIZATION', targetId: organizationId },
      { targetType: 'USER', targetId: user.id },
    ];
    if (user.divisionId) or.push({ targetType: 'DIVISION', targetId: user.divisionId });
    if (user.departmentId) or.push({ targetType: 'DEPARTMENT', targetId: user.departmentId });
    if (user.teamId) or.push({ targetType: 'TEAM', targetId: user.teamId });
    return this.db.courseAssignment.findMany({
      where: { organizationId, OR: or },
    });
  }
}

export const assignmentRepository = new AssignmentRepository();
