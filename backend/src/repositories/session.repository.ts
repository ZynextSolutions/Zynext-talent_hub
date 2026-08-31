import type { Prisma, SessionRegistrationStatus } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';

export class SessionRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient): SessionRepository {
    return new SessionRepository(tx);
  }

  create(data: Prisma.TrainingSessionUncheckedCreateInput) {
    return this.db.trainingSession.create({ data });
  }

  findById(organizationId: string, id: string) {
    return this.db.trainingSession.findFirst({
      where: { id, organizationId },
      include: {
        registrations: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });
  }

  list(
    organizationId: string,
    params: { courseId: string; lessonId?: string; skip?: number; take?: number },
  ) {
    return this.db.trainingSession.findMany({
      where: {
        organizationId,
        courseId: params.courseId,
        ...(params.lessonId ? { lessonId: params.lessonId } : {}),
      },
      orderBy: { startsAt: 'asc' },
      skip: params.skip ?? 0,
      take: params.take ?? 100,
      include: {
        _count: { select: { registrations: true } },
        registrations: params.lessonId
          ? undefined
          : { select: { id: true, userId: true, status: true } },
      },
    });
  }

  update(organizationId: string, id: string, data: Prisma.TrainingSessionUncheckedUpdateInput) {
    return this.db.trainingSession.updateMany({ where: { id, organizationId }, data });
  }

  delete(organizationId: string, id: string) {
    return this.db.trainingSession.deleteMany({ where: { id, organizationId } });
  }

  findRegistration(sessionId: string, userId: string) {
    return this.db.sessionRegistration.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
  }

  createRegistration(data: Prisma.SessionRegistrationUncheckedCreateInput) {
    return this.db.sessionRegistration.create({ data });
  }

  updateRegistration(
    organizationId: string,
    id: string,
    data: Prisma.SessionRegistrationUncheckedUpdateInput,
  ) {
    return this.db.sessionRegistration.updateMany({ where: { id, organizationId }, data });
  }

  countRegistrations(sessionId: string, status?: SessionRegistrationStatus) {
    return this.db.sessionRegistration.count({
      where: { sessionId, ...(status ? { status } : {}) },
    });
  }

  listRegistrations(organizationId: string, sessionId: string) {
    return this.db.sessionRegistration.findMany({
      where: { organizationId, sessionId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }
}

export const sessionRepository = new SessionRepository();
