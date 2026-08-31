import type { Lesson, LessonProgress } from "@/types";

const VIDEO_WATCH_RATIO = 0.9;

export function learnerCanMarkComplete(
  lesson: Pick<Lesson, "kind" | "durationSeconds"> | undefined,
  progress: Pick<LessonProgress, "watchedSeconds" | "openedAt" | "completed"> | undefined,
): boolean {
  if (!lesson) return false;
  if (progress?.completed) return true;
  if (lesson.kind === "SCORM" || lesson.kind === "ILT" || lesson.kind === "VILT" || lesson.kind === "QUIZ") {
    return false;
  }
  if (lesson.kind === "VIDEO") {
    const duration = lesson.durationSeconds ?? 0;
    if (duration <= 0) return false;
    return (progress?.watchedSeconds ?? 0) >= Math.ceil(duration * VIDEO_WATCH_RATIO);
  }
  if (lesson.kind === "READING" || lesson.kind === "DOCUMENT" || lesson.kind === "DISCUSSION") {
    return Boolean(progress?.openedAt || progress);
  }
  return false;
}
