import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../lib/prisma';
import { AppError } from '../errors/app-error';

export class QuestionBankRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new QuestionBankRepository(tx);
  }

  list(organizationId: string) {
    return this.db.questionBank.findMany({
      where: { organizationId },
      include: { _count: { select: { questions: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  getById(organizationId: string, id: string) {
    return this.db.questionBank.findFirst({
      where: { id, organizationId },
      include: {
        questions: { orderBy: { createdAt: 'asc' } },
        _count: { select: { questions: true } },
      },
    });
  }

  create(data: Prisma.QuestionBankUncheckedCreateInput) {
    return this.db.questionBank.create({ data });
  }

  async update(organizationId: string, id: string, data: Prisma.QuestionBankUncheckedUpdateInput) {
    const row = await this.getById(organizationId, id);
    if (!row) throw AppError.from('NOT_FOUND');
    return this.db.questionBank.update({ where: { id }, data });
  }

  async delete(organizationId: string, id: string) {
    const inUse = await this.db.assessment.count({ where: { organizationId, bankId: id } });
    if (inUse > 0) {
      throw AppError.from('VALIDATION_ERROR', 'Question bank is referenced by one or more assessments');
    }
    const res = await this.db.questionBank.deleteMany({ where: { id, organizationId } });
    if (res.count !== 1) throw AppError.from('NOT_FOUND');
    return { id };
  }

  addQuestion(data: Prisma.BankQuestionUncheckedCreateInput) {
    return this.db.bankQuestion.create({ data });
  }

  async getQuestion(bankId: string, questionId: string) {
    return this.db.bankQuestion.findFirst({ where: { id: questionId, bankId } });
  }

  async updateQuestion(bankId: string, questionId: string, data: Prisma.BankQuestionUncheckedUpdateInput) {
    const row = await this.getQuestion(bankId, questionId);
    if (!row) throw AppError.from('NOT_FOUND');
    return this.db.bankQuestion.update({ where: { id: questionId }, data });
  }

  async deleteQuestion(bankId: string, questionId: string) {
    const res = await this.db.bankQuestion.deleteMany({ where: { id: questionId, bankId } });
    if (res.count !== 1) throw AppError.from('NOT_FOUND');
    return { id: questionId };
  }

  randomQuestions(bankId: string, count: number) {
    return this.db.bankQuestion.findMany({ where: { bankId }, take: count * 3 });
  }
}

export const questionBankRepository = new QuestionBankRepository();
