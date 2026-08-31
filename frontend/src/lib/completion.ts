import type { CompletionMode, Lesson } from "@/types";

export function isLessonRequired(lesson: Pick<Lesson, "required">): boolean {
  return lesson.required !== false;
}

export function countLessonCompletionStats(lessons: Pick<Lesson, "required">[]) {
  const required = lessons.filter(isLessonRequired).length;
  return {
    total: lessons.length,
    required,
    optional: lessons.length - required,
  };
}

export function completionRuleSummary(
  mode: CompletionMode | undefined,
  completionPercent: number | null | undefined,
  lessons: Pick<Lesson, "required">[],
  opts?: { hasFinalAssessment?: boolean },
): string {
  const { total, required, optional } = countLessonCompletionStats(lessons);
  const parts: string[] = [];

  if (!total) {
    parts.push("Add lessons to define completion");
  } else if (mode === "REQUIRED_LESSONS") {
    if (required > 0) {
      parts.push(`Complete ${required} required lesson${required === 1 ? "" : "s"}`);
    } else {
      parts.push("Mark lessons as required, or switch to another completion rule");
    }
    if (optional > 0) {
      parts.push(`${optional} optional lesson${optional === 1 ? "" : "s"} do not count`);
    }
  } else if (mode === "PERCENTAGE") {
    const pct = completionPercent ?? 100;
    const needed = Math.max(1, Math.ceil((pct / 100) * total));
    parts.push(`Complete at least ${needed} of ${total} lessons (${pct}%)`);
  } else {
    parts.push(`Complete all ${total} lesson${total === 1 ? "" : "s"}`);
  }

  if (opts?.hasFinalAssessment) {
    parts.push("pass the final assessment");
  }

  return `${parts.join("; ")}.`;
}

export function lessonsMeetCompletionRule(progressPercent: number | null | undefined): boolean {
  return (progressPercent ?? 0) >= 100;
}
