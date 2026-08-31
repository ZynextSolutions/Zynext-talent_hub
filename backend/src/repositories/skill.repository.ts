import { prisma } from '../lib/prisma';

export class SkillRepository {
  list(organizationId: string) {
    return prisma.skill.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { courseSkills: true, roleSkills: true } } },
    });
  }

  findById(organizationId: string, id: string) {
    return prisma.skill.findFirst({ where: { id, organizationId } });
  }

  create(organizationId: string, data: { name: string; description?: string; code?: string; category?: string }) {
    return prisma.skill.create({
      data: { organizationId, ...data, description: data.description ?? '' },
    });
  }

  update(organizationId: string, id: string, data: { name?: string; description?: string; code?: string; category?: string }) {
    return prisma.skill.updateMany({ where: { id, organizationId }, data });
  }

  delete(organizationId: string, id: string) {
    return prisma.skill.deleteMany({ where: { id, organizationId } });
  }

  setCourseSkills(courseId: string, skills: Array<{ skillId: string; level: number }>) {
    return prisma.$transaction([
      prisma.courseSkill.deleteMany({ where: { courseId } }),
      ...(skills.length
        ? [
            prisma.courseSkill.createMany({
              data: skills.map((s) => ({ courseId, skillId: s.skillId, level: s.level })),
            }),
          ]
        : []),
    ]);
  }

  listCourseSkills(courseId: string) {
    return prisma.courseSkill.findMany({
      where: { courseId },
      include: { skill: true },
    });
  }

  setRoleSkills(roleId: string, skills: Array<{ skillId: string; requiredLevel: number }>) {
    return prisma.$transaction([
      prisma.roleSkill.deleteMany({ where: { roleId } }),
      ...(skills.length
        ? [
            prisma.roleSkill.createMany({
              data: skills.map((s) => ({ roleId, skillId: s.skillId, requiredLevel: s.requiredLevel })),
            }),
          ]
        : []),
    ]);
  }

  listRoleSkills(roleId: string) {
    return prisma.roleSkill.findMany({
      where: { roleId },
      include: { skill: true },
      orderBy: { skill: { name: 'asc' } },
    });
  }

  recordDemonstrations(
    organizationId: string,
    userId: string,
    courseId: string,
    skills: Array<{ skillId: string; level: number }>,
  ) {
    return Promise.all(
      skills.map((s) =>
        prisma.userSkillDemonstration.upsert({
          where: { userId_skillId: { userId, skillId: s.skillId } },
          create: {
            organizationId,
            userId,
            skillId: s.skillId,
            level: s.level,
            sourceCourseId: courseId,
          },
          update: {
            level: s.level,
            sourceCourseId: courseId,
            demonstratedAt: new Date(),
          },
        }),
      ),
    );
  }

  async analytics(organizationId: string, departmentId?: string) {
    const userWhere = departmentId ? { organizationId, departmentId, deletedAt: null } : { organizationId, deletedAt: null };
    const [skills, demonstrations, roleSkills] = await Promise.all([
      prisma.skill.findMany({ where: { organizationId }, orderBy: { name: 'asc' } }),
      prisma.userSkillDemonstration.findMany({
        where: { organizationId, user: userWhere },
        include: { skill: true, user: { select: { id: true, firstName: true, lastName: true, roleId: true } } },
      }),
      prisma.roleSkill.findMany({
        where: { skill: { organizationId } },
        include: { skill: true, role: true },
      }),
    ]);

    const users = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, roleId: true },
    });

    const gaps = skills.map((skill) => {
      const requiredByRole = roleSkills.filter((rs) => rs.skillId === skill.id);
      let requiredCount = 0;
      let coveredCount = 0;
      for (const user of users) {
        const req = requiredByRole.find((r) => r.roleId === user.roleId);
        if (!req) continue;
        requiredCount += 1;
        const demo = demonstrations.find((d) => d.userId === user.id && d.skillId === skill.id);
        if (demo && demo.level >= req.requiredLevel) coveredCount += 1;
      }
      return {
        skillId: skill.id,
        skillName: skill.name,
        category: skill.category,
        demonstratedCount: demonstrations.filter((d) => d.skillId === skill.id).length,
        requiredCount,
        coveredCount,
        gapCount: Math.max(0, requiredCount - coveredCount),
      };
    });

    return {
      kpis: {
        skillCount: skills.length,
        demonstratedCount: demonstrations.length,
        gapCount: gaps.reduce((s, g) => s + g.gapCount, 0),
      },
      skills: gaps,
    };
  }
}

export const skillRepository = new SkillRepository();
