import { randomInt, randomUUID } from 'node:crypto';
import { AppError } from '../errors/app-error';
import type { QuestionType } from '@prisma/client';

export type BlankInput = { acceptableAnswers: string[] };
export type PairInput = { left: string; right: string };

export type QuestionInput = {
  prompt?: string;
  question?: string;
  type?: QuestionType;
  options?: string[];
  correctOptionIndex?: number;
  correctOptionIndices?: number[];
  tags?: string[];
  points?: number;
  explanation?: string;
  difficulty?: string;
  blanks?: BlankInput[];
  pairs?: PairInput[];
  minWords?: number;
  maxWords?: number;
};

export type LearnerAnswer = {
  optionId?: string;
  optionIds?: string[];
  text?: string;
  blanks?: Array<{ blankId: string; text: string }>;
  matches?: Array<{ leftId: string; rightId: string }>;
};

export type QuestionRow = {
  id: string;
  type: QuestionType;
  points?: number;
  correctOptionId?: string | null;
  correctOptionIds?: unknown;
  correctBlanks?: Record<string, string[]>;
  correctMatches?: Record<string, string>;
};

export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export function parseBlanks(metadata: unknown): Array<{ id: string; acceptableAnswers: string[] }> {
  const obj = parseMetadata(metadata);
  const blanks = Array.isArray(obj.blanks) ? obj.blanks : [];
  return blanks
    .map((b) => {
      if (!b || typeof b !== 'object') return null;
      const row = b as Record<string, unknown>;
      const acceptableAnswers = Array.isArray(row.acceptableAnswers)
        ? row.acceptableAnswers.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
        : [];
      if (!acceptableAnswers.length) return null;
      return {
        id: typeof row.id === 'string' ? row.id : randomUUID(),
        acceptableAnswers,
      };
    })
    .filter(Boolean) as Array<{ id: string; acceptableAnswers: string[] }>;
}

export function parseMatchingPairs(metadata: unknown): Array<{ id: string; left: string; right: string }> {
  const obj = parseMetadata(metadata);
  const pairs = Array.isArray(obj.pairs) ? obj.pairs : [];
  return pairs
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const row = p as Record<string, unknown>;
      const left = typeof row.left === 'string' ? row.left.trim() : '';
      const right = typeof row.right === 'string' ? row.right.trim() : '';
      if (!left || !right) return null;
      return {
        id: typeof row.id === 'string' ? row.id : randomUUID(),
        left,
        right,
      };
    })
    .filter(Boolean) as Array<{ id: string; left: string; right: string }>;
}

