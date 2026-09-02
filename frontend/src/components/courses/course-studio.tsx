"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ClipboardCheck,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Play,
  Plus,
  Send,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { AssessmentSection } from "@/components/courses/create-assessment-dialog";
import { AssignCourseDialog } from "@/components/courses/assign-course-dialog";
import { CourseAssignmentsPanel } from "@/components/courses/course-assignments-panel";
import { CourseRevisionPanel } from "@/components/courses/course-revision-panel";
import { CourseSessionsPanel } from "@/components/courses/course-sessions-panel";
import { CourseSkillsPanel } from "@/components/courses/course-skills-panel";
import { StudioLessonEditor } from "@/components/courses/studio-lesson-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  majorToMinor,
  minorToMajor,
  parseTrainingCurrency,
  resolveDefaultTrainingCostMinor,
  type TrainingCurrency,
} from "@/lib/money";
import {
  useArchiveCourse,
  useCourse,
  useCreateLesson,
  useCreateModule,
  useDeleteCourse,
  useDeleteModule,
  useDuplicateCourse,
  usePublishCourse,
  useReorderLessons,
  useReorderModules,
  useUnarchiveCourse,
  useCourses,
  useUpdateCourse,
  useUpdateCoursePrerequisites,
  useUpdateModule,
  useUploadCourseThumbnail,
  useUploadCourseIntroVideo,
  useUploadScormPackage,
} from "@/hooks/useCourses";
import { ImageUploadField } from "@/components/certificates/image-upload-field";
import { LessonFileField } from "@/components/courses/lesson-file-field";
import { LessonVideoPlayer } from "@/components/courses/lesson-video-player";
import { ScormUploadField } from "@/components/courses/scorm-upload-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompletionMode } from "@/types";
import { cn } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/certificate-template";
import {
  completionRuleSummary,
  countLessonCompletionStats,
} from "@/lib/completion";
import {
  courseOutline,
  formatLessonDuration,
  LESSON_TYPES,
  lessonKind,
  lessonTypeLabel,
  nextWeekTitle,
} from "@/lib/course-outline";
import type { LessonKind } from "@/types";

function LessonTypeIcon({ kind }: { kind: LessonKind }) {
  const className = "mt-0.5 h-3.5 w-3.5 shrink-0";
  if (kind === "VIDEO") return <Video className={className} />;
  if (kind === "DOCUMENT") return <Paperclip className={className} />;
  if (kind === "QUIZ") return <ClipboardCheck className={className} />;
  if (kind === "DISCUSSION") return <MessageSquare className={className} />;
  if (kind === "ILT") return <Users className={className} />;
  if (kind === "VILT") return <Video className={className} />;
  return <FileText className={className} />;
}

interface CourseStudioProps {
  courseId: string;
}

