import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from './prisma';
import { assertSingle } from './base.repository';

export class LessonRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient): LessonRepository {
    return new LessonRepository(tx);
  }

  getById(organizationId: string, id: string) {
    return this.db.lesson.findFirst({
      where: { id, organizationId },
      include: { moduleQuiz: { select: { id: true } } },
    });
  }

  listByCourse(organizationId: string, courseId: string) {
    return this.db.lesson.findMany({
      where: { organizationId, courseId },
      include: { moduleQuiz: { select: { id: true } } },
      orderBy: { orderIndex: 'asc' },
    });
  }

  countByCourse(organizationId: string, courseId: string) {
    return this.db.lesson.count({ where: { organizationId, courseId } });
  }

  create(organizationId: string, data: Prisma.LessonUncheckedCreateInput) {
    return this.db.lesson.create({ data: { ...data, organizationId } });
  }

  async update(organizationId: string, id: string, data: Prisma.LessonUncheckedUpdateManyInput) {
    const res = await this.db.lesson.updateMany({
      where: { id, organizationId },
      data,
    });
    assertSingle(res.count);
    return this.getById(organizationId, id);
  }

  async delete(organizationId: string, id: string) {
    const res = await this.db.lesson.deleteMany({ where: { id, organizationId } });
    assertSingle(res.count);
  }

  async rewriteOrder(organizationId: string, courseId: string, lessonIds: string[]) {
    await Promise.all(
      lessonIds.map((id, index) =>
        this.db.lesson.updateMany({
          where: { id, organizationId, courseId },
          data: { orderIndex: index },
        }),
      ),
    );
  }
}

export const lessonRepository = new LessonRepository();
