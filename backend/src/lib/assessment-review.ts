import type { AssessmentAttempt, QuestionType } from '@prisma/client';
import { gradeAnswer, isManualGradeType, snapshotToQuestionRow } from './assessment-questions';

type LearnerAnswer = {
  questionId: string;
  optionId?: string;
  optionIds?: string[];
  text?: string;
  blanks?: Array<{ blankId: string; text: string }>;
  matches?: Array<{ leftId: string; rightId: string }>;
};

export type AttemptReviewItem = {
  questionId: string;
  prompt: string;
  type: QuestionType;
  options: Array<{ id: string; text: string }>;
  metadata?: Record<string, unknown>;
  points?: number;
  explanation?: string;
  learnerAnswer: LearnerAnswer | null;
  correct: boolean | null;
  correctOptionId?: string;
  correctOptionIds?: string[];
  correctBlanks?: Record<string, string[]>;
  correctMatches?: Record<string, string>;
};

function parseOptions(raw: unknown): Array<{ id: string; text: string }> {
  return Array.isArray(raw) ? (raw as Array<{ id: string; text: string }>) : [];
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export function buildAttemptReviewItems(
  attempt: Pick<AssessmentAttempt, 'questionSnapshot' | 'answers'>,
  showAnswers: boolean,
): AttemptReviewItem[] {
  const snapshot = Array.isArray(attempt.questionSnapshot)
    ? (attempt.questionSnapshot as Record<string, unknown>[])
    : [];
  const answers = Array.isArray(attempt.answers) ? (attempt.answers as LearnerAnswer[]) : [];

  return snapshot.map((q) => {
    const learnerAnswer = answers.find((a) => a.questionId === String(q.id)) ?? null;
    const questionRow = snapshotToQuestionRow(q);
    const type = questionRow.type;
    const correct =
      isManualGradeType(type) && !showAnswers ? null : gradeAnswer(questionRow, learnerAnswer ?? {});

    return {
      questionId: String(q.id),
      prompt: String(q.prompt ?? q.question ?? ''),
      type,
      options: parseOptions(q.options),
      metadata: parseMetadata(q.metadata),
      points: questionRow.points,
      ...(typeof q.explanation === 'string' ? { explanation: q.explanation } : {}),
      learnerAnswer,
      correct,
      ...(showAnswers
        ? {
            ...(q.correctOptionId ? { correctOptionId: String(q.correctOptionId) } : {}),
            ...(Array.isArray(q.correctOptionIds)
              ? { correctOptionIds: q.correctOptionIds as string[] }
              : {}),
            ...(q.correctBlanks
              ? { correctBlanks: q.correctBlanks as Record<string, string[]> }
              : {}),
            ...(q.correctMatches
              ? { correctMatches: q.correctMatches as Record<string, string> }
              : {}),
          }
        : {}),
    };
  });
}

export function isReviewableAttempt(attempt: {
  score: number | null;
  gradingStatus: string;
}): boolean {
  if (attempt.score !== null) return true;
  return ['PENDING_REVIEW', 'GRADED', 'EXPIRED'].includes(attempt.gradingStatus);
}
