export type LessonLockInfo = {
  id: string;
  prerequisiteLessonId?: string | null;
};

export function isLessonUnlocked(
  lesson: LessonLockInfo,
  completedLessonIds: Set<string>,
): boolean {
  if (!lesson.prerequisiteLessonId) return true;
  return completedLessonIds.has(lesson.prerequisiteLessonId);
}

export function completedLessonIdsFromProgress(
  progress: Array<{ lessonId: string; completed: boolean }> | undefined,
): Set<string> {
  return new Set((progress ?? []).filter((entry) => entry.completed).map((entry) => entry.lessonId));
}
