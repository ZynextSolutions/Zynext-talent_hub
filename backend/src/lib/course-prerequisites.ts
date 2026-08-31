import { AppError } from '../errors/app-error';
import { coursePrerequisiteRepository } from '../repositories/course-prerequisite.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { courseRepository } from '../repositories/course.repository';
import type { Lesson } from '@prisma/client';

export type CoursePrerequisiteSummary = {
  id: string;
  title: string;
};

export async function getUnmetCoursePrerequisites(
  organizationId: string,
  userId: string,
  courseId: string,
): Promise<CoursePrerequisiteSummary[]> {
  const rows = await coursePrerequisiteRepository.listByCourse(organizationId, courseId);
  if (!rows.length) return [];

  const unmet: CoursePrerequisiteSummary[] = [];
  for (const row of rows) {
    const enrollment = await enrollmentRepository.findByUserCourse(
      organizationId,
      userId,
      row.prerequisiteCourseId,
    );
    if (!enrollment || enrollment.status !== 'COMPLETED') {
      unmet.push({
        id: row.prerequisiteCourse.id,
        title: row.prerequisiteCourse.title,
      });
    }
  }
  return unmet;
}

export async function assertCoursePrerequisitesMet(
  organizationId: string,
  userId: string,
  courseId: string,
): Promise<void> {
  const unmet = await getUnmetCoursePrerequisites(organizationId, userId, courseId);
  if (unmet.length) {
    throw AppError.from('COURSE_PREREQUISITES_NOT_MET', undefined, {
      prerequisites: unmet,
    });
  }
}

export function coursePrerequisiteCreatesCycle(
  courseId: string,
  prerequisiteCourseId: string,
  edges: Array<{ courseId: string; prerequisiteCourseId: string }>,
): boolean {
  if (courseId === prerequisiteCourseId) return true;

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.courseId) ?? [];
    list.push(edge.prerequisiteCourseId);
    adjacency.set(edge.courseId, list);
  }
  const pending = adjacency.get(courseId) ?? [];
  adjacency.set(courseId, [...pending, prerequisiteCourseId]);

  const visited = new Set<string>();
  const stack = [prerequisiteCourseId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === courseId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }
  return false;
}

export async function validateCoursePrerequisiteIds(
  organizationId: string,
  courseId: string,
  prerequisiteCourseIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(prerequisiteCourseIds)];
  if (uniqueIds.includes(courseId)) {
    throw AppError.from('VALIDATION_ERROR', 'A course cannot require itself.');
  }

  for (const prerequisiteCourseId of uniqueIds) {
    const prereqCourse = await courseRepository.getById(organizationId, prerequisiteCourseId);
    if (!prereqCourse || prereqCourse.status === 'ARCHIVED') {
      throw AppError.from('VALIDATION_ERROR', 'Each prerequisite must be an existing course.');
    }
  }

  const existing = await coursePrerequisiteRepository.listPrerequisiteMap(organizationId);
  const withoutCurrent = existing.filter((row) => row.courseId !== courseId);
  for (const prerequisiteCourseId of uniqueIds) {
    if (coursePrerequisiteCreatesCycle(courseId, prerequisiteCourseId, withoutCurrent)) {
      throw AppError.from('VALIDATION_ERROR', 'Prerequisite would create a circular dependency.');
    }
  }
}

export function isLessonUnlocked(
  lesson: Pick<Lesson, 'id' | 'prerequisiteLessonId'>,
  completedLessonIds: Set<string>,
): boolean {
  if (!lesson.prerequisiteLessonId) return true;
  return completedLessonIds.has(lesson.prerequisiteLessonId);
}

export function assertLessonPrerequisiteMet(
  lesson: Pick<Lesson, 'id' | 'title' | 'prerequisiteLessonId'>,
  completedLessonIds: Set<string>,
): void {
  if (isLessonUnlocked(lesson, completedLessonIds)) return;
  throw AppError.from('LESSON_PREREQUISITE_NOT_MET', undefined, {
    lessonId: lesson.id,
    prerequisiteLessonId: lesson.prerequisiteLessonId,
  });
}

export function lessonPrerequisiteCreatesCycle(
  lessonId: string,
  prerequisiteLessonId: string,
  lessons: Array<{ id: string; prerequisiteLessonId: string | null }>,
): boolean {
  if (lessonId === prerequisiteLessonId) return true;

  const adjacency = new Map<string, string[]>();
  for (const lesson of lessons) {
    if (!lesson.prerequisiteLessonId) continue;
    const list = adjacency.get(lesson.id) ?? [];
    list.push(lesson.prerequisiteLessonId);
    adjacency.set(lesson.id, list);
  }
  const pending = adjacency.get(lessonId) ?? [];
  adjacency.set(lessonId, [...pending, prerequisiteLessonId]);

  const visited = new Set<string>();
  const stack = [prerequisiteLessonId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === lessonId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }
  return false;
}
