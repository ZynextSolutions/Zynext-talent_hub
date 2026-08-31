import type { CourseDetail, CourseModule, Lesson, LessonKind } from "@/types";

export type OutlineSection = {
  id: string | null;
  title: string;
  description?: string | null;
  lessons: Lesson[];
};

export const LESSON_TYPES: Array<{
  id: LessonKind;
  label: string;
  description: string;
  defaultTitle: string;
}> = [
  { id: "VIDEO", label: "Video", description: "Watch a lecture or clip", defaultTitle: "New video" },
  { id: "READING", label: "Reading", description: "Article or written lesson", defaultTitle: "New reading" },
  { id: "DOCUMENT", label: "Document", description: "PDF, slides, or file link", defaultTitle: "New document" },
  { id: "QUIZ", label: "Knowledge check", description: "Practice questions or prompt", defaultTitle: "Knowledge check" },
  { id: "DISCUSSION", label: "Discussion", description: "Reflection or team prompt", defaultTitle: "Discussion prompt" },
  { id: "ILT", label: "Instructor-led", description: "In-person classroom session", defaultTitle: "ILT session" },
  { id: "VILT", label: "Virtual ILT", description: "Live online instructor session", defaultTitle: "Virtual session" },
  { id: "SCORM", label: "SCORM", description: "Imported SCORM 1.2 package", defaultTitle: "SCORM module" },
];

export function lessonKind(lesson: Pick<Lesson, "kind" | "videoUrl" | "resourceUrl" | "content">): LessonKind {
  if (lesson.kind) return lesson.kind;
  if (lesson.videoUrl) return "VIDEO";
  if (lesson.resourceUrl) return "DOCUMENT";
  return "READING";
}

export function lessonTypeLabel(kind: LessonKind): string {
  return LESSON_TYPES.find((item) => item.id === kind)?.label ?? kind;
}

export function formatLessonDuration(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function courseOutline(
  course: CourseDetail | undefined | null,
  opts?: { includeEmptyUncategorized?: boolean },
): OutlineSection[] {
  if (!course) return [];
  const modules = (course.modules ?? []).slice().sort((a, b) => a.order - b.order);
  const lessons = (course.lessons ?? []).slice().sort((a, b) => a.order - b.order);
  const nestedIds = new Set(modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));

  const sections: OutlineSection[] = modules.map((module) => ({
    id: module.id,
    title: module.title,
    description: module.description,
    lessons: (module.lessons.length
      ? module.lessons
      : lessons.filter((lesson) => lesson.moduleId === module.id)
    )
      .slice()
      .sort((a, b) => a.order - b.order),
  }));

  const ungrouped = lessons.filter((lesson) => !lesson.moduleId && !nestedIds.has(lesson.id));
  if (ungrouped.length || opts?.includeEmptyUncategorized) {
    sections.push({ id: null, title: "Uncategorized", lessons: ungrouped });
  }
  if (!sections.length && lessons.length) {
    return [{ id: null, title: "Course content", lessons }];
  }
  return sections;
}

export function nextWeekTitle(modules: CourseModule[] | undefined): string {
  return `Week ${(modules?.length ?? 0) + 1}`;
}
