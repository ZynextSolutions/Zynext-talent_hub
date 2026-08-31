import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';
import { AppError } from '../errors/AppError';

const withQuestions = {
  questions: { orderBy: { orderIndex: 'asc' as const } },
  _count: { select: { questions: true } },
};

export class AssessmentRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new AssessmentRepository(tx);
  }

  findById(organizationId: string, id: string) {
    return this.db.assessment.findFirst({
      where: { id, organizationId },
      include: withQuestions,
    });
  }

  getById(organizationId: string, id: string) {
    return this.findById(organizationId, id);
  }

  findByCourse(organizationId: string, courseId: string) {
    return this.db.assessment.findFirst({
      where: { organizationId, courseId },
      include: withQuestions,
    });
  }

  findFinalByCourse(organizationId: string, courseId: string) {
    return this.db.assessment.findFirst({
      where: { organizationId, courseId, kind: 'FINAL' },
      include: withQuestions,
    });
  }

  findByCourseAndKind(organizationId: string, courseId: string, kind: 'PRE' | 'FINAL') {
    return this.db.assessment.findFirst({
      where: { organizationId, courseId, kind },
      include: withQuestions,
    });
  }

  findByLessonId(organizationId: string, lessonId: string) {
    return this.db.assessment.findFirst({
      where: { organizationId, lessonId, kind: 'MODULE_QUIZ' },
      include: withQuestions,
    });
  }

  listSurveyAttempts(assessmentId: string) {
    return this.db.assessmentAttempt.findMany({
      where: { assessmentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  getAttemptById(id: string) {
    return this.db.assessmentAttempt.findUnique({ where: { id } });
  }

  findOpenAttempt(assessmentId: string, userId: string) {
    return this.db.assessmentAttempt.findFirst({
      where: {
        assessmentId,
        userId,
        score: null,
        gradingStatus: 'AUTO_GRADED',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** @deprecated Use findOpenAttempt — kept for callers migrating to resolveOpenAttempt. */
  findInProgressAttempt(assessmentId: string, userId: string) {
    return this.findOpenAttempt(assessmentId, userId);
  }

  countAttemptsTowardLimit(assessmentId: string, userId: string) {
    return this.db.assessmentAttempt.count({
      where: {
        assessmentId,
        userId,
        OR: [
          { score: { not: null } },
          { gradingStatus: { in: ['PENDING_REVIEW', 'GRADED', 'EXPIRED'] } },
        ],
      },
    });
  }

  updateAttempt(id: string, data: Prisma.AssessmentAttemptUncheckedUpdateInput) {
    return this.db.assessmentAttempt.update({ where: { id }, data });
  }

  listPendingReview(organizationId: string, instructorId?: string) {
    return this.db.assessmentAttempt.findMany({
      where: {
        gradingStatus: 'PENDING_REVIEW',
        assessment: { organizationId, ...(instructorId ? { course: { createdByUserId: instructorId } } : {}) },
      },
      include: {
        assessment: { select: { id: true, title: true, courseId: true, passingScore: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  listByCourse(organizationId: string, courseId: string) {
    return this.db.assessment.findMany({
      where: { organizationId, courseId },
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  listByCourseWithQuestions(organizationId: string, courseId: string) {
    return this.db.assessment.findMany({
      where: { organizationId, courseId },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(data: Prisma.AssessmentUncheckedCreateInput) {
    return this.db.assessment.create({
      data,
      include: withQuestions,
    });
  }

  async update(organizationId: string, id: string, data: Prisma.AssessmentUncheckedUpdateInput) {
    const existing = await this.findById(organizationId, id);
    if (!existing) throw AppError.from('NOT_FOUND', 'Assessment not found.');
    return this.db.assessment.update({
      where: { id },
      data,
      include: withQuestions,
    });
  }

  async delete(organizationId: string, id: string) {
    const res = await this.db.assessment.deleteMany({ where: { id, organizationId } });
    if (res.count !== 1) throw AppError.from('NOT_FOUND', 'Assessment not found.');
    return { id };
  }

  createAttempt(data: Prisma.AssessmentAttemptUncheckedCreateInput) {
    return this.db.assessmentAttempt.create({ data });
  }

  listAttempts(assessmentId: string, userId?: string) {
    return this.db.assessmentAttempt.findMany({
      where: { assessmentId, ...(userId ? { userId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  countAttempts(assessmentId: string, userId: string) {
    return this.db.assessmentAttempt.count({ where: { assessmentId, userId } });
  }

  latestPassing(assessmentId: string, userId: string) {
    return this.db.assessmentAttempt.findFirst({
      where: { assessmentId, userId, passed: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async hasPassingAttempt(assessmentId: string, userId: string) {
    const row = await this.latestPassing(assessmentId, userId);
    return Boolean(row);
  }

  invalidatePassingAttempts(assessmentId: string, userId: string) {
    return this.db.assessmentAttempt.updateMany({
      where: { assessmentId, userId, passed: true },
      data: { passed: false, gradingStatus: 'EXPIRED' },
    });
  }

  async requireById(organizationId: string, id: string) {
    const row = await this.findById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND', 'Assessment not found.');
    return row;
  }
}

export const assessmentRepository = new AssessmentRepository();
