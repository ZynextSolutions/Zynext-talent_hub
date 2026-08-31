"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateAssessment, useDeleteAssessment, useCourseAssessments, downloadSurveyExport } from "@/hooks/useAssessments";
import { useQuestionBanks } from "@/hooks/useQuestionBanks";
import { useCourse } from "@/hooks/useCourses";
import { useAuth } from "@/hooks/useAuth";
import { AssessmentQuestionEditor } from "@/components/courses/assessment-question-editor";
import { EditAssessmentDialog } from "@/components/courses/edit-assessment-dialog";
import {
  draftsToApiPayload,
  emptyQuestion,
  validQuestionDrafts,
  type QuestionDraft,
} from "@/lib/assessment-question-draft";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";

type QuestionSource = "custom" | "bank";

type AssessmentKindOption = "PRE" | "FINAL" | "SURVEY" | "MODULE_QUIZ";

interface CreateAssessmentDialogProps {
  courseId: string;
  canWrite?: boolean;
}

export function AssessmentSection({ courseId, canWrite = true }: CreateAssessmentDialogProps) {
  const { hasPermission } = useAuth();
  const canEdit = canWrite && hasPermission("assessment:write");
  const { data: assessments, isLoading } = useCourseAssessments(courseId);
  const { data: course } = useCourse(courseId);
  const { data: banks } = useQuestionBanks();
  const deleteAssessment = useDeleteAssessment(courseId);

  const bankNames = useMemo(
    () => new Map(banks?.map((b) => [b.id, b.name]) ?? []),
    [banks],
  );

  const lessonTitles = useMemo(
    () => new Map(course?.lessons.map((lesson) => [lesson.id, lesson.title]) ?? []),
    [course?.lessons],
  );

  const existingKinds = assessments?.map((a) => a.kind) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {assessments?.map((existing) => (
        <div key={existing.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">
                {existing.title}{" "}
                <span className="text-muted-foreground text-xs">({existing.kind})</span>
              </p>
              <p className="text-muted-foreground text-sm">
                {existing.kind === "SURVEY"
                  ? `Survey · ${existing.anonymous ? "Anonymous" : "Identified"} · ${existing.questionCount} questions`
                  : existing.kind === "MODULE_QUIZ"
                    ? `Module quiz · ${lessonTitles.get(existing.lessonId ?? "") ?? "Lesson"} · Pass ${existing.passingScore}%`
                    : existing.bankId
                      ? `Random draw · ${existing.drawCount ?? "?"} from ${bankNames.get(existing.bankId) ?? "question bank"}`
                      : `${existing.questionCount} custom questions`}
                {existing.kind !== "SURVEY" ? ` · Pass ${existing.passingScore}%` : ""}
                {existing.timeLimitSeconds
                  ? ` · ${Math.floor(existing.timeLimitSeconds / 60)} min limit`
                  : ""}
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                {existing.kind === "SURVEY" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void downloadSurveyExport(existing.id, `${existing.title.replace(/\s+/g, "-").toLowerCase()}-responses.csv`).catch(
                        () => toast.error("Failed to export survey responses"),
                      )
                    }
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Export CSV
                  </Button>
                )}
                {(existing.kind === "PRE" || existing.kind === "FINAL" || existing.kind === "SURVEY") && (
                  <EditAssessmentDialog assessment={existing} courseId={courseId} />
                )}
                <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  if (confirm("Remove this assessment?")) deleteAssessment.mutate(existing.id);
                }}
              >
                Remove
              </Button>
              </div>
            )}
          </div>
        </div>
      ))}
      {canEdit && (
          <CreateAssessmentDialog
            courseId={courseId}
            existingKinds={existingKinds}
            lessons={course?.lessons ?? []}
            linkedLessonIds={
              assessments?.filter((a) => a.kind === "MODULE_QUIZ" && a.lessonId).map((a) => a.lessonId!) ?? []
            }
          />
        )}
    </div>
  );
}

