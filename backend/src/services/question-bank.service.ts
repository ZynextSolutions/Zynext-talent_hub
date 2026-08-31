import type { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { questionBankRepository } from '../repositories/question-bank.repository';
import { toBankQuestionDto, toQuestionBankDto } from '../lib/mappers';
import { buildQuestionData, type QuestionInput } from '../lib/assessment-questions';

function parseOptionTexts(raw: unknown): string[] {
  return Array.isArray(raw) ? (raw as Array<{ text: string }>).map((o) => o.text) : [];
}

function bankRowToInput(row: {
  question: string;
  type: QuestionInput['type'];
  options: unknown;
  correctOptionId: string | null;
  correctOptionIds: unknown;
  metadata: unknown;
  tags: string[];
  points: number;
  explanation: string | null;
  difficulty: string | null;
}): QuestionInput {
  const options = parseOptionTexts(row.options);
  let correctOptionIndex = 0;
  let correctOptionIndices: number[] = [];
  if (row.type === 'MULTI_SELECT' && Array.isArray(row.correctOptionIds)) {
    const ids = row.correctOptionIds as string[];
    correctOptionIndices = options
      .map((_, i) => {
        const optionId = (row.options as Array<{ id: string; text: string }>)[i]?.id;
        return optionId && ids.includes(optionId) ? i : -1;
      })
      .filter((i) => i >= 0);
  } else if (row.correctOptionId) {
    correctOptionIndex = Math.max(
      0,
      (row.options as Array<{ id: string }>).findIndex((o) => o.id === row.correctOptionId),
    );
  }
  const metadata = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {};
  return {
    question: row.question,
    type: row.type,
    options,
    correctOptionIndex,
    correctOptionIndices,
    tags: row.tags,
    points: row.points,
    explanation: row.explanation ?? undefined,
    difficulty: row.difficulty ?? undefined,
    blanks: Array.isArray(metadata.blanks)
      ? (metadata.blanks as Array<{ acceptableAnswers: string[] }>)
      : undefined,
    pairs: Array.isArray(metadata.pairs)
      ? (metadata.pairs as Array<{ left: string; right: string }>)
      : undefined,
    minWords: typeof metadata.minWords === 'number' ? metadata.minWords : undefined,
    maxWords: typeof metadata.maxWords === 'number' ? metadata.maxWords : undefined,
  };
}

function toQuestionInput(body: Record<string, unknown>): QuestionInput {
  const input: QuestionInput = {};
  if (typeof body.prompt === 'string') input.prompt = body.prompt;
  if (typeof body.question === 'string') input.question = body.question;
  if (body.type) input.type = body.type as QuestionInput['type'];
  if (Array.isArray(body.options)) input.options = body.options as string[];
  if (typeof body.correctOptionIndex === 'number') input.correctOptionIndex = body.correctOptionIndex;
  if (Array.isArray(body.correctOptionIndices)) input.correctOptionIndices = body.correctOptionIndices as number[];
  if (Array.isArray(body.tags)) input.tags = body.tags as string[];
  if (typeof body.points === 'number') input.points = body.points;
  if (typeof body.explanation === 'string') input.explanation = body.explanation;
  if (typeof body.difficulty === 'string') input.difficulty = body.difficulty;
  if (Array.isArray(body.blanks)) input.blanks = body.blanks as Array<{ acceptableAnswers: string[] }>;
  if (Array.isArray(body.pairs)) input.pairs = body.pairs as Array<{ left: string; right: string }>;
  if (typeof body.minWords === 'number') input.minWords = body.minWords;
  if (typeof body.maxWords === 'number') input.maxWords = body.maxWords;
  return input;
}

class QuestionBankService {
  list(organizationId: string) {
    return questionBankRepository.list(organizationId).then((rows) =>
      rows.map((r) => toQuestionBankDto(r, r._count.questions)),
    );
  }

  async get(organizationId: string, id: string, includeAnswers: boolean) {
    const row = await questionBankRepository.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    return {
      ...toQuestionBankDto(row, row._count.questions),
      questions: row.questions.map((q) => toBankQuestionDto(q, includeAnswers)),
    };
  }

  create(organizationId: string, body: { name: string; description?: string }) {
    return questionBankRepository
      .create({ organizationId, name: body.name, description: body.description ?? '' })
      .then((r) => toQuestionBankDto(r, 0));
  }

  async update(organizationId: string, id: string, body: { name?: string; description?: string }) {
    const row = await questionBankRepository.update(organizationId, id, body);
    return toQuestionBankDto(row, 0);
  }

  remove(organizationId: string, id: string) {
    return questionBankRepository.delete(organizationId, id);
  }

  async addQuestion(organizationId: string, bankId: string, input: Record<string, unknown>) {
    const bank = await questionBankRepository.getById(organizationId, bankId);
    if (!bank) throw AppError.from('NOT_FOUND');
    const data = buildQuestionData(toQuestionInput(input));
    const row = await questionBankRepository.addQuestion({
      bankId,
      question: data.question,
      type: data.type,
      options: data.options,
      correctOptionId: data.correctOptionId,
      correctOptionIds: data.correctOptionIds ?? undefined,
      points: data.points,
      explanation: data.explanation,
      difficulty: data.difficulty,
      metadata: data.metadata as Prisma.InputJsonValue,
      tags: data.tags,
    });
    return toBankQuestionDto(row, true);
  }

  async updateQuestion(
    organizationId: string,
    bankId: string,
    questionId: string,
    input: Record<string, unknown>,
  ) {
    const bank = await questionBankRepository.getById(organizationId, bankId);
    if (!bank) throw AppError.from('NOT_FOUND');
    const existing = await questionBankRepository.getQuestion(bankId, questionId);
    if (!existing) throw AppError.from('NOT_FOUND');

    const merged = {
      ...bankRowToInput(existing),
      ...toQuestionInput(input),
    };
    const data = buildQuestionData(merged);
    const row = await questionBankRepository.updateQuestion(bankId, questionId, {
      question: data.question,
      type: data.type,
      options: data.options,
      correctOptionId: data.correctOptionId,
      correctOptionIds: data.correctOptionIds ?? undefined,
      points: data.points,
      explanation: data.explanation,
      difficulty: data.difficulty,
      metadata: data.metadata as Prisma.InputJsonValue,
      ...(Array.isArray(input.tags) ? { tags: input.tags as string[] } : {}),
    });
    return toBankQuestionDto(row, true);
  }

  async removeQuestion(organizationId: string, bankId: string, questionId: string) {
    const bank = await questionBankRepository.getById(organizationId, bankId);
    if (!bank) throw AppError.from('NOT_FOUND');
    return questionBankRepository.deleteQuestion(bankId, questionId);
  }
}

export const questionBankService = new QuestionBankService();
