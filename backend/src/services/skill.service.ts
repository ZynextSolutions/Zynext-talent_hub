import { AppError } from '../errors/app-error';
import { skillRepository } from '../repositories/skill.repository';
import { roleRepository } from '../repositories/role.repository';

class SkillService {
  list(organizationId: string) {
    return skillRepository.list(organizationId).then((rows) =>
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        description: r.description,
        category: r.category,
        courseCount: r._count.courseSkills,
        roleCount: r._count.roleSkills,
      })),
    );
  }

  async create(organizationId: string, input: { name: string; description?: string; code?: string; category?: string }) {
    const row = await skillRepository.create(organizationId, input);
    return { id: row.id, name: row.name, code: row.code, description: row.description, category: row.category };
  }

  async update(organizationId: string, id: string, input: { name?: string; description?: string; code?: string; category?: string }) {
    const existing = await skillRepository.findById(organizationId, id);
    if (!existing) throw AppError.from('NOT_FOUND');
    await skillRepository.update(organizationId, id, input);
    return skillRepository.findById(organizationId, id);
  }

  async remove(organizationId: string, id: string) {
    const result = await skillRepository.delete(organizationId, id);
    if (result.count === 0) throw AppError.from('NOT_FOUND');
    return { deleted: true };
  }

  async setCourseSkills(organizationId: string, courseId: string, skillIds: Array<{ skillId: string; level?: number }>) {
    for (const s of skillIds) {
      const skill = await skillRepository.findById(organizationId, s.skillId);
      if (!skill) throw AppError.from('NOT_FOUND', `Skill ${s.skillId} not found`);
    }
    await skillRepository.setCourseSkills(
      courseId,
      skillIds.map((s) => ({ skillId: s.skillId, level: s.level ?? 1 })),
    );
    return skillRepository.listCourseSkills(courseId).then((rows) =>
      rows.map((r) => ({ skillId: r.skillId, level: r.level, name: r.skill.name })),
    );
  }

  listCourseSkills(courseId: string) {
    return skillRepository.listCourseSkills(courseId).then((rows) =>
      rows.map((r) => ({ skillId: r.skillId, level: r.level, name: r.skill.name })),
    );
  }

  async onCourseCompleted(organizationId: string, userId: string, courseId: string) {
    const skills = await skillRepository.listCourseSkills(courseId);
    if (!skills.length) return;
    await skillRepository.recordDemonstrations(
      organizationId,
      userId,
      courseId,
      skills.map((s) => ({ skillId: s.skillId, level: s.level })),
    );
  }

  listRoles(organizationId: string) {
    return roleRepository.listByOrganization(organizationId).then((rows) =>
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        isSystem: r.isSystem,
        userCount: r._count.users,
        skillCount: r._count.roleSkills,
      })),
    );
  }

  async setRoleSkills(organizationId: string, roleId: string, skills: Array<{ skillId: string; requiredLevel?: number }>) {
    const role = await roleRepository.findById(organizationId, roleId);
    if (!role) throw AppError.from('NOT_FOUND');
    for (const s of skills) {
      const skill = await skillRepository.findById(organizationId, s.skillId);
      if (!skill) throw AppError.from('NOT_FOUND', `Skill ${s.skillId} not found`);
    }
    await skillRepository.setRoleSkills(
      roleId,
      skills.map((s) => ({ skillId: s.skillId, requiredLevel: s.requiredLevel ?? 1 })),
    );
    return this.listRoleSkills(organizationId, roleId);
  }

  listRoleSkills(organizationId: string, roleId: string) {
    return roleRepository.findById(organizationId, roleId).then(async (role) => {
      if (!role) throw AppError.from('NOT_FOUND');
      const rows = await skillRepository.listRoleSkills(roleId);
      return rows.map((r) => ({
        skillId: r.skillId,
        requiredLevel: r.requiredLevel,
        name: r.skill.name,
        category: r.skill.category,
      }));
    });
  }

  analytics(organizationId: string, departmentId?: string) {
    return skillRepository.analytics(organizationId, departmentId);
  }
}

export const skillService = new SkillService();
