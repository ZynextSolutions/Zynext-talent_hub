"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  List,
  Loader2,
  Lock,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCourse } from "@/hooks/useCourses";
import type { Enrollment, EnrollmentDetail, EnrollmentStatus, LessonProgress, Paginated } from "@/types";
import { Button } from "@/components/ui/button";
import { DueDateBadge, DueDateLine } from "@/components/learner/due-date-display";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CourseQuizPanel } from "@/components/courses/course-quiz-panel";
import { LessonActivity } from "@/components/courses/lesson-activity";
import { CourseForumPanel } from "@/components/forums/course-forum-panel";
import { useCourseAssessments, useAssessmentAttempts } from "@/hooks/useAssessments";
import { courseOutline, formatLessonDuration, lessonKind } from "@/lib/course-outline";
import { isLessonUnlocked } from "@/lib/lesson-prerequisites";
import {
  completionRuleSummary,
  isLessonRequired,
  lessonsMeetCompletionRule,
} from "@/lib/completion";
import { Badge } from "@/components/ui/badge";
import {
  isCompletionProdEnv,
  isExternalVideoUrl,
  learnerCompletionCheck,
  readingDwellMs,
} from "@/lib/learner-completion";

export default function LearnCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: course, isLoading: courseLoading } = useCourse(courseId);

  const { data: enrollments, isLoading: enrollLoading } = useQuery({
    queryKey: ["enrollments", courseId, user?.id],
    queryFn: () =>
      api.get<Paginated<Enrollment>>(
        `/enrollments?courseId=${courseId}&userId=${user!.id}&pageSize=1`,
      ),
    enabled: isAuthenticated && !!user,
  });

  const enrollmentId = enrollments?.items?.[0]?.id;

  const { data: enrollment, isLoading: detailLoading } = useQuery({
    queryKey: ["enrollments", enrollmentId],
    queryFn: () => api.get<EnrollmentDetail>(`/enrollments/${enrollmentId}`),
    enabled: !!enrollmentId,
  });

  const enrollmentSummary = enrollment ?? enrollments?.items?.[0];

  const outline = useMemo(() => courseOutline(course), [course]);
  const lessons = useMemo(
    () => outline.flatMap((section) => section.lessons),
    [outline],
  );

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"pre" | "lessons" | "quiz" | "forum" | "survey">("lessons");
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [localProgress, setLocalProgress] = useState<Record<string, Partial<LessonProgress>>>({});
  const [completingLesson, setCompletingLesson] = useState(false);
  const { data: assessments } = useCourseAssessments(courseId);
  const preAssessment = assessments?.find((a) => a.kind === "PRE");
  const surveys = assessments?.filter((a) => a.kind === "SURVEY") ?? [];
  const hasPreAssessment = Boolean(preAssessment);
  const hasFinalAssessment = assessments?.some((a) => a.kind === "FINAL");
  const { data: preAttempts } = useAssessmentAttempts(preAssessment?.id);
  const preRequired = Boolean(course?.requirePreAssessment && preAssessment);
  const prePassed = !preRequired || Boolean(preAttempts?.some((attempt) => attempt.passed));

  const progressMap = useMemo(() => {
    const map = new Map<string, LessonProgress>();
    for (const row of enrollment?.progress ?? []) {
      map.set(row.lessonId, { ...row, ...localProgress[row.lessonId] });
    }
    for (const [lessonId, patch] of Object.entries(localProgress)) {
      if (!map.has(lessonId)) {
        map.set(lessonId, {
          lessonId,
          completed: Boolean(patch.completed),
          positionSeconds: patch.positionSeconds ?? 0,
          watchedSeconds: patch.watchedSeconds ?? 0,
          openedAt: patch.openedAt ?? null,
          ...patch,
        });
      }
    }
    return map;
  }, [enrollment?.progress, localProgress]);

  const completedLessonIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [lessonId, row] of progressMap) {
      if (row.completed) ids.add(lessonId);
    }
    return ids;
  }, [progressMap]);

  useEffect(() => {
    setLocalProgress({});
  }, [enrollmentId]);

  useEffect(() => {
    if (!lessons.length || activeLessonId || enrollment === undefined) return;
    if (preRequired && !prePassed) {
      setViewMode("pre");
      return;
    }

    const lastLesson = enrollment?.lastLessonId
      ? lessons.find((lesson) => lesson.id === enrollment.lastLessonId)
      : null;
    if (lastLesson && isLessonUnlocked(lastLesson, completedLessonIds)) {
      setActiveLessonId(lastLesson.id);
      return;
    }

    const firstIncomplete = lessons.find(
      (lesson) =>
        !progressMap.get(lesson.id)?.completed &&
        isLessonUnlocked(lesson, completedLessonIds),
    );
    const fallback = lessons.find((lesson) => isLessonUnlocked(lesson, completedLessonIds));
    const chosen = firstIncomplete?.id ?? fallback?.id ?? lessons[0].id;
    setActiveLessonId(chosen);
    if (enrollmentId && chosen) {
      const progress = progressMap.get(chosen);
      void api
        .put<{ lessonProgress: LessonProgress }>(
          `/enrollments/${enrollmentId}/progress/lessons/${chosen}`,
          { positionSeconds: progress?.positionSeconds ?? 0 },
        )
        .then((data) => {
          if (data?.lessonProgress) {
            setLocalProgress((prev) => ({
              ...prev,
              [chosen]: { ...prev[chosen], ...data.lessonProgress },
            }));
          }
        });
    }
  }, [lessons, enrollment, enrollmentId, activeLessonId, completedLessonIds, preRequired, prePassed, progressMap]);

  useEffect(() => {
    if (preRequired && !prePassed && viewMode === "lessons") {
      setViewMode("pre");
    }
  }, [preRequired, prePassed, viewMode]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const completeLesson = useMutation({
    mutationFn: (lessonId: string) =>
      api.post<{
        lessonProgress: LessonProgress;
        enrollment: { progressPercent: number; status: string };
      }>(`/enrollments/${enrollmentId}/progress/lessons/${lessonId}/complete`),
    onSuccess: (data, lessonId) => {
      setLocalProgress((prev) => ({
        ...prev,
        [lessonId]: {
          ...prev[lessonId],
          ...data.lessonProgress,
          completed: true,
        },
      }));
      // Apply enrollment progress immediately so final assessment unlocks without waiting on refetch.
      queryClient.setQueryData<EnrollmentDetail>(["enrollments", enrollmentId], (old) => {
        if (!old) return old;
        const nextProgress = [...(old.progress ?? [])];
        const idx = nextProgress.findIndex((row) => row.lessonId === lessonId);
        const merged: LessonProgress = {
          ...(idx >= 0
            ? nextProgress[idx]
            : { lessonId, completed: false, positionSeconds: 0 }),
          ...data.lessonProgress,
          completed: true,
        };
        if (idx >= 0) nextProgress[idx] = merged;
        else nextProgress.push(merged);
        return {
          ...old,
          progressPercent: data.enrollment.progressPercent,
          status: data.enrollment.status as EnrollmentStatus,
          progress: nextProgress,
        };
      });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Lesson completed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not complete lesson");
    },
  });

  const positionTimer = useRef<number | undefined>(undefined);
  const pendingPositionRef = useRef<{ lessonId: string; seconds: number } | null>(null);
  const flushInFlightRef = useRef<Promise<LessonProgress | null> | null>(null);

  function patchLocalProgress(lessonId: string, patch: Partial<LessonProgress>) {
    setLocalProgress((prev) => ({
      ...prev,
      [lessonId]: { ...prev[lessonId], ...patch },
    }));
  }

  async function putLessonPosition(
    lessonId: string,
    seconds: number,
  ): Promise<LessonProgress | null> {
    if (!enrollmentId) return null;
    const data = await api.put<{ lessonProgress: LessonProgress }>(
      `/enrollments/${enrollmentId}/progress/lessons/${lessonId}`,
      { positionSeconds: seconds },
    );
    if (data?.lessonProgress) {
      patchLocalProgress(lessonId, data.lessonProgress);
      return data.lessonProgress;
    }
    return null;
  }

  async function flushLessonPosition(lessonId: string, seconds: number): Promise<LessonProgress | null> {
    const pending = pendingPositionRef.current;
    if (pending?.lessonId === lessonId && pending.seconds === seconds && flushInFlightRef.current) {
      return flushInFlightRef.current;
    }
    const run = putLessonPosition(lessonId, seconds).finally(() => {
      if (flushInFlightRef.current === run) flushInFlightRef.current = null;
      const latest = pendingPositionRef.current;
      if (latest?.lessonId === lessonId && latest.seconds === seconds) {
        pendingPositionRef.current = null;
      }
    });
    flushInFlightRef.current = run;
    return run;
  }

  /** Cancel debounce and push the latest position so complete uses server watch time. */
  async function flushPendingPosition(lessonId: string): Promise<LessonProgress | null> {
    window.clearTimeout(positionTimer.current);
    if (flushInFlightRef.current) {
      await flushInFlightRef.current.catch(() => null);
    }
    const pending = pendingPositionRef.current;
    const seconds =
      pending?.lessonId === lessonId
        ? pending.seconds
        : (progressMap.get(lessonId)?.positionSeconds ?? 0);
    return flushLessonPosition(lessonId, seconds);
  }

  function recordLessonVisit(lessonId: string) {
    if (!enrollmentId) return;
    const seconds = progressMap.get(lessonId)?.positionSeconds ?? 0;
    void putLessonPosition(lessonId, seconds).catch(() => {
      /* visit tracking is best-effort */
    });
  }

  function selectLesson(lessonId: string) {
    if (preRequired && !prePassed) {
      setViewMode("pre");
      toast.error("Complete the pre-assessment before accessing lessons");
      return;
    }
    setViewMode("lessons");
    setActiveLessonId(lessonId);
    recordLessonVisit(lessonId);
  }

  function openSurvey(surveyId: string) {
    setActiveSurveyId(surveyId);
    setViewMode("survey");
  }

  function savePosition(lessonId: string, seconds: number) {
    if (!enrollmentId) return;
    // Only position is optimistic; watchedSeconds comes from the server (capped deltas).
    patchLocalProgress(lessonId, { positionSeconds: seconds });
    pendingPositionRef.current = { lessonId, seconds };
    window.clearTimeout(positionTimer.current);
    positionTimer.current = window.setTimeout(() => {
      void flushLessonPosition(lessonId, seconds).catch(() => {
        /* position saves are best-effort until complete flush */
      });
    }, 1500);
  }

  const activeLesson = lessons.find((l) => l.id === activeLessonId);
  const activeIndex = lessons.findIndex((l) => l.id === activeLessonId);
  const activeKind = activeLesson ? lessonKind(activeLesson) : null;
  const scormManaged = activeKind === "SCORM";
  const iltManaged = activeKind === "ILT" || activeKind === "VILT";
  const quizManaged = activeKind === "QUIZ";
  const effectiveVideoUrl = activeLesson?.videoUrl || course?.videoUrl || null;
  const activeProgress = progressMap.get(activeLesson?.id ?? "");
  const completionCheck = learnerCompletionCheck(
    activeLesson
      ? { ...activeLesson, kind: activeKind ?? activeLesson.kind, videoUrl: effectiveVideoUrl }
      : undefined,
    activeProgress,
    nowMs,
  );
  const canCompleteActive = completionCheck.ok;

  async function handleCompleteOrNext() {
    if (enrollmentId && activeLesson && !scormManaged && !iltManaged && !quizManaged) {
      setCompletingLesson(true);
      try {
        const flushed = await flushPendingPosition(activeLesson.id);
        const progressForCheck = flushed ?? progressMap.get(activeLesson.id);
        const check = learnerCompletionCheck(
          {
            ...activeLesson,
            kind: activeKind ?? activeLesson.kind,
            videoUrl: effectiveVideoUrl,
          },
          progressForCheck,
          Date.now(),
        );
        if (!check.ok) {
          setNowMs(Date.now());
          toast.error(check.reason || "This lesson is not ready to mark complete.");
          return;
        }
        await completeLesson.mutateAsync(activeLesson.id);
        if (activeIndex < lessons.length - 1) {
          selectLesson(lessons[activeIndex + 1].id);
        } else if (hasFinalAssessment) {
          setViewMode("quiz");
        }
      } catch {
        /* mutateAsync errors already toasted in onError */
      } finally {
        setCompletingLesson(false);
      }
      return;
    }
    if (activeIndex < lessons.length - 1) {
      const nextId = lessons[activeIndex + 1]?.id;
      if (nextId) selectLesson(nextId);
    } else if (hasFinalAssessment) {
      setViewMode("quiz");
    }
  }

  useEffect(() => {
    const readingKind =
      activeKind === "READING" || activeKind === "DOCUMENT" || activeKind === "DISCUSSION";
    const needsExternalVideoTick =
      activeKind === "VIDEO" &&
      isExternalVideoUrl(effectiveVideoUrl) &&
      !completionCheck.ok &&
      !activeProgress?.completed;
    const needsReadingDwellTick =
      readingKind &&
      readingDwellMs(isCompletionProdEnv()) > 0 &&
      !completionCheck.ok &&
      !activeProgress?.completed;
    if (!activeLesson || (!needsExternalVideoTick && !needsReadingDwellTick)) {
      return;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [
    activeLesson,
    activeKind,
    effectiveVideoUrl,
    completionCheck.ok,
    activeProgress?.completed,
  ]);

  const isLoading = authLoading || courseLoading || enrollLoading || detailLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-indigo" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Course not found.</p>
        <Button variant="outline" asChild>
          <Link href="/courses">Back to courses</Link>
        </Button>
      </div>
    );
  }

  const blockedByCoursePrerequisites = (course.unmetPrerequisites?.length ?? 0) > 0;
  const lessonsComplete = lessonsMeetCompletionRule(enrollment?.progressPercent);
  const completionSummary = completionRuleSummary(
    course.completionMode,
    course.completionPercent,
    lessons,
    { hasFinalAssessment: !!hasFinalAssessment },
  );
  const showDueDate =
    enrollmentSummary?.dueAt &&
    enrollmentSummary.status !== "COMPLETED" &&
    (enrollmentSummary.progressPercent ?? 0) < 100;

  if (blockedByCoursePrerequisites) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center gap-4 border-b border-border px-4 py-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/catalog">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="truncate text-sm font-semibold">{course.title}</h1>
        </header>
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 p-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-luxury">
            <h2 className="text-lg font-semibold">Prerequisites required</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Complete the following courses before starting this one:
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {course.unmetPrerequisites?.map((prerequisite) => (
                <li key={prerequisite.id}>
                  <Link href={`/catalog`} className="text-indigo hover:underline">
                    {prerequisite.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-4 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{course.title}</h1>
            {showDueDate && enrollmentSummary ? (
              <DueDateBadge enrollment={enrollmentSummary} />
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-3">
            <Progress value={enrollment?.progressPercent ?? 0} className="h-1.5 max-w-xs flex-1" />
            <span className="text-muted-foreground text-xs tabular-nums">
              {enrollment?.progressPercent ?? 0}%
            </span>
          </div>
          {showDueDate && enrollmentSummary ? (
            <DueDateLine enrollment={enrollmentSummary} className="mt-1 text-[11px]" />
          ) : null}
          <p className="text-muted-foreground mt-1 max-w-xl truncate text-[11px]">{completionSummary}</p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="md:hidden">
              <List className="mr-1 h-4 w-4" />
              Syllabus
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="border-b border-border px-4 py-3 text-left">
              <SheetTitle>Syllabus</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-3.5rem)]">
              <LearnSyllabus
                outline={outline}
                lessons={lessons}
                progressMap={progressMap}
                completedLessonIds={completedLessonIds}
                viewMode={viewMode}
                activeLessonId={activeLessonId}
                hasPreAssessment={!!hasPreAssessment}
                preRequired={preRequired}
                prePassed={prePassed}
                surveys={surveys}
                activeSurveyId={activeSurveyId}
                hasFinalAssessment={!!hasFinalAssessment}
                lessonsComplete={lessonsComplete}
                onPre={() => setViewMode("pre")}
                onLesson={selectLesson}
                onQuiz={() => setViewMode("quiz")}
                onForum={() => setViewMode("forum")}
                onSurvey={openSurvey}
              />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-72 shrink-0 border-r border-border md:block">
          <ScrollArea className="h-full">
            <LearnSyllabus
              outline={outline}
              lessons={lessons}
              progressMap={progressMap}
              completedLessonIds={completedLessonIds}
              viewMode={viewMode}
              activeLessonId={activeLessonId}
              hasPreAssessment={!!hasPreAssessment}
              preRequired={preRequired}
              prePassed={prePassed}
              surveys={surveys}
              activeSurveyId={activeSurveyId}
              hasFinalAssessment={!!hasFinalAssessment}
              lessonsComplete={lessonsComplete}
              onPre={() => setViewMode("pre")}
              onLesson={selectLesson}
              onQuiz={() => setViewMode("quiz")}
              onForum={() => setViewMode("forum")}
              onSurvey={openSurvey}
            />
          </ScrollArea>
        </aside>

        <main className="flex flex-1 flex-col overflow-auto">
          {viewMode === "pre" && enrollmentId ? (
            <div className="mx-auto w-full max-w-4xl flex-1 p-6">
              <CourseQuizPanel
                courseId={courseId}
                enrollmentId={enrollmentId}
                lessonsComplete
                kind="PRE"
              />
            </div>
          ) : viewMode === "quiz" && enrollmentId ? (
            <div className="mx-auto w-full max-w-4xl flex-1 p-6">
              <CourseQuizPanel
                courseId={courseId}
                enrollmentId={enrollmentId}
                lessonsComplete={lessonsComplete}
              />
            </div>
          ) : viewMode === "survey" && enrollmentId && activeSurveyId ? (
            <div className="mx-auto w-full max-w-4xl flex-1 p-6">
              <CourseQuizPanel
                courseId={courseId}
                enrollmentId={enrollmentId}
                lessonsComplete={lessonsComplete}
                kind="SURVEY"
                assessmentId={activeSurveyId}
              />
            </div>
          ) : viewMode === "forum" && enrollmentId ? (
            <div className="mx-auto w-full max-w-4xl flex-1 p-6">
              <CourseForumPanel courseId={courseId} />
            </div>
          ) : activeLesson && preRequired && !prePassed ? (
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <Lock className="text-muted-foreground h-10 w-10" />
              <h2 className="text-lg font-semibold">Pre-assessment required</h2>
              <p className="text-muted-foreground max-w-md text-sm">
                Pass the pre-assessment before you can access course lessons.
              </p>
              <Button onClick={() => setViewMode("pre")}>Go to pre-assessment</Button>
            </div>
          ) : activeLesson && !isLessonUnlocked(activeLesson, completedLessonIds) ? (
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <Lock className="text-muted-foreground h-10 w-10" />
              <h2 className="text-lg font-semibold">Lesson locked</h2>
              <p className="text-muted-foreground max-w-md text-sm">
                Complete the prerequisite lesson in the syllabus before continuing.
              </p>
            </div>
          ) : activeLesson ? (
            <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-6">
              <LessonActivity
                key={activeLesson.id}
                lesson={activeLesson}
                courseId={courseId}
                enrollmentId={enrollmentId}
                lessonCompleted={progressMap.get(activeLesson.id)?.completed}
                fallbackVideoUrl={course.videoUrl}
                poster={course.thumbnailUrl}
                initialPosition={progressMap.get(activeLesson.id)?.positionSeconds}
                onPosition={(seconds) => savePosition(activeLesson.id, seconds)}
              />

              <Separator />

              <div className="flex flex-col gap-2 pb-8">
                <div className="flex items-center justify-between gap-4">
                  <Button
                    variant="outline"
                    disabled={activeIndex <= 0}
                    onClick={() => {
                      const prevId = lessons[activeIndex - 1]?.id;
                      if (prevId) selectLesson(prevId);
                    }}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>

                  <Button
                    onClick={() => {
                      void handleCompleteOrNext();
                    }}
                    disabled={
                      completeLesson.isPending ||
                      completingLesson ||
                      Boolean(
                        enrollmentId &&
                          !scormManaged &&
                          !iltManaged &&
                          !quizManaged &&
                          !canCompleteActive,
                      )
                    }
                  >
                    {!enrollmentId || scormManaged || iltManaged || quizManaged ? (
                      activeIndex < lessons.length - 1 ? (
                        <>
                          Next
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </>
                      ) : (
                        "Finish preview"
                      )
                    ) : activeIndex < lessons.length - 1 ? (
                      <>
                        Complete & next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </>
                    ) : hasFinalAssessment ? (
                      <>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Take assessment
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Complete course
                      </>
                    )}
                  </Button>
                </div>
                {enrollmentId &&
                !scormManaged &&
                !iltManaged &&
                !quizManaged &&
                !canCompleteActive &&
                completionCheck.reason ? (
                  <p className="text-muted-foreground text-center text-xs sm:text-right">
                    {completionCheck.reason}
                  </p>
                ) : null}
                {enrollmentId && quizManaged && activeLesson && !activeLesson.quizAssessmentId ? (
                  <p className="text-muted-foreground text-center text-xs sm:text-right">
                    Quiz not configured — this lesson cannot be completed until an admin links an
                    assessment.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <Skeleton className="h-64 w-full max-w-2xl" />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function LearnSyllabus({
  outline,
  lessons,
  progressMap,
  completedLessonIds,
  viewMode,
  activeLessonId,
  hasPreAssessment,
  preRequired,
  prePassed,
  surveys,
  activeSurveyId,
  hasFinalAssessment,
  lessonsComplete,
  onPre,
  onLesson,
  onQuiz,
  onForum,
  onSurvey,
}: {
  outline: ReturnType<typeof courseOutline>;
  lessons: {
    id: string;
    title: string;
    durationSeconds?: number | null;
    prerequisiteLessonId?: string | null;
    required?: boolean;
  }[];
  progressMap: Map<string, { completed: boolean }>;
  completedLessonIds: Set<string>;
  viewMode: "pre" | "lessons" | "quiz" | "forum" | "survey";
  activeLessonId: string | null;
  hasPreAssessment: boolean;
  preRequired: boolean;
  prePassed: boolean;
  surveys: Array<{ id: string; title: string }>;
  activeSurveyId: string | null;
  hasFinalAssessment: boolean;
  lessonsComplete: boolean;
  onPre: () => void;
  onLesson: (id: string) => void;
  onQuiz: () => void;
  onForum: () => void;
  onSurvey: (id: string) => void;
}) {
  const lessonsLocked = preRequired && !prePassed;

  return (
    <div className="space-y-1 p-3">
      {hasPreAssessment && (
        <button
          type="button"
          onClick={onPre}
          className={cn(
            "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
            viewMode === "pre" ? "bg-indigo/15 text-indigo ring-1 ring-indigo/20" : "hover:bg-secondary",
          )}
        >
          {preRequired && !prePassed ? (
            <Lock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          ) : prePassed ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <Circle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">Pre-assessment</p>
            <p className="text-muted-foreground text-xs">
              {preRequired ? "Required before lessons" : "Optional baseline quiz"}
            </p>
          </div>
        </button>
      )}
      {outline.map((section) => (
        <div key={section.id ?? section.title} className="pt-2">
          <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider">
            {section.title}
          </p>
          {section.lessons.map((lesson) => {
            const done = progressMap.get(lesson.id)?.completed;
            const locked = lessonsLocked || !isLessonUnlocked(lesson, completedLessonIds);
            const active = viewMode === "lessons" && lesson.id === activeLessonId;
            const idx = lessons.findIndex((item) => item.id === lesson.id);
            return (
              <button
                key={lesson.id}
                type="button"
                disabled={locked}
                onClick={() => onLesson(lesson.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  locked && "cursor-not-allowed opacity-60",
                  active ? "bg-indigo/15 text-indigo ring-1 ring-indigo/20" : "hover:bg-secondary",
                )}
              >
                {locked ? (
                  <Lock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                ) : done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {idx + 1}. {lesson.title}
                    {!isLessonRequired(lesson) && (
                      <Badge variant="outline" className="ml-1.5 px-1 py-0 text-[10px] font-normal">
                        Optional
                      </Badge>
                    )}
                  </p>
                  {formatLessonDuration(lesson.durationSeconds) && (
                    <p className="text-muted-foreground text-xs">
                      {formatLessonDuration(lesson.durationSeconds)}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}
      <div className="pt-2">
        <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider">
          Community
        </p>
        <button
          type="button"
          onClick={onForum}
          className={cn(
            "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
            viewMode === "forum" ? "bg-indigo/15 text-indigo ring-1 ring-indigo/20" : "hover:bg-secondary",
          )}
        >
          <MessageSquare className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-medium">Course forum</p>
            <p className="text-muted-foreground text-xs">Discuss with classmates</p>
          </div>
        </button>
      </div>
      {surveys.length > 0 && (
        <div className="pt-2">
          <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider">
            Surveys
          </p>
          {surveys.map((survey) => (
            <button
              key={survey.id}
              type="button"
              onClick={() => onSurvey(survey.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                viewMode === "survey" && activeSurveyId === survey.id
                  ? "bg-indigo/15 text-indigo ring-1 ring-indigo/20"
                  : "hover:bg-secondary",
              )}
            >
              <Circle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-medium">{survey.title}</p>
                <p className="text-muted-foreground text-xs">Optional feedback</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {hasFinalAssessment && lessonsComplete && (
        <button
          type="button"
          onClick={onQuiz}
          className={cn(
            "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
            viewMode === "quiz" ? "bg-indigo/15 text-indigo ring-1 ring-indigo/20" : "hover:bg-secondary",
          )}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className="truncate font-medium">Final assessment</p>
            <p className="text-muted-foreground text-xs">Required to complete</p>
          </div>
        </button>
      )}
    </div>
  );
}
