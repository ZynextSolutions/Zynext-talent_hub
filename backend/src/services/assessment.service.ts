import { randomUUID } from 'node:crypto';
import type { AssessmentAttempt, AssessmentKind, AssessmentQuestion, Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { prisma } from '../repositories/prisma';
import { assessmentRepository } from '../repositories/assessment.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { questionBankRepository } from '../repositories/question-bank.repository';
import { lessonRepository } from '../repositories/lesson.repository';
import {
  toAssessmentDto,
  toAttemptDto,
  toQuestionDto,
  toQuestionDtoFromSnapshot,
  parseSettings,
} from '../lib/mappers';
import { organizationRepository } from '../repositories/organization.repository';
import { buildAttemptReviewItems, isReviewableAttempt } from '../lib/assessment-review';
import { certificateService } from './certificate.service';
import { courseService } from './course.service';
import { hasPermission } from '../lib/rbac';
import {
  buildQuestionData,
  computeAttemptScore,
  questionToAttemptSnapshot,
  shuffle,
  snapshotToQuestionRow,
  validateEssayAnswer,
} from '../lib/assessment-questions';
import { clock } from '../lib/clock';
import { assertPreAssessmentPassed } from '../lib/pre-assessment-gate';
import { progressService } from './progress.service';
import { xapiService } from './xapi.service';
import type { AuthPrincipal } from '../types/auth';
import { TX_SERIALIZABLE } from '../config/constants';
import { isPrismaUniqueViolation } from '../errors/prisma-map';

type CreateBody = {
  title: string;
  kind?: AssessmentKind;
  passingScore?: number;
  maxAttempts?: number | null;
  timeLimitSeconds?: number | null;
  bankId?: string | null;
  drawCount?: number | null;
  drawTags?: string[];
  lessonId?: string | null;
  anonymous?: boolean;
  questions?: Array<{
    prompt: string;
    type?: 'MCQ' | 'TRUE_FALSE' | 'MULTI_SELECT' | 'SHORT_ANSWER' | 'FILL_BLANK' | 'MATCHING' | 'ESSAY';
    options?: string[];
    correctOptionIndex?: number;
    correctOptionIndices?: number[];
    points?: number;
    explanation?: string;
    difficulty?: string;
    blanks?: Array<{ acceptableAnswers: string[] }>;
    pairs?: Array<{ left: string; right: string }>;
    minWords?: number;
    maxWords?: number;
  }>;
};

class AssessmentService {
  private canAuthorAssessment(actor: AuthPrincipal): boolean {
    return actor.actorType === 'platform' || hasPermission(actor.permissions, 'assessment:write');
  }

  private assertEnrollmentActive(enrollment: { status: string }) {
    if (enrollment.status === 'REVOKED') throw AppError.from('RBAC_FORBIDDEN');
  }

  private assertFinalReady(
    assessment: { kind: AssessmentKind },
    enrollment: { progressPct: number },
  ) {
    if (assessment.kind === 'FINAL' && Math.floor(enrollment.progressPct) < 100) {
      throw AppError.from('ENROLLMENT_NOT_READY');
    }
  }

  private isAttemptExpired(attempt: { expiresAt: Date | null }) {
    return attempt.expiresAt != null && attempt.expiresAt.getTime() < clock.now().getTime();
  }

  private async markAttemptExpired(attemptId: string) {
    return assessmentRepository.updateAttempt(attemptId, {
      gradingStatus: 'EXPIRED',
      score: 0,
      passed: false,
    });
  }

  private isTerminalAttempt(attempt: { score: number | null; gradingStatus: string }) {
    if (attempt.score !== null) return true;
    return ['PENDING_REVIEW', 'GRADED', 'EXPIRED'].includes(attempt.gradingStatus);
  }

  /** Returns a non-expired open attempt, auto-closing timed attempts past expiresAt. */
  private async resolveOpenAttempt(assessmentId: string, userId: string) {
    const attempt = await assessmentRepository.findOpenAttempt(assessmentId, userId);
    if (!attempt) return null;
    if (this.isAttemptExpired(attempt)) {
      await this.markAttemptExpired(attempt.id);
      return null;
    }
    return attempt;
  }

  private openAttemptResponse(attempt: AssessmentAttempt) {
    const snapshot = Array.isArray(attempt.questionSnapshot)
      ? (attempt.questionSnapshot as Record<string, unknown>[])
      : [];
    return {
      attempt: toAttemptDto(attempt),
      questions: snapshot.map((q) => toQuestionDtoFromSnapshot(q, false)),
      expiresAt: attempt.expiresAt?.toISOString() ?? null,
    };
  }

  async listByCourse(organizationId: string, courseId: string, actor: AuthPrincipal) {
    await courseService.assertCanRead(organizationId, courseId, actor);
    const rows = await assessmentRepository.listByCourse(organizationId, courseId);
    return rows.map((r) => toAssessmentDto(r, r._count.questions));
  }

  async get(organizationId: string, id: string, actor: AuthPrincipal) {
    const row = await assessmentRepository.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    await courseService.assertCanRead(organizationId, row.courseId, actor);
    const isAuthor = this.canAuthorAssessment(actor);

    const inProgress = await this.resolveOpenAttempt(id, actor.sub);
    if (inProgress?.questionSnapshot && Array.isArray(inProgress.questionSnapshot)) {
      const questions = (inProgress.questionSnapshot as Record<string, unknown>[]).map((q) =>
        toQuestionDtoFromSnapshot(q, false),
      );
      return {
        ...toAssessmentDto(row, isAuthor ? row._count.questions : questions.length),
        activeAttempt: toAttemptDto(inProgress),
        questions,
      };
    }

    if (isAuthor) {
      return {
        ...toAssessmentDto(row, row._count.questions),
        questions: row.questions.map((q) => toQuestionDto(q, true)),
      };
    }

    return {
      ...toAssessmentDto(row, row._count.questions),
      questions: [],
    };
  }

  async create(organizationId: string, courseId: string, actor: AuthPrincipal, body: CreateBody) {
    await courseService.assertCanWrite(organizationId, courseId, actor);
    const kind = body.kind ?? 'FINAL';

    if (kind === 'PRE' || kind === 'FINAL') {
      const existing = await assessmentRepository.findByCourseAndKind(organizationId, courseId, kind);
      if (existing) throw AppError.from('ASSESSMENT_KIND_EXISTS');
    }

    if (kind === 'MODULE_QUIZ') {
      if (!body.lessonId) {
        throw AppError.from('VALIDATION_ERROR', 'lessonId is required for module quiz');
      }
      const lesson = await lessonRepository.getById(organizationId, body.lessonId);
      if (!lesson || lesson.courseId !== courseId) throw AppError.from('NOT_FOUND');
      const linked = await assessmentRepository.findByLessonId(organizationId, body.lessonId);
      if (linked) throw AppError.from('VALIDATION_ERROR', 'This lesson already has a module quiz');
    }

    if (body.bankId) {
      const bank = await questionBankRepository.getById(organizationId, body.bankId);
      if (!bank) throw AppError.from('NOT_FOUND', 'Question bank not found');
    }

    const passingScore = kind === 'SURVEY' ? 0 : (body.passingScore ?? 70);
    const maxAttempts = kind === 'SURVEY' ? null : (body.maxAttempts ?? 3);
    const anonymous = kind === 'SURVEY' ? Boolean(body.anonymous) : false;

    const created = await prisma.$transaction(async (tx) => {
      const assessment = await tx.assessment.create({
        data: {
          organizationId,
          courseId,
          title: body.title,
          kind,
          passingScore,
          maxAttempts,
          timeLimitSeconds: body.timeLimitSeconds ?? null,
          bankId: body.bankId ?? null,
          drawCount: body.drawCount ?? null,
          drawTags: body.drawTags ?? [],
          lessonId: kind === 'MODULE_QUIZ' ? body.lessonId! : null,
          anonymous,
        },
      });

      if (!body.bankId && body.questions?.length) {
        for (let i = 0; i < body.questions.length; i += 1) {
          const q = buildQuestionData(body.questions[i]!);
          await tx.assessmentQuestion.create({
            data: {
              assessmentId: assessment.id,
              question: q.question,
              type: q.type,
              options: q.options,
              correctOptionId: q.correctOptionId,
              correctOptionIds: q.correctOptionIds ?? undefined,
              points: q.points,
              explanation: q.explanation,
              difficulty: q.difficulty,
              metadata: q.metadata as Prisma.InputJsonValue,
              orderIndex: i,
            },
          });
        }
      }

      return tx.assessment.findFirst({
        where: { id: assessment.id },
        include: { questions: { orderBy: { orderIndex: 'asc' } }, _count: { select: { questions: true } } },
      });
    });

    return {
      ...toAssessmentDto(created!, created!._count.questions),
      questions: created!.questions.map((q) => toQuestionDto(q, true)),
    };
  }

  async update(
    organizationId: string,
    id: string,
    actor: AuthPrincipal,
    body: {
      title?: string;
      passingScore?: number;
      maxAttempts?: number | null;
      timeLimitSeconds?: number | null;
      bankId?: string | null;
      drawCount?: number | null;
      drawTags?: string[];
      questions?: CreateBody['questions'];
    },
  ) {
    const existing = await assessmentRepository.getById(organizationId, id);
    if (!existing) throw AppError.from('NOT_FOUND');
    await courseService.assertCanWrite(organizationId, existing.courseId, actor);

    if (body.questions?.length && body.bankId) {
      throw AppError.from('VALIDATION_ERROR', 'Provide either custom questions or a question bank');
    }

    if (body.bankId) {
      const bank = await questionBankRepository.getById(organizationId, body.bankId);
      if (!bank) throw AppError.from('NOT_FOUND', 'Question bank not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const meta: Prisma.AssessmentUncheckedUpdateInput = {};
      if (body.title !== undefined) meta.title = body.title;
      if (body.passingScore !== undefined) meta.passingScore = body.passingScore;
      if (body.maxAttempts !== undefined) meta.maxAttempts = body.maxAttempts;
      if (body.timeLimitSeconds !== undefined) meta.timeLimitSeconds = body.timeLimitSeconds;

      if (body.drawTags !== undefined) meta.drawTags = body.drawTags;

      if (body.bankId !== undefined) {
        meta.bankId = body.bankId;
        if (body.bankId) {
          meta.drawCount = body.drawCount ?? existing.drawCount ?? 1;
          await tx.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
        } else {
          meta.drawCount = null;
        }
      } else if (body.drawCount !== undefined) {
        if (!existing.bankId) {
          throw AppError.from('VALIDATION_ERROR', 'drawCount applies only to question-bank assessments');
        }
        meta.drawCount = body.drawCount;
      }

      if (body.questions?.length) {
        meta.bankId = null;
        meta.drawCount = null;
        await tx.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
        for (let i = 0; i < body.questions.length; i += 1) {
          const q = buildQuestionData(body.questions[i]!);
          await tx.assessmentQuestion.create({
            data: {
              assessmentId: id,
              question: q.question,
              type: q.type,
              options: q.options,
              correctOptionId: q.correctOptionId,
              correctOptionIds: q.correctOptionIds ?? undefined,
              points: q.points,
              explanation: q.explanation,
              difficulty: q.difficulty,
              metadata: q.metadata as Prisma.InputJsonValue,
              orderIndex: i,
            },
          });
        }
      }

      if (Object.keys(meta).length) {
        await tx.assessment.update({ where: { id }, data: meta });
      }

      return tx.assessment.findFirst({
        where: { id },
        include: {
          questions: { orderBy: { orderIndex: 'asc' } },
          _count: { select: { questions: true } },
        },
      });
    });

    if (!updated) throw AppError.from('NOT_FOUND');
    return {
      ...toAssessmentDto(updated, updated._count.questions),
      questions: updated.questions.map((q) => toQuestionDto(q, true)),
    };
  }

  async remove(organizationId: string, id: string, actor: AuthPrincipal) {
    const existing = await assessmentRepository.getById(organizationId, id);
    if (!existing) throw AppError.from('NOT_FOUND');
    await courseService.assertCanWrite(organizationId, existing.courseId, actor);
    await assessmentRepository.delete(organizationId, id);
    return { id };
  }

  private async resolveQuestionsForAttempt(
    organizationId: string,
    assessment: {
      id: string;
      bankId: string | null;
      drawCount: number | null;
      drawTags: string[];
      questions: AssessmentQuestion[];
    },
  ) {
    if (assessment.bankId && assessment.drawCount) {
      const bank = await questionBankRepository.getById(organizationId, assessment.bankId);
      if (!bank || !bank.questions.length) throw AppError.from('VALIDATION_ERROR', 'Question bank is empty');
      let pool = bank.questions;
      if (assessment.drawTags.length) {
        pool = pool.filter((q) => assessment.drawTags.some((tag) => q.tags.includes(tag)));
        if (!pool.length) {
          throw AppError.from('VALIDATION_ERROR', 'No bank questions match the selected draw tags');
        }
      }
      const draw = Math.min(assessment.drawCount, pool.length);
      const picked = shuffle(pool).slice(0, draw);
      return picked.map((q, i) => ({
        id: randomUUID(),
        question: q.question,
        type: q.type,
        options: q.options,
        correctOptionId: q.correctOptionId,
        correctOptionIds: q.correctOptionIds,
        points: q.points,
        explanation: q.explanation,
        difficulty: q.difficulty,
        metadata: q.metadata,
        orderIndex: i,
        bankQuestionId: q.id,
      }));
    }
    return assessment.questions;
  }

  async startAttempt(
    organizationId: string,
    assessmentId: string,
    actor: AuthPrincipal,
    body: { enrollmentId: string },
  ) {
    const assessment = await assessmentRepository.getById(organizationId, assessmentId);
    if (!assessment) throw AppError.from('NOT_FOUND');
    const enrollment = await enrollmentRepository.getById(organizationId, body.enrollmentId);
    if (!enrollment) throw AppError.from('NOT_FOUND');
    if (enrollment.userId !== actor.sub) throw AppError.from('RBAC_FORBIDDEN');
    if (enrollment.courseId !== assessment.courseId) throw AppError.from('NOT_FOUND');
    this.assertEnrollmentActive(enrollment);
    this.assertFinalReady(assessment, enrollment);
    if (assessment.kind !== 'PRE') {
      await assertPreAssessmentPassed(organizationId, assessment.courseId, actor.sub);
    }

    const existing = await this.resolveOpenAttempt(assessmentId, actor.sub);
    if (existing) return this.openAttemptResponse(existing);

    const questions = await this.resolveQuestionsForAttempt(organizationId, assessment);
    if (!questions.length) throw AppError.from('VALIDATION_ERROR', 'Assessment has no questions');

    const now = clock.now();
    const expiresAt =
      assessment.timeLimitSeconds != null
        ? new Date(now.getTime() + assessment.timeLimitSeconds * 1000)
        : null;

    const snapshot = questions.map(questionToAttemptSnapshot);

    try {
      const attempt = await prisma.$transaction(async (tx) => {
        const repo = assessmentRepository.withTx(tx);
        const attemptCount = await repo.countAttemptsTowardLimit(assessmentId, actor.sub);
        if (assessment.maxAttempts !== null && attemptCount >= assessment.maxAttempts) {
          throw AppError.from('ASSESSMENT_MAX_ATTEMPTS');
        }
        return repo.createAttempt({
          userId: actor.sub,
          assessmentId,
          enrollmentId: enrollment.id,
          attemptNumber: attemptCount + 1,
          startedAt: now,
          expiresAt,
          questionSnapshot: snapshot as Prisma.InputJsonValue,
          answers: [],
          score: null,
          passed: false,
          gradingStatus: 'AUTO_GRADED',
        });
      }, TX_SERIALIZABLE);
      return this.openAttemptResponse(attempt);
    } catch (err) {
      if (isPrismaUniqueViolation(err, 'attempt_number') || isPrismaUniqueViolation(err, 'attemptNumber')) {
        const open = await this.resolveOpenAttempt(assessmentId, actor.sub);
        if (open) return this.openAttemptResponse(open);
        throw AppError.from('ASSESSMENT_MAX_ATTEMPTS');
      }
      throw err;
    }
  }

  async expireAttempt(
    organizationId: string,
    assessmentId: string,
    actor: AuthPrincipal,
    body: { enrollmentId: string },
  ) {
    const assessment = await assessmentRepository.getById(organizationId, assessmentId);
    if (!assessment) throw AppError.from('NOT_FOUND');
    const enrollment = await enrollmentRepository.getById(organizationId, body.enrollmentId);
    if (!enrollment) throw AppError.from('NOT_FOUND');
    if (enrollment.userId !== actor.sub) throw AppError.from('RBAC_FORBIDDEN');
    if (enrollment.courseId !== assessment.courseId) throw AppError.from('NOT_FOUND');
    this.assertEnrollmentActive(enrollment);

    const attempt = await assessmentRepository.findOpenAttempt(assessmentId, actor.sub);
    if (!attempt) throw AppError.from('NOT_FOUND', 'No open attempt to expire');

    if (!this.isAttemptExpired(attempt)) {
      throw AppError.from('VALIDATION_ERROR', 'This attempt has not expired yet');
    }

    const updated = await this.markAttemptExpired(attempt.id);
    return { attempt: toAttemptDto(updated) };
  }

  async submit(
    organizationId: string,
    assessmentId: string,
    actor: AuthPrincipal,
    body: {
      enrollmentId: string;
      attemptId?: string;
      answers: Array<{
        questionId: string;
        optionId?: string;
        optionIds?: string[];
        text?: string;
        blanks?: Array<{ blankId: string; text: string }>;
        matches?: Array<{ leftId: string; rightId: string }>;
      }>;
    },
  ) {
    const assessment = await assessmentRepository.getById(organizationId, assessmentId);
    if (!assessment) throw AppError.from('NOT_FOUND');
    const enrollment = await enrollmentRepository.getById(organizationId, body.enrollmentId);
    if (!enrollment) throw AppError.from('NOT_FOUND');
    if (enrollment.userId !== actor.sub) throw AppError.from('RBAC_FORBIDDEN');
    if (enrollment.courseId !== assessment.courseId) throw AppError.from('NOT_FOUND');
    this.assertEnrollmentActive(enrollment);
    this.assertFinalReady(assessment, enrollment);
    if (assessment.kind !== 'PRE') {
      await assertPreAssessmentPassed(organizationId, assessment.courseId, actor.sub);
    }

    let attempt = body.attemptId
      ? await assessmentRepository.getAttemptById(body.attemptId)
      : await this.resolveOpenAttempt(assessmentId, actor.sub);

    if (!attempt) {
      throw AppError.from('VALIDATION_ERROR', 'Start the assessment before submitting');
    }

    if (attempt.userId !== actor.sub || attempt.assessmentId !== assessmentId) {
      throw AppError.from('NOT_FOUND');
    }
    if (this.isTerminalAttempt(attempt)) {
      throw AppError.from('VALIDATION_ERROR', 'Attempt already submitted');
    }

    if (this.isAttemptExpired(attempt)) {
      await this.markAttemptExpired(attempt.id);
      throw AppError.from('ASSESSMENT_EXPIRED');
    }

    const snapshotRaw = attempt.questionSnapshot;
    if (!Array.isArray(snapshotRaw) || !snapshotRaw.length) {
      throw AppError.from('VALIDATION_ERROR', 'Attempt snapshot is missing');
    }
    const snapshot = snapshotRaw as Record<string, unknown>[];
    const questionRows = snapshot.map(snapshotToQuestionRow);

    if (assessment.kind === 'SURVEY') {
      return prisma.$transaction(async (tx) => {
        const updated = await assessmentRepository.withTx(tx).updateAttempt(attempt!.id, {
          score: null,
          passed: false,
          gradingStatus: 'GRADED',
          answers: body.answers,
        });
        return {
          attempt: {
            id: updated.id,
            score: updated.score,
            passed: updated.passed,
            attemptNumber: updated.attemptNumber,
            gradingStatus: updated.gradingStatus,
            submittedAt: updated.createdAt.toISOString(),
          },
          certificate: null,
          pendingReview: false,
          survey: true,
        };
      });
    }

    for (const q of snapshot) {
      if (q.type === 'ESSAY') {
        const ans = body.answers.find((a) => a.questionId === String(q.id));
        validateEssayAnswer(q.metadata, ans?.text ?? '');
      }
    }

    const { score, pendingReview } = computeAttemptScore(questionRows, body.answers);
    const passed = pendingReview > 0 ? false : score !== null && score >= assessment.passingScore;
    const gradingStatus = pendingReview > 0 ? 'PENDING_REVIEW' : 'AUTO_GRADED';

    const result = await prisma.$transaction(async (tx) => {
      const updated = await assessmentRepository.withTx(tx).updateAttempt(attempt!.id, {
        score,
        passed,
        gradingStatus,
        answers: body.answers,
      });

      let certificate = null;
      if (passed && assessment.kind === 'FINAL') {
        certificate = await certificateService.issueIfEligible(organizationId, enrollment.id, tx);
      }

      if (
        passed &&
        assessment.kind === 'MODULE_QUIZ' &&
        assessment.lessonId &&
        enrollment.id
      ) {
        await progressService.completeLessonByEnrollment(
          organizationId,
          enrollment.id,
          assessment.lessonId,
          tx,
        );
      }

      return {
        attempt: {
          id: updated.id,
          score: updated.score,
          passed: updated.passed,
          attemptNumber: updated.attemptNumber,
          gradingStatus: updated.gradingStatus,
          submittedAt: updated.createdAt.toISOString(),
        },
        certificate,
        pendingReview: pendingReview > 0,
      };
    });

    void xapiService.record({
      organizationId,
      userId: enrollment.userId,
      verb: passed ? 'passed' : 'failed',
      objectType: 'assessment',
      objectId: assessmentId,
      objectName: assessment.title,
      result: { score, success: passed },
    });

    return result;
  }

  async gradeAttempt(
    organizationId: string,
    attemptId: string,
    actor: AuthPrincipal,
    body: { score: number; passed: boolean; instructorFeedback?: string },
  ) {
    const attempt = await assessmentRepository.getAttemptById(attemptId);
    if (!attempt) throw AppError.from('NOT_FOUND');
    const assessment = await assessmentRepository.getById(organizationId, attempt.assessmentId);
    if (!assessment) throw AppError.from('NOT_FOUND');
    await courseService.assertCanWrite(organizationId, assessment.courseId, actor);
    if (attempt.gradingStatus !== 'PENDING_REVIEW') {
      throw AppError.from('VALIDATION_ERROR', 'Attempt is not pending review');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await assessmentRepository.withTx(tx).updateAttempt(attemptId, {
        score: body.score,
        passed: body.passed,
        gradingStatus: 'GRADED',
        gradedByUserId: actor.sub,
        gradedAt: clock.now(),
        instructorFeedback: body.instructorFeedback ?? null,
      });

      let certificate = null;
      if (body.passed && attempt.enrollmentId && assessment.kind === 'FINAL') {
        certificate = await certificateService.issueIfEligible(
          organizationId,
          attempt.enrollmentId,
          tx,
        );
      }

      if (
        body.passed &&
        assessment.kind === 'MODULE_QUIZ' &&
        assessment.lessonId &&
        attempt.enrollmentId
      ) {
        await progressService.completeLessonByEnrollment(
          organizationId,
          attempt.enrollmentId,
          assessment.lessonId,
        );
      }

      return { attempt: toAttemptDto(updated), certificate };
    });
  }

  private formatSurveyAnswerCell(
    question: Record<string, unknown> | undefined,
    answer:
      | {
          optionId?: string;
          optionIds?: string[];
          text?: string;
          blanks?: Array<{ blankId: string; text: string }>;
          matches?: Array<{ leftId: string; rightId: string }>;
        }
      | undefined,
  ): string {
    if (!answer) return '';
    if (answer.text) return answer.text;
    const options = Array.isArray(question?.options)
      ? (question!.options as Array<{ id: string; text: string }>)
      : [];
    if (answer.optionId) {
      return options.find((opt) => opt.id === answer.optionId)?.text ?? answer.optionId;
    }
    if (answer.optionIds?.length) {
      return answer.optionIds
        .map((id) => options.find((opt) => opt.id === id)?.text ?? id)
        .join('; ');
    }
    if (answer.blanks?.length) {
      return answer.blanks.map((blank) => blank.text).join(' | ');
    }
    if (answer.matches?.length) {
      const rightItems = Array.isArray(question?.metadata)
        ? []
        : Array.isArray((question?.metadata as Record<string, unknown>)?.rightItems)
          ? ((question!.metadata as Record<string, unknown>).rightItems as Array<{ id: string; text: string }>)
          : [];
      return answer.matches
        .map((match) => {
          const right = rightItems.find((item) => item.id === match.rightId);
          return right?.text ?? match.rightId;
        })
        .join('; ');
    }
    return '';
  }

  private csvEscape(value: string): string {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }

  async exportSurveyCsv(organizationId: string, assessmentId: string, actor: AuthPrincipal) {
    const assessment = await assessmentRepository.getById(organizationId, assessmentId);
    if (!assessment) throw AppError.from('NOT_FOUND');
    if (assessment.kind !== 'SURVEY') {
      throw AppError.from('VALIDATION_ERROR', 'Survey export applies only to SURVEY assessments');
    }
    await courseService.assertCanWrite(organizationId, assessment.courseId, actor);

    const attempts = await assessmentRepository.listSurveyAttempts(assessmentId);
    const submitted = attempts.filter(
      (attempt) => attempt.gradingStatus === 'GRADED' || attempt.score !== null,
    );

    const questionHeaders =
      assessment.questions.length > 0
        ? assessment.questions.map((q) => ({ id: q.id, prompt: q.question }))
        : submitted.length && Array.isArray(submitted[0]!.questionSnapshot)
          ? (submitted[0]!.questionSnapshot as Record<string, unknown>[]).map((q) => ({
              id: String(q.id),
              prompt: String(q.question ?? 'Question'),
            }))
          : [];

    const headerRow = [
      'Submitted At',
      'Respondent',
      ...questionHeaders.map((q) => q.prompt),
    ]
      .map((cell) => this.csvEscape(cell))
      .join(',');

    const dataRows = submitted.map((attempt) => {
      const snapshot = Array.isArray(attempt.questionSnapshot)
        ? (attempt.questionSnapshot as Record<string, unknown>[])
        : [];
      const answers = Array.isArray(attempt.answers)
        ? (attempt.answers as Array<{
            questionId: string;
            optionId?: string;
            optionIds?: string[];
            text?: string;
            blanks?: Array<{ blankId: string; text: string }>;
            matches?: Array<{ leftId: string; rightId: string }>;
          }>)
        : [];
      const respondent = assessment.anonymous
        ? 'Anonymous'
        : `${attempt.user.firstName} ${attempt.user.lastName}`.trim() ||
          attempt.user.email ||
          attempt.user.id;
      const cells = [
        attempt.createdAt.toISOString(),
        respondent,
        ...questionHeaders.map((header) => {
          const question = snapshot.find((row) => String(row.id) === header.id);
          const answer = answers.find((row) => row.questionId === header.id);
          return this.formatSurveyAnswerCell(question, answer);
        }),
      ];
      return cells.map((cell) => this.csvEscape(cell)).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
  }

  async attempts(organizationId: string, assessmentId: string, actor: AuthPrincipal) {
    const assessment = await assessmentRepository.getById(organizationId, assessmentId);
    if (!assessment) throw AppError.from('NOT_FOUND');
    const userId = actor.sub;
    const rows = await assessmentRepository.listAttempts(assessmentId, userId);
    return rows
      .filter(
        (a) =>
          a.score !== null ||
          a.gradingStatus === 'PENDING_REVIEW' ||
          a.gradingStatus === 'GRADED' ||
          a.gradingStatus === 'EXPIRED',
      )
      .map(toAttemptDto);
  }

  async attemptReview(
    organizationId: string,
    assessmentId: string,
    attemptId: string,
    actor: AuthPrincipal,
  ) {
    const assessment = await assessmentRepository.getById(organizationId, assessmentId);
    if (!assessment) throw AppError.from('NOT_FOUND');
    await courseService.assertCanRead(organizationId, assessment.courseId, actor);

    const attempt = await assessmentRepository.getAttemptById(attemptId);
    if (!attempt || attempt.assessmentId !== assessmentId) {
      throw AppError.from('NOT_FOUND');
    }
    if (attempt.userId !== actor.sub && !this.canAuthorAssessment(actor)) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    if (!isReviewableAttempt(attempt)) {
      throw AppError.from('VALIDATION_ERROR', 'Attempt is not finished yet');
    }

    const org = await organizationRepository.findById(organizationId);
    const showAnswers = org ? parseSettings(org.settings).showAnswersAfterAttempt : false;

    return {
      assessment: {
        id: assessment.id,
        title: assessment.title,
        passingScore: assessment.passingScore,
        kind: assessment.kind,
      },
      attempt: toAttemptDto(attempt),
      showAnswers,
      items: buildAttemptReviewItems(attempt, showAnswers),
    };
  }

  pendingReview(organizationId: string, actor: AuthPrincipal) {
    const instructorId = actor.role === 'INSTRUCTOR' ? actor.sub : undefined;
    return assessmentRepository.listPendingReview(organizationId, instructorId).then((rows) =>
      rows.map((row) => {
        const questions = Array.isArray(row.questionSnapshot)
          ? (row.questionSnapshot as Record<string, unknown>[]).map((q) =>
              toQuestionDtoFromSnapshot(q, true),
            )
          : [];
        const answers = Array.isArray(row.answers)
          ? (row.answers as Array<{
              questionId: string;
              optionId?: string;
              optionIds?: string[];
              text?: string;
            }>)
          : [];
        return {
          id: row.id,
          score: row.score,
          passed: row.passed,
          attemptNumber: row.attemptNumber,
          gradingStatus: row.gradingStatus,
          submittedAt: row.createdAt.toISOString(),
          assessment: {
            id: row.assessment.id,
            title: row.assessment.title,
            courseId: row.assessment.courseId,
            passingScore: row.assessment.passingScore,
          },
          user: row.user,
          questions,
          answers,
        };
      }),
    );
  }
}

export const assessmentService = new AssessmentService();
