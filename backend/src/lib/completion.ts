import type { CompletionMode } from '@prisma/client';

export function computeEnrollmentProgress(
  mode: CompletionMode,
  completionPercent: number | null,
  lessons: Array<{ id: string; required: boolean }>,
  completedLessonIds: Set<string>,
): number {
  const total = lessons.length;
  if (total === 0) return 0;

  const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;

  if (mode === 'PERCENTAGE') {
    const target = Math.min(100, Math.max(1, completionPercent ?? 100));
    const requiredCompleted = Math.max(1, Math.ceil((target / 100) * total));
    return Math.min(100, Math.floor((completedCount / requiredCompleted) * 100));
  }

  const denominatorLessons =
    mode === 'REQUIRED_LESSONS' ? lessons.filter((lesson) => lesson.required) : lessons;
  const denom = denominatorLessons.length > 0 ? denominatorLessons.length : total;
  const numer = denominatorLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  return Math.floor((numer / denom) * 100);
}

export function isEnrollmentComplete(
  mode: CompletionMode,
  completionPercent: number | null,
  lessons: Array<{ id: string; required: boolean }>,
  completedLessonIds: Set<string>,
): boolean {
  return computeEnrollmentProgress(mode, completionPercent, lessons, completedLessonIds) >= 100;
}
