import { AppError } from '../errors/app-error';
import { toCourseModuleDto } from '../lib/mappers';
import { courseModuleRepository } from '../repositories/module.repository';
import { courseService } from './course.service';
import type { AuthPrincipal } from '../types/auth';

class CourseModuleService {
  async list(organizationId: string, courseId: string, actor: AuthPrincipal) {
    await courseService.assertCanRead(organizationId, courseId, actor);
    const rows = await courseModuleRepository.listByCourse(organizationId, courseId);
    return rows.map(toCourseModuleDto);
  }

  async create(
    organizationId: string,
    courseId: string,
    actor: AuthPrincipal,
    body: { title: string; description?: string | null },
  ) {
    await courseService.assertCanWrite(organizationId, courseId, actor);
    const existing = await courseModuleRepository.listByCourse(organizationId, courseId);
    const row = await courseModuleRepository.create({
      organizationId,
      courseId,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      orderIndex: existing.length,
    });
    return toCourseModuleDto((await courseModuleRepository.getById(organizationId, row.id))!);
  }

  async update(
    organizationId: string,
    courseId: string,
    id: string,
    actor: AuthPrincipal,
    body: { title?: string; description?: string | null },
  ) {
    await courseService.assertCanWrite(organizationId, courseId, actor);
    const current = await courseModuleRepository.getById(organizationId, id);
    if (!current || current.courseId !== courseId) throw AppError.from('NOT_FOUND');
    const row = await courseModuleRepository.update(organizationId, id, {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
    });
    return toCourseModuleDto(row!);
  }

  async remove(organizationId: string, courseId: string, id: string, actor: AuthPrincipal) {
    await courseService.assertCanWrite(organizationId, courseId, actor);
    const current = await courseModuleRepository.getById(organizationId, id);
    if (!current || current.courseId !== courseId) throw AppError.from('NOT_FOUND');
    if (current.lessons?.length) {
      throw AppError.from('VALIDATION_ERROR', 'Remove or move lessons before deleting this module.');
    }
    await courseModuleRepository.delete(organizationId, id);
    const remaining = await courseModuleRepository.listByCourse(organizationId, courseId);
    await courseModuleRepository.rewriteOrder(
      organizationId,
      courseId,
      remaining.map((m) => m.id),
    );
    return { id };
  }

  async reorder(organizationId: string, courseId: string, actor: AuthPrincipal, moduleIds: string[]) {
    await courseService.assertCanWrite(organizationId, courseId, actor);
    const existing = await courseModuleRepository.listByCourse(organizationId, courseId);
    const existingIds = existing.map((m) => m.id).sort();
    const incoming = [...moduleIds].sort();
    if (existingIds.length !== incoming.length || existingIds.some((id, i) => id !== incoming[i])) {
      throw AppError.from('VALIDATION_ERROR', 'moduleIds must be a permutation of all modules.');
    }
    await courseModuleRepository.rewriteOrder(organizationId, courseId, moduleIds);
    const rows = await courseModuleRepository.listByCourse(organizationId, courseId);
    return rows.map(toCourseModuleDto);
  }
}

export const courseModuleService = new CourseModuleService();