export function CourseStudio({ courseId }: CourseStudioProps) {
  const router = useRouter();
  const { hasPermission, user, organization } = useAuth();
  const trainingCurrency = parseTrainingCurrency(organization?.settings?.trainingCurrency);
  const { data: course, isLoading } = useCourse(courseId);
  const canAssign = hasPermission("course:assign");
  const isOrgAdmin = user?.role === "ORG_ADMIN";
  const canWrite =
    hasPermission("course:write") &&
    (user?.role !== "INSTRUCTOR" || Boolean(course && course.createdByUserId === user.id));
  const canEdit = canWrite && course?.status !== "ARCHIVED";
  const canManageSkills = hasPermission("skills:read");

  const publish = usePublishCourse();
  const archive = useArchiveCourse();
  const unarchive = useUnarchiveCourse();
  const uploadThumbnail = useUploadCourseThumbnail(courseId);
  const uploadIntroVideo = useUploadCourseIntroVideo(courseId);
  const uploadScorm = useUploadScormPackage(courseId);
  const duplicate = useDuplicateCourse();
  const deleteCourse = useDeleteCourse();
  const createModule = useCreateModule(courseId);
  const updateModule = useUpdateModule(courseId);
  const deleteModule = useDeleteModule(courseId);
  const reorderModules = useReorderModules(courseId);
  const createLesson = useCreateLesson(courseId);
  const reorderLessons = useReorderLessons(courseId);
  const updateCourse = useUpdateCourse();
  const updatePrerequisites = useUpdateCoursePrerequisites(courseId);
  const { data: publishedCourses } = useCourses({ pageSize: 100, status: "PUBLISHED" });

  const prerequisiteOptions = useMemo(
    () => (publishedCourses?.items ?? []).filter((item) => item.id !== courseId),
    [publishedCourses?.items, courseId],
  );

  const outline = useMemo(
    () => courseOutline(course, { includeEmptyUncategorized: canEdit }),
    [course, canEdit],
  );
  const [tab, setTab] = useState("outline");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [openModules, setOpenModules] = useState<Set<string>>(() => new Set());
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");

  const [aboutTitle, setAboutTitle] = useState("");
  const [aboutDescription, setAboutDescription] = useState("");
  const [aboutDuration, setAboutDuration] = useState("");
  const [aboutCost, setAboutCost] = useState("");
  const [aboutThumbnail, setAboutThumbnail] = useState("");
  const [aboutVideoUrl, setAboutVideoUrl] = useState("");
  const [aboutAvailableFrom, setAboutAvailableFrom] = useState("");
  const [aboutAvailableUntil, setAboutAvailableUntil] = useState("");
  const [completionMode, setCompletionMode] = useState<CompletionMode>("ALL_LESSONS");
  const [completionPercent, setCompletionPercent] = useState("");
  const [requirePreAssessment, setRequirePreAssessment] = useState(false);
  const [prerequisiteCourseIds, setPrerequisiteCourseIds] = useState<string[]>([]);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateIncludeAssignments, setDuplicateIncludeAssignments] = useState(false);

  useEffect(() => {
    if (!course) return;
    setAboutTitle(course.title);
    setAboutDescription(course.description ?? "");
    setAboutDuration(course.durationMinutes ? String(course.durationMinutes) : "");
    setAboutCost(
      course.costCents != null
        ? String(minorToMajor(course.costCents, trainingCurrency))
        : "",
    );
    setAboutThumbnail(course.thumbnailUrl ?? "");
    setAboutVideoUrl(course.videoUrl ?? "");
    setAboutAvailableFrom(course.availableFrom ? course.availableFrom.slice(0, 16) : "");
    setAboutAvailableUntil(course.availableUntil ? course.availableUntil.slice(0, 16) : "");
    setCompletionMode(course.completionMode ?? "ALL_LESSONS");
    setCompletionPercent(course.completionPercent ? String(course.completionPercent) : "");
    setRequirePreAssessment(Boolean(course.requirePreAssessment));
    setPrerequisiteCourseIds((course.prerequisites ?? []).map((item) => item.id));
  }, [course, trainingCurrency]);

  useEffect(() => {
    setOpenModules((prev) => {
      if (prev.size) return prev;
      return new Set(outline.map((section) => section.id ?? "uncategorized"));
    });
    if (!activeLessonId) {
      const first = outline.flatMap((section) => section.lessons)[0];
      if (first) setActiveLessonId(first.id);
    }
  }, [outline, activeLessonId]);

  const activeLesson = course?.lessons.find((lesson) => lesson.id === activeLessonId);
  const lessonMinutes = Math.round(
    (course?.lessons.reduce((sum, lesson) => sum + (lesson.durationSeconds ?? 0), 0) ?? 0) / 60,
  );
  const totalMinutes = course?.durationMinutes || lessonMinutes;
  const previewMinutes = aboutDuration ? Number(aboutDuration) : lessonMinutes;
  const previewThumbnail = resolveAssetUrl(aboutThumbnail.trim());
  const lessonCompletionStats = useMemo(
    () => countLessonCompletionStats(course?.lessons ?? []),
    [course?.lessons],
  );
  const completionSummary = useMemo(
    () =>
      completionRuleSummary(
        completionMode,
        completionMode === "PERCENTAGE" && completionPercent ? Number(completionPercent) : null,
        course?.lessons ?? [],
      ),
    [completionMode, completionPercent, course?.lessons],
  );

  function toggleModule(id: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function moveModule(moduleId: string, direction: -1 | 1) {
    const ids = (course?.modules ?? []).slice().sort((a, b) => a.order - b.order).map((m) => m.id);
    const idx = ids.indexOf(moduleId);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= ids.length) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    reorderModules.mutate(ids);
  }

  function moveLesson(lessonId: string, direction: -1 | 1) {
    const all = (course?.lessons ?? []).slice().sort((a, b) => a.order - b.order);
    const lesson = all.find((item) => item.id === lessonId);
    if (!lesson) return;
    const moduleId = lesson.moduleId ?? null;
    const group = all.filter((item) => (item.moduleId ?? null) === moduleId);
    const idx = group.findIndex((item) => item.id === lessonId);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= group.length) return;
    [group[idx], group[swap]] = [group[swap], group[idx]];
    const groupIds = new Set(group.map((item) => item.id));
    let cursor = 0;
    reorderLessons.mutate(all.map((item) => (groupIds.has(item.id) ? group[cursor++].id : item.id)));
  }

  function handleDelete() {
    const hasHistory = course?.status === "PUBLISHED" || course?.status === "ARCHIVED";
    if (hasHistory) {
      if (
        !isOrgAdmin ||
        !confirm(
          "Delete this course? In-progress enrollments will be revoked. Completed records and certificates are kept.",
        )
      ) {
        return;
      }
      deleteCourse.mutateAsync({ id: courseId, force: true }).then(() => router.push("/courses"));
      return;
    }
    if (confirm("Delete this course?")) {
      deleteCourse.mutateAsync({ id: courseId }).then(() => router.push("/courses"));
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-indigo h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Course not found.</p>
        <Button variant="outline" asChild>
          <Link href="/courses">Back to courses</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {course.status === "ARCHIVED" && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          This course is archived and read-only.
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              className="ml-3 h-7"
              onClick={() => unarchive.mutate(courseId)}
              disabled={unarchive.isPending}
            >
              Restore to draft
            </Button>
          )}
        </div>
      )}
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/courses">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-semibold">{course.title}</h1>
            <Badge variant={course.status === "PUBLISHED" ? "default" : "secondary"}>{course.status}</Badge>
          </div>
          <p className="text-muted-foreground text-xs">
            {outline.filter((section) => section.id).length}{" "}
            {outline.filter((section) => section.id).length === 1 ? "module" : "modules"} ·{" "}
            {course.lessons.length} lessons
            {totalMinutes ? ` · ${totalMinutes} min` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status === "PUBLISHED" && (
            <Button size="sm" asChild>
              <Link href={`/learn/${course.id}`}>
                <Play />
                Preview
              </Link>
            </Button>
          )}
          {canAssign && course.status === "PUBLISHED" && <AssignCourseDialog courseId={courseId} />}
          {canEdit && course.status === "DRAFT" && (
            <Button
              size="sm"
              onClick={() => {
                const missingQuiz = course.lessons.filter(
                  (lesson) => lessonKind(lesson) === "QUIZ" && !lesson.quizAssessmentId,
                );
                if (missingQuiz.length) {
                  toast.error(
                    "Link a module quiz assessment to every QUIZ lesson before publishing.",
                  );
                  setTab("assessments");
                  return;
                }
                const missingVideoDuration = course.lessons.filter(
                  (lesson) =>
                    lessonKind(lesson) === "VIDEO" &&
                    (!lesson.durationSeconds || lesson.durationSeconds <= 0),
                );
                if (missingVideoDuration.length) {
                  toast.error("Set a duration on every VIDEO lesson before publishing.");
                  return;
                }
                publish.mutate(courseId);
              }}
              disabled={publish.isPending || course.lessons.length < 1}
            >
              <Send />
              Publish
            </Button>
          )}
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDuplicateOpen(true)}
              disabled={duplicate.isPending}
            >
              <Copy />
              Duplicate
            </Button>
          )}
          {canEdit && course.status === "PUBLISHED" && (
            <Button size="sm" variant="outline" onClick={() => archive.mutate(courseId)} disabled={archive.isPending}>
              <Archive />
              Archive
            </Button>
          )}
          {canWrite && (course.status === "DRAFT" || course.status === "ARCHIVED" || (course.status === "PUBLISHED" && isOrgAdmin)) && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={handleDelete}
              disabled={deleteCourse.isPending}
            >
              <Trash2 />
              Delete
            </Button>
          )}
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-2">
          <TabsList>
            <TabsTrigger value="outline">Outline</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            {canWrite && course.status !== "DRAFT" && <TabsTrigger value="history">History</TabsTrigger>}
            <TabsTrigger value="scorm">SCORM</TabsTrigger>
            <TabsTrigger value="assessments">Assessments</TabsTrigger>
            {canWrite && <TabsTrigger value="sessions">Sessions</TabsTrigger>}
            {canAssign && <TabsTrigger value="assignments">Assignments</TabsTrigger>}
            {canManageSkills && <TabsTrigger value="skills">Skills</TabsTrigger>}
          </TabsList>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsContent value="outline" className="mt-0 flex min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          <aside className="flex w-80 shrink-0 flex-col border-r border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium">Course content</p>
              {canEdit && course.status !== "ARCHIVED" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => createModule.mutate({ title: nextWeekTitle(course.modules) })}
                  disabled={createModule.isPending}
                >
                  <Plus />
                  Module
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-3 px-3 pb-6">
                {outline.map((section, sectionIdx) => {
                  const key = section.id ?? "uncategorized";
                  const open = openModules.has(key);
                  return (
                    <div key={key} className="rounded-lg border border-border">
                      <div className="flex items-center gap-1 px-2 py-1.5">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => toggleModule(key)}
                        >
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        {editingModuleId === section.id && section.id ? (
                          <Input
                            autoFocus
                            value={moduleTitle}
                            className="h-7 text-sm"
                            onChange={(e) => setModuleTitle(e.target.value)}
                            onBlur={() => {
                              if (moduleTitle.trim() && section.id) {
                                updateModule.mutate({ moduleId: section.id, title: moduleTitle.trim() });
                              }
                              setEditingModuleId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                            onDoubleClick={() => {
                              if (!canEdit || !section.id) return;
                              setEditingModuleId(section.id);
                              setModuleTitle(section.title);
                            }}
                          >
                            {section.title}
                          </button>
                        )}
                        {canEdit && section.id && (
                          <div className="flex">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={sectionIdx === 0}
                              onClick={() => moveModule(section.id!, -1)}
                            >
                              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={sectionIdx === outline.filter((s) => s.id).length - 1}
                              onClick={() => moveModule(section.id!, 1)}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="text-destructive h-7 w-7"
                              onClick={() => {
                                if (confirm("Remove this module? Lessons stay in the course.")) {
                                  deleteModule.mutate(section.id!);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {open && (
                        <div className="border-t border-border px-1 py-1">
                          {section.lessons.map((lesson, lessonIdx) => {
                            const kind = lessonKind(lesson);
                            const duration = formatLessonDuration(lesson.durationSeconds);
                            return (
                              <button
                                key={lesson.id}
                                type="button"
                                onClick={() => setActiveLessonId(lesson.id)}
                                className={cn(
                                  "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm",
                                  lesson.id === activeLessonId
                                    ? "bg-indigo/15 text-indigo"
                                    : "hover:bg-secondary",
                                )}
                              >
                                <LessonTypeIcon kind={kind} />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5 truncate font-medium">
                                    {lesson.title}
                                    {lesson.required === false && (
                                      <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] font-normal">
                                        Optional
                                      </Badge>
                                    )}
                                  </span>
                                  {duration && (
                                    <span className="text-muted-foreground block text-[11px]">{duration}</span>
                                  )}
                                </span>
                                {canEdit && (
                                  <span className="flex shrink-0">
                                    <span
                                      role="button"
                                      className="text-muted-foreground hover:text-foreground px-0.5"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (lessonIdx === 0) return;
                                        moveLesson(lesson.id, -1);
                                      }}
                                    >
                                      ↑
                                    </span>
                                    <span
                                      role="button"
                                      className="text-muted-foreground hover:text-foreground px-0.5"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (lessonIdx === section.lessons.length - 1) return;
                                        moveLesson(lesson.id, 1);
                                      }}
                                    >
                                      ↓
                                    </span>
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {canEdit && course.status !== "ARCHIVED" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="mt-1 w-full justify-start"
                                  disabled={createLesson.isPending}
                                >
                                  <Plus />
                                  Add item
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-56">
                                {LESSON_TYPES.map((type) => (
                                  <DropdownMenuItem
                                    key={type.id}
                                    onClick={() =>
                                      createLesson.mutate(
                                        {
                                          title: type.defaultTitle,
                                          kind: type.id,
                                          moduleId: section.id,
                                        },
                                        { onSuccess: (lesson) => setActiveLessonId(lesson.id) },
                                      )
                                    }
                                  >
                                    {type.label}
                                    <span className="text-muted-foreground ml-auto text-[11px]">
                                      {type.description.split(" ")[0]}
                                    </span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!outline.length && (
                  <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                    Add a module to start building the syllabus.
                  </p>
                )}
              </div>
            </ScrollArea>
          </aside>

          <div className="min-w-0 flex-1 overflow-auto p-6">
            {activeLesson ? (
              <div className="mx-auto max-w-3xl">
                <StudioLessonEditor
                  lesson={activeLesson}
                  courseId={courseId}
                  courseLessons={course?.lessons ?? []}
                  canWrite={canEdit}
                />
              </div>
            ) : (
              <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3">
                <BookOpen className="h-10 w-10 opacity-40" />
                <p className="text-sm">Select a lesson or add a module to begin.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="about" className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto p-6 data-[state=inactive]:hidden">
          <div className="mx-auto max-w-3xl space-y-8">
            {!canEdit && (
              <p className="text-muted-foreground rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                View only — you cannot edit this course&apos;s about page.
              </p>
            )}
            <div className="overflow-hidden rounded-xl bg-hero-gradient text-white">
              {previewThumbnail ? (
                <div className="relative h-40 w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewThumbnail}
                    alt=""
                    className="h-full w-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                </div>
              ) : null}
              <div className="p-8">
                <p className="text-xs uppercase tracking-[0.2em] text-white/70">Course preview</p>
                <h2 className="mt-2 text-3xl font-semibold">
                  {aboutTitle.trim() || "Untitled course"}
                </h2>
                <p className="mt-3 max-w-2xl text-sm text-white/80">
                  {aboutDescription.trim() ||
                    "Add a description so learners know what they will learn."}
                </p>
                <div className="mt-5 flex flex-wrap gap-4 text-sm text-white/80">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" />
                    {course.lessons?.length ?? 0} lessons
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {previewMinutes || "—"} min
                  </span>
                </div>
              </div>
            </div>

            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!canEdit) return;
                await updateCourse.mutateAsync({
                  id: courseId,
                  title: aboutTitle.trim(),
                  description: aboutDescription.trim() || null,
                  durationMinutes: aboutDuration ? Number(aboutDuration) : undefined,
                  costCents: aboutCost.trim()
                    ? majorToMinor(Number(aboutCost), trainingCurrency)
                    : null,
                  thumbnailUrl: aboutThumbnail.trim() || null,
                  videoUrl: aboutVideoUrl.trim() || null,
                  availableFrom: aboutAvailableFrom ? new Date(aboutAvailableFrom).toISOString() : null,
                  availableUntil: aboutAvailableUntil ? new Date(aboutAvailableUntil).toISOString() : null,
                  completionMode,
                  completionPercent:
                    completionMode === "PERCENTAGE" && completionPercent
                      ? Number(completionPercent)
                      : null,
                  requirePreAssessment,
                });
                await updatePrerequisites.mutateAsync(prerequisiteCourseIds);
              }}
            >
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={aboutTitle} disabled={!canEdit} onChange={(e) => setAboutTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>What learners will learn</Label>
                <Textarea
                  rows={5}
                  value={aboutDescription}
                  disabled={!canEdit}
                  onChange={(e) => setAboutDescription(e.target.value)}
                />
              </div>
              <ImageUploadField
                label="Course thumbnail"
                hint="PNG, JPEG, or WebP up to 800 KB."
                value={aboutThumbnail}
                disabled={!canEdit}
                uploading={uploadThumbnail.isPending}
                onUpload={async (file) => {
                  const updated = await uploadThumbnail.mutateAsync(file);
                  setAboutThumbnail(updated.thumbnailUrl ?? "");
                }}
                onClear={() => setAboutThumbnail("")}
              />
              <div className="space-y-2">
                <Label>Thumbnail URL (optional override)</Label>
                <Input
                  value={aboutThumbnail}
                  disabled={!canEdit}
                  placeholder="https://… or /uploads/…"
                  onChange={(e) => setAboutThumbnail(e.target.value)}
                />
              </div>
              <LessonFileField
                kind="video"
                label="Intro video upload"
                hint="MP4, WebM, MOV, or M4V up to 80 MB. Shown on the learner course page when no lesson video is playing."
                value={aboutVideoUrl}
                disabled={!canEdit}
                urlPlaceholder="https://… or /uploads/…"
                onUrlChange={setAboutVideoUrl}
                onUpload={async (file) => {
                  const updated = await uploadIntroVideo.mutateAsync(file);
                  setAboutVideoUrl(updated.videoUrl ?? "");
                }}
                onClear={() => setAboutVideoUrl("")}
              />
              <div className="space-y-2">
                <Label>Intro video URL (optional override)</Label>
                <Input
                  value={aboutVideoUrl}
                  disabled={!canEdit}
                  placeholder="https://… or /uploads/…"
                  onChange={(e) => setAboutVideoUrl(e.target.value)}
                />
              </div>
              {aboutVideoUrl.trim() ? (
                <div className="aspect-video overflow-hidden rounded-xl bg-black">
                  <LessonVideoPlayer url={aboutVideoUrl} title="Course intro video" />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Estimated duration (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={aboutDuration}
                  disabled={!canEdit}
                  onChange={(e) => setAboutDuration(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Leave blank to use the sum of lesson lengths ({lessonMinutes || 0} min).
                </p>
              </div>
              <div className="space-y-2">
                <Label>Training cost ({trainingCurrency})</Label>
                <Input
                  type="number"
                  min={0}
                  step={trainingCurrency === "USD" ? "0.01" : "1"}
                  value={aboutCost}
                  disabled={!canEdit}
                  placeholder={trainingCurrency === "USD" ? "e.g. 75.00" : "e.g. 75000"}
                  onChange={(e) => setAboutCost(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Used for ROI analytics when learners complete this course. Org default:{" "}
                  {resolveDefaultTrainingCostMinor(organization?.settings) > 0
                    ? `${minorToMajor(resolveDefaultTrainingCostMinor(organization?.settings), trainingCurrency).toLocaleString()} ${trainingCurrency}`
                    : "not set"}
                  .
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Available from</Label>
                  <Input
                    type="datetime-local"
                    value={aboutAvailableFrom}
                    disabled={!canEdit}
                    onChange={(e) => setAboutAvailableFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Available until</Label>
                  <Input
                    type="datetime-local"
                    value={aboutAvailableUntil}
                    disabled={!canEdit}
                    onChange={(e) => setAboutAvailableUntil(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Requires completion of</Label>
                <p className="text-muted-foreground text-xs">
                  Learners must complete these courses before enrolling or starting this one.
                </p>
                <ScrollArea className="h-40 rounded-md border border-border p-3">
                  <div className="space-y-2">
                    {prerequisiteOptions.length ? (
                      prerequisiteOptions.map((option) => {
                        const checked = prerequisiteCourseIds.includes(option.id);
                        return (
                          <label key={option.id} className="flex items-start gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              disabled={!canEdit}
                              onCheckedChange={(next) => {
                                setPrerequisiteCourseIds((prev) =>
                                  next
                                    ? [...prev, option.id]
                                    : prev.filter((id) => id !== option.id),
                                );
                              }}
                            />
                            <span>{option.title}</span>
                          </label>
                        );
                      })
                    ) : (
                      <p className="text-muted-foreground text-xs">No other published courses yet.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
              <div className="space-y-2">
                <Label>Completion rule</Label>
                <Select
                  value={completionMode}
                  onValueChange={(value) => setCompletionMode(value as CompletionMode)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_LESSONS">All lessons required</SelectItem>
                    <SelectItem value="REQUIRED_LESSONS">Required lessons only</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage of lessons</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">{completionSummary}</p>
                {lessonCompletionStats.total > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {lessonCompletionStats.required} required · {lessonCompletionStats.optional} optional ·{" "}
                    {lessonCompletionStats.total} total
                  </p>
                )}
                {completionMode === "REQUIRED_LESSONS" && lessonCompletionStats.required === 0 && (
                  <p className="text-amber-600 text-xs dark:text-amber-400">
                    No lessons are marked required. Toggle &quot;Required for course completion&quot; in the lesson editor.
                  </p>
                )}
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                <Checkbox
                  checked={requirePreAssessment}
                  disabled={!canEdit}
                  onCheckedChange={(checked) => setRequirePreAssessment(checked === true)}
                />
                <span>
                  <span className="font-medium">Require pre-assessment</span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    Learners must pass the course pre-assessment before accessing lessons.
                  </span>
                </span>
              </label>
              {completionMode === "PERCENTAGE" && (
                <div className="space-y-2">
                  <Label>Completion percentage</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={completionPercent}
                    disabled={!canEdit}
                    onChange={(e) => setCompletionPercent(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Learners must complete at least{" "}
                    {lessonCompletionStats.total && completionPercent
                      ? Math.max(1, Math.ceil((Number(completionPercent) / 100) * lessonCompletionStats.total))
                      : "—"}{" "}
                    of {lessonCompletionStats.total || "—"} lessons.
                  </p>
                </div>
              )}
              {canEdit && (
                <Button type="submit" disabled={updateCourse.isPending || updatePrerequisites.isPending}>
                  {updateCourse.isPending || updatePrerequisites.isPending ? "Saving…" : "Save about page"}
                </Button>
              )}
            </form>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Syllabus</h3>
              <ol className="space-y-3">
                {outline.map((section, idx) => (
                  <li key={section.id ?? `u-${idx}`} className="rounded-lg border border-border p-4">
                    <p className="font-medium">
                      {idx + 1}. {section.title}
                    </p>
                    <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                      {section.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          {lessonTypeLabel(lessonKind(lesson))} · {lesson.title}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </TabsContent>

        {canWrite && course.status !== "DRAFT" && (
          <TabsContent value="history" className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto p-6 data-[state=inactive]:hidden">
            <CourseRevisionPanel courseId={courseId} />
          </TabsContent>
        )}

        <TabsContent value="scorm" className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto p-6 data-[state=inactive]:hidden">
          <div className="mx-auto max-w-3xl space-y-6">
            {!canEdit && (
              <p className="text-muted-foreground rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                View only — SCORM packages cannot be changed while this course is archived or read-only.
              </p>
            )}
            <ScormUploadField
              disabled={!canEdit}
              uploading={uploadScorm.isPending}
              packageUrl={course.scormPackageUrl}
              scormVersion={course.scormVersion}
              onUpload={(file) => uploadScorm.mutateAsync(file).then(() => undefined)}
            />
            {course.scormPackageUrl && (
              <p className="text-muted-foreground text-sm">
                A SCORM lesson is created automatically. Learners launch the package from the course player; completion is tracked through SCORM CMI.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="assessments" className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto p-6 data-[state=inactive]:hidden">
          <div className="mx-auto max-w-3xl">
            <AssessmentSection courseId={courseId} canWrite={canEdit} />
          </div>
        </TabsContent>

        {canWrite ? (
          <TabsContent value="sessions" className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto p-6 data-[state=inactive]:hidden">
            <CourseSessionsPanel courseId={courseId} canWrite={canWrite} />
          </TabsContent>
        ) : null}

        {canAssign && (
          <TabsContent value="assignments" className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto p-6 data-[state=inactive]:hidden">
            <div className="mx-auto max-w-3xl">
              {course.status === "PUBLISHED" ? (
                <CourseAssignmentsPanel courseId={courseId} />
              ) : (
                <p className="text-muted-foreground text-sm">Publish the course before assigning it.</p>
              )}
            </div>
          </TabsContent>
        )}

        {canManageSkills && (
          <TabsContent value="skills" className="mt-0 flex min-h-0 flex-1 flex-col overflow-auto p-6 data-[state=inactive]:hidden">
            <CourseSkillsPanel courseId={courseId} canWrite={canEdit && hasPermission("skills:write")} />
          </TabsContent>
        )}
        </div>
      </Tabs>

      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate course</DialogTitle>
            <DialogDescription>
              Creates a draft copy with modules, lessons, assessments, prerequisites, and completion settings.
              SCORM packages are not copied.
            </DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox
              checked={duplicateIncludeAssignments}
              onCheckedChange={(checked) => setDuplicateIncludeAssignments(checked === true)}
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">Include assignments</span>
              <span className="text-muted-foreground block text-xs">
                Copy assignment rules to the new course. Enrollments are never duplicated.
              </span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDuplicateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={duplicate.isPending}
              onClick={() => {
                void duplicate
                  .mutateAsync({ id: courseId, includeAssignments: duplicateIncludeAssignments })
                  .then((copy) => {
                    setDuplicateOpen(false);
                    setDuplicateIncludeAssignments(false);
                    router.push(`/courses/${copy.id}`);
                  });
              }}
            >
              {duplicate.isPending ? <Loader2 className="animate-spin" /> : <Copy />}
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