function CreateAssessmentDialog({
  courseId,
  existingKinds,
  lessons,
  linkedLessonIds,
}: CreateAssessmentDialogProps & {
  existingKinds: AssessmentKindOption[];
  lessons: Array<{ id: string; title: string; kind?: string; quizAssessmentId?: string | null }>;
  linkedLessonIds: string[];
}) {
  const createAssessment = useCreateAssessment(courseId);
  const { data: banks, isLoading: banksLoading } = useQuestionBanks();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const defaultKind = (): AssessmentKindOption => {
    if (!existingKinds.includes("FINAL")) return "FINAL";
    if (!existingKinds.includes("PRE")) return "PRE";
    return "SURVEY";
  };
  const [kind, setKind] = useState<AssessmentKindOption>(defaultKind());
  const [passingScore, setPassingScore] = useState("70");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [lessonId, setLessonId] = useState("");
  const [source, setSource] = useState<QuestionSource>("custom");
  const [bankId, setBankId] = useState("");
  const [drawCount, setDrawCount] = useState("10");
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);

  const moduleQuizLessons = useMemo(
    () =>
      lessons.filter(
        (lesson) =>
          lesson.kind === "QUIZ" &&
          !lesson.quizAssessmentId &&
          !linkedLessonIds.includes(lesson.id),
      ),
    [lessons, linkedLessonIds],
  );

  const kindOptions = useMemo(() => {
    const options: AssessmentKindOption[] = [];
    if (!existingKinds.includes("PRE")) options.push("PRE");
    if (!existingKinds.includes("FINAL")) options.push("FINAL");
    options.push("SURVEY");
    if (moduleQuizLessons.length) options.push("MODULE_QUIZ");
    return options;
  }, [existingKinds, moduleQuizLessons.length]);

  const selectedBank = banks?.find((b) => b.id === bankId);
  const maxDraw = selectedBank?.questionCount ?? 0;

  function resetForm() {
    setTitle("");
    setKind(defaultKind());
    setPassingScore("70");
    setMaxAttempts("3");
    setTimeLimitMinutes("");
    setAnonymous(false);
    setLessonId("");
    setSource("custom");
    setBankId("");
    setDrawCount("10");
    setQuestions([emptyQuestion()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (kind === "MODULE_QUIZ" && !lessonId) {
      toast.error("Select a lesson for the module quiz");
      return;
    }

    if (source === "bank") {
      if (!bankId) {
        toast.error("Select a question bank");
        return;
      }
      const draw = Number(drawCount);
      if (!draw || draw < 1) {
        toast.error("Draw count must be at least 1");
        return;
      }
      if (draw > maxDraw) {
        toast.error(`This bank only has ${maxDraw} question${maxDraw === 1 ? "" : "s"}`);
        return;
      }
    } else {
      const validQuestions = validQuestionDrafts(questions);
      if (!validQuestions.length) {
        toast.error("Add at least one valid question");
        return;
      }
    }

    try {
      await createAssessment.mutateAsync({
        title: title.trim(),
        kind,
        ...(kind === "SURVEY"
          ? { anonymous, maxAttempts: null }
          : {
              passingScore: Number(passingScore),
              maxAttempts: Number(maxAttempts),
            }),
        timeLimitSeconds: timeLimitMinutes ? Number(timeLimitMinutes) * 60 : null,
        ...(kind === "MODULE_QUIZ" ? { lessonId } : {}),
        ...(source === "bank"
          ? { bankId, drawCount: Number(drawCount) }
          : { questions: draftsToApiPayload(questions) }),
      });
      setOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create assessment");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add assessment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create assessment</DialogTitle>
            <DialogDescription>
              Add pre/final exams, surveys, or lesson-linked module quizzes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  const next = v as AssessmentKindOption;
                  setKind(next);
                  if (next === "MODULE_QUIZ" && moduleQuizLessons[0]) {
                    setLessonId(moduleQuizLessons[0].id);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kindOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "PRE"
                        ? "Pre-assessment"
                        : option === "FINAL"
                          ? "Final assessment"
                          : option === "SURVEY"
                            ? "Survey"
                            : "Module quiz"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {kind === "MODULE_QUIZ" && (
              <div className="space-y-2">
                <Label>Lesson</Label>
                <Select value={lessonId} onValueChange={setLessonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a quiz lesson" />
                  </SelectTrigger>
                  <SelectContent>
                    {moduleQuizLessons.map((lesson) => (
                      <SelectItem key={lesson.id} value={lesson.id}>
                        {lesson.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {kind === "SURVEY" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="accent-indigo"
                />
                Anonymous responses (export shows &quot;Anonymous&quot;)
              </label>
            )}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            {kind !== "SURVEY" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Passing score %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={passingScore}
                    onChange={(e) => setPassingScore(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max attempts</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Time limit (minutes, optional)</Label>
              <Input
                type="number"
                min={1}
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(e.target.value)}
                placeholder="No limit"
              />
            </div>

            <div className="space-y-2">
              <Label>Questions</Label>
              <Tabs
                value={source}
                onValueChange={(v) => setSource(v as QuestionSource)}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="custom">Custom questions</TabsTrigger>
                  <TabsTrigger value="bank">Question bank</TabsTrigger>
                </TabsList>

                <TabsContent value="custom" className="space-y-4">
                  <AssessmentQuestionEditor questions={questions} onChange={setQuestions} />
                </TabsContent>

                <TabsContent value="bank" className="space-y-4">
                  {banksLoading ? (
                    <p className="text-muted-foreground text-sm">Loading question banks…</p>
                  ) : banks?.length ? (
                    <>
                      <div className="space-y-2">
                        <Label>Question bank</Label>
                        <Select
                          value={bankId}
                          onValueChange={(v) => {
                            setBankId(v);
                            const bank = banks.find((b) => b.id === v);
                            if (bank && bank.questionCount > 0) {
                              setDrawCount(String(Math.min(10, bank.questionCount)));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a bank" />
                          </SelectTrigger>
                          <SelectContent>
                            {banks.map((bank) => (
                              <SelectItem key={bank.id} value={bank.id}>
                                {bank.name} ({bank.questionCount} questions)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Questions per attempt</Label>
                        <Input
                          type="number"
                          min={1}
                          max={maxDraw || undefined}
                          value={drawCount}
                          onChange={(e) => setDrawCount(e.target.value)}
                          disabled={!bankId}
                        />
                        {selectedBank && (
                          <p className="text-muted-foreground text-xs">
                            Each learner gets {drawCount || "?"} random question
                            {Number(drawCount) === 1 ? "" : "s"} from {selectedBank.name} (
                            {selectedBank.questionCount} available).
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm">
                      <p className="text-muted-foreground">
                        No question banks yet. Create one first, then link it here.
                      </p>
                      <Button asChild variant="link" className="mt-2 h-auto p-0">
                        <Link href="/question-banks">Go to question banks</Link>
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                createAssessment.isPending ||
                (source === "bank" && (!bankId || maxDraw === 0))
              }
            >
              {createAssessment.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating…
                </>
              ) : (
                "Create assessment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