export function buildQuestionData(input: QuestionInput) {
  const type = input.type ?? 'MCQ';
  const text = input.prompt ?? input.question ?? '';
  const points = input.points ?? 1;
  const explanation = input.explanation?.trim() || null;
  const difficulty = input.difficulty?.trim() || null;
  let options: Array<{ id: string; text: string }> = [];
  let correctOptionId: string | null = null;
  let correctOptionIds: string[] | null = null;
  let metadata: Record<string, unknown> = {};

  if (type === 'TRUE_FALSE') {
    options = [
      { id: randomUUID(), text: 'True' },
      { id: randomUUID(), text: 'False' },
    ];
    const idx = input.correctOptionIndex ?? 0;
    correctOptionId = options[idx]?.id ?? options[0]!.id;
  } else if (type === 'SHORT_ANSWER' || type === 'ESSAY') {
    options = [];
    if (type === 'ESSAY') {
      metadata = {
        ...(input.minWords != null ? { minWords: input.minWords } : {}),
        ...(input.maxWords != null ? { maxWords: input.maxWords } : {}),
      };
    }
  } else if (type === 'FILL_BLANK') {
    const blanks = (input.blanks ?? [])
      .map((b) => ({
        id: randomUUID(),
        acceptableAnswers: b.acceptableAnswers.map((a) => a.trim()).filter(Boolean),
      }))
      .filter((b) => b.acceptableAnswers.length > 0);
    if (!blanks.length) {
      throw AppError.from('VALIDATION_ERROR', 'At least one blank with acceptable answers is required');
    }
    metadata = { blanks };
    options = [];
  } else if (type === 'MATCHING') {
    const pairs = (input.pairs ?? [])
      .map((p) => ({
        id: randomUUID(),
        left: p.left.trim(),
        right: p.right.trim(),
      }))
      .filter((p) => p.left && p.right);
    if (pairs.length < 2) {
      throw AppError.from('VALIDATION_ERROR', 'At least two matching pairs are required');
    }
    metadata = { pairs };
    options = [];
  } else {
    const texts = input.options ?? [];
    if (texts.length < 2) throw AppError.from('VALIDATION_ERROR', 'At least two options required');
    options = texts.map((t) => ({ id: randomUUID(), text: t }));
    if (type === 'MULTI_SELECT') {
      const indices = input.correctOptionIndices ?? [];
      correctOptionIds = indices.map((i) => options[i]?.id).filter(Boolean) as string[];
      if (!correctOptionIds.length) {
        throw AppError.from('VALIDATION_ERROR', 'correctOptionIndices required for multi-select');
      }
    } else {
      const idx = input.correctOptionIndex ?? 0;
      correctOptionId = options[idx]?.id ?? null;
      if (!correctOptionId) throw AppError.from('VALIDATION_ERROR', 'correctOptionIndex out of range');
    }
  }

  return {
    question: text,
    type,
    options,
    correctOptionId,
    correctOptionIds,
    tags: input.tags ?? [],
    points,
    explanation,
    difficulty,
    metadata,
  };
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function parseOptionList(raw: unknown): Array<{ id: string; text: string }> {
  return Array.isArray(raw) ? (raw as Array<{ id: string; text: string }>) : [];
}

function learnerMetadata(type: QuestionType, metadata: unknown) {
  const obj = parseMetadata(metadata);
  if (type === 'FILL_BLANK') {
    const blanks = parseBlanks(metadata).map((b) => ({ id: b.id }));
    return { blanks };
  }
  if (type === 'MATCHING') {
    const leftItems = Array.isArray(obj.leftItems) ? obj.leftItems : [];
    const rightItems = Array.isArray(obj.rightItems) ? obj.rightItems : [];
    return { leftItems, rightItems };
  }
  if (type === 'ESSAY') {
    return {
      ...(typeof obj.minWords === 'number' ? { minWords: obj.minWords } : {}),
      ...(typeof obj.maxWords === 'number' ? { maxWords: obj.maxWords } : {}),
    };
  }
  return {};
}

export function questionToSnapshot(q: {
  id: string;
  question: string;
  type: QuestionType;
  options: unknown;
  correctOptionId?: string | null;
  correctOptionIds?: unknown;
  orderIndex: number;
  points?: number;
  explanation?: string | null;
  metadata?: unknown;
}) {
  const points = q.points ?? 1;
  const base = {
    id: q.id,
    prompt: q.question,
    question: q.question,
    type: q.type,
    orderIndex: q.orderIndex,
    order: q.orderIndex,
    points,
    ...(q.explanation ? { explanation: q.explanation } : {}),
  };

  if (q.type === 'FILL_BLANK') {
    const blanks = parseBlanks(q.metadata);
    const correctBlanks = Object.fromEntries(
      blanks.map((b) => [b.id, b.acceptableAnswers.map(normalizeText)]),
    );
    return {
      ...base,
      options: [],
      metadata: { blanks: blanks.map((b) => ({ id: b.id })) },
      correctBlanks,
    };
  }

  if (q.type === 'MATCHING') {
    const pairs = parseMatchingPairs(q.metadata);
    const rightItems = shuffle(
      pairs.map((p) => ({ id: randomUUID(), pairId: p.id, text: p.right })),
    );
    const correctMatches = Object.fromEntries(
      pairs.map((p) => [p.id, rightItems.find((r) => r.pairId === p.id)!.id]),
    );
    return {
      ...base,
      options: [],
      metadata: {
        leftItems: pairs.map((p) => ({ id: p.id, text: p.left })),
        rightItems: rightItems.map(({ id, text }) => ({ id, text })),
      },
      correctMatches,
    };
  }

  if (q.type === 'SHORT_ANSWER' || q.type === 'ESSAY') {
    return {
      ...base,
      options: [],
      metadata: learnerMetadata(q.type, q.metadata),
    };
  }

  return {
    ...base,
    options: q.options,
    correctOptionId: q.correctOptionId,
    correctOptionIds: q.correctOptionIds,
    metadata: {},
  };
}

/** Snapshot for an attempt — shuffles MCQ/T/F/multi-select option order per learner. */
export function questionToAttemptSnapshot(q: {
  id: string;
  question: string;
  type: QuestionType;
  options: unknown;
  correctOptionId?: string | null;
  correctOptionIds?: unknown;
  orderIndex: number;
  points?: number;
  explanation?: string | null;
  metadata?: unknown;
}) {
  const snapshot = questionToSnapshot(q);
  if (q.type === 'MCQ' || q.type === 'TRUE_FALSE' || q.type === 'MULTI_SELECT') {
    return {
      ...snapshot,
      options: shuffle(parseOptionList(q.options)),
    };
  }
  return snapshot;
}

export function gradeAnswer(question: QuestionRow, answer: LearnerAnswer): boolean | null {
  if (question.type === 'SHORT_ANSWER' || question.type === 'ESSAY') return null;

  if (question.type === 'FILL_BLANK') {
    const expected = question.correctBlanks ?? {};
    const given = Object.fromEntries(
      (answer.blanks ?? []).map((b) => [b.blankId, normalizeText(b.text ?? '')]),
    );
    const keys = Object.keys(expected);
    if (!keys.length) return false;
    return keys.every((id) => {
      const normalized = given[id] ?? '';
      return expected[id]?.includes(normalized) ?? false;
    });
  }

  if (question.type === 'MATCHING') {
    const expected = question.correctMatches ?? {};
    const given = Object.fromEntries((answer.matches ?? []).map((m) => [m.leftId, m.rightId]));
    const keys = Object.keys(expected);
    if (!keys.length) return false;
    return keys.every((id) => given[id] === expected[id]);
  }

  if (question.type === 'MULTI_SELECT') {
    const expected = Array.isArray(question.correctOptionIds)
      ? (question.correctOptionIds as string[]).slice().sort()
      : [];
    const given = (answer.optionIds ?? []).slice().sort();
    return expected.length === given.length && expected.every((id, i) => id === given[i]);
  }

  return Boolean(answer.optionId && answer.optionId === question.correctOptionId);
}

export function isManualGradeType(type: QuestionType): boolean {
  return type === 'SHORT_ANSWER' || type === 'ESSAY';
}

export function computeAttemptScore(
  questions: QuestionRow[],
  answers: Array<{ questionId: string } & LearnerAnswer>,
): { score: number | null; pendingReview: number; earnedPoints: number; totalPoints: number } {
  let earnedPoints = 0;
  let totalPoints = 0;
  let pendingReview = 0;

  for (const q of questions) {
    const points = q.points ?? 1;
    if (isManualGradeType(q.type)) {
      pendingReview += 1;
      continue;
    }
    totalPoints += points;
    const ans = answers.find((a) => a.questionId === q.id);
    if (gradeAnswer(q, ans ?? {}) === true) earnedPoints += points;
  }

  const score =
    totalPoints === 0 && pendingReview > 0
      ? null
      : totalPoints === 0
        ? 0
        : Math.round((earnedPoints / totalPoints) * 100);

  return { score, pendingReview, earnedPoints, totalPoints };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function validateEssayAnswer(metadata: unknown, text: string) {
  const obj = parseMetadata(metadata);
  const words = countWords(text);
  if (typeof obj.minWords === 'number' && words < obj.minWords) {
    throw AppError.from('VALIDATION_ERROR', `Essay must be at least ${obj.minWords} words`);
  }
  if (typeof obj.maxWords === 'number' && words > obj.maxWords) {
    throw AppError.from('VALIDATION_ERROR', `Essay must be at most ${obj.maxWords} words`);
  }
}

export function snapshotToQuestionRow(snapshot: Record<string, unknown>): QuestionRow {
  return {
    id: String(snapshot.id),
    type: snapshot.type as QuestionType,
    points: typeof snapshot.points === 'number' ? snapshot.points : 1,
    correctOptionId: snapshot.correctOptionId as string | null | undefined,
    correctOptionIds: snapshot.correctOptionIds,
    correctBlanks: snapshot.correctBlanks as Record<string, string[]> | undefined,
    correctMatches: snapshot.correctMatches as Record<string, string> | undefined,
  };
}

export function sanitizeSnapshotForLearner(snapshot: Record<string, unknown>) {
  const { correctBlanks, correctMatches, correctOptionId, correctOptionIds, ...rest } = snapshot;
  void correctBlanks;
  void correctMatches;
  void correctOptionId;
  void correctOptionIds;
  return rest;
}
