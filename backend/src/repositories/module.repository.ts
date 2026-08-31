import type { Prisma } from '@prisma/client';
import { prisma, type DbClient } from './prisma';
import { assertSingle } from './base.repository';

export class CourseModuleRepository {
  constructor(private db: DbClient = prisma) {}

  withTx(tx: Prisma.TransactionClient) {
    return new CourseModuleRepository(tx);
  }

  getById(organizationId: string, id: string) {
    return this.db.courseModule.findFirst({
      where: { id, organizationId },
      include: { lessons: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  listByCourse(organizationId: string, courseId: string) {
    return this.db.courseModule.findMany({
      where: { organizationId, courseId },
      orderBy: { orderIndex: 'asc' },
      include: { lessons: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  create(data: Prisma.CourseModuleUncheckedCreateInput) {
    return this.db.courseModule.create({ data });
  }

  async update(organizationId: string, id: string, data: Prisma.CourseModuleUncheckedUpdateManyInput) {
    const res = await this.db.courseModule.updateMany({
      where: { id, organizationId },
      data,
    });
    assertSingle(res.count);
    return this.getById(organizationId, id);
  }

  async delete(organizationId: string, id: string) {
    const res = await this.db.courseModule.deleteMany({ where: { id, organizationId } });
    assertSingle(res.count);
  }

  async rewriteOrder(organizationId: string, courseId: string, moduleIds: string[]) {
    await Promise.all(
      moduleIds.map((id, index) =>
        this.db.courseModule.updateMany({
          where: { id, organizationId, courseId },
          data: { orderIndex: index },
        }),
      ),
    );
  }
}

export const courseModuleRepository = new CourseModuleRepository();
