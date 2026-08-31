import type { AssignmentTargetType, Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class PathAssignmentRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new PathAssignmentRepository(tx);
  }

  listByPath(organizationId: string, pathId: string) {
    return this.db.pathAssignment.findMany({
      where: { organizationId, pathId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findExisting(
    organizationId: string,
    pathId: string,
    targetType: AssignmentTargetType,
    targetId: string,
  ) {
    return this.db.pathAssignment.findUnique({
      where: {
        organizationId_pathId_targetType_targetId: {
          organizationId,
          pathId,
          targetType,
          targetId,
        },
      },
    });
  }

  create(data: Prisma.PathAssignmentUncheckedCreateInput) {
    return this.db.pathAssignment.create({ data });
  }

  async delete(organizationId: string, pathId: string, assignmentId: string) {
    const res = await this.db.pathAssignment.deleteMany({
      where: { id: assignmentId, organizationId, pathId },
    });
    return res.count === 1;
  }
}

export const pathAssignmentRepository = new PathAssignmentRepository();
