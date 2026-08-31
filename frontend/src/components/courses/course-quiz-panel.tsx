"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AssessmentReviewPanel } from "@/components/courses/assessment-review-panel";
import {
  useAssessment,
  useAssessmentAttempts,
  useCourseAssessments,
  useExpireAssessment,
  useStartAssessment,
  useSubmitAssessment,
} from "@/hooks/useAssessments";
import type { AssessmentQuestion, AssessmentSubmitResult } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CourseQuizPanelProps {
  courseId: string;
  enrollmentId: string;
  lessonsComplete: boolean;
  kind?: "PRE" | "FINAL" | "SURVEY" | "MODULE_QUIZ";
  assessmentId?: string;
}

function Countdown({ expiresAt, onExpired }: { expiresAt: string; onExpired?: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      const next = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(next);
      if (next === 0) onExpired?.();
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return (
    <span className={cn("font-mono text-sm tabular-nums", remaining < 60000 && "text-destructive")}>
      Time left: {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

export function CourseQuizPanel({
  courseId,
  enrollmentId,
  lessonsComplete,
  kind = "FINAL",
  assessmentId: assessmentIdProp,
}: CourseQuizPanelProps) {
  const { data: assessments, isLoading: listLoading } = useCourseAssessments(courseId);
  const targetAssessment = assessmentIdProp
    ? assessments?.find((a) => a.id === assessmentIdProp)
    : assessments?.find((a) => a.kind === kind) ??
      (kind === "FINAL" ? assessments?.find((a) => a.kind === "FINAL") ?? assessments?.[0] : undefined);
  const assessmentId = assessmentIdProp ?? targetAssessment?.id;
  const resolvedKind = targetAssessment?.kind ?? kind;
  const isSurvey = resolvedKind === "SURVEY";
  const { data: assessment, isLoading: detailLoading } = useAssessment(assessmentId);
  const { data: attempts } = useAssessmentAttempts(assessmentId);
  const start = useStartAssessment(assessmentId ?? "");
  const expire = useExpireAssessment(assessmentId ?? "");
  const submit = useSubmitAssessment(assessmentId ?? "");

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string[]>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [blankAnswers, setBlankAnswers] = useState<Record<string, Record<string, string>>>({});
  const [matchAnswers, setMatchAnswers] = useState<Record<string, Record<string, string>>>({});
  const [attemptId, setAttemptId] = useState<string | undefined>();
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [liveQuestions, setLiveQuestions] = useState<AssessmentQuestion[] | null>(null);
  const [expired, setExpired] = useState(false);
  const [result, setResult] = useState<(AssessmentSubmitResult & { pendingReview?: boolean; survey?: boolean }) | null>(null);
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);

  const sortedQuestions = useMemo(() => {
    const source = liveQuestions ?? assessment?.questions ?? [];
    return source.slice().sort((a, b) => a.order - b.order);
  }, [liveQuestions, assessment?.questions]);

  const passedAttempt = !isSurvey ? attempts?.find((a) => a.passed) : undefined;
  const attemptsUsed = attempts?.length ?? 0;
  const maxAttempts = assessment?.maxAttempts;
  const timed = Boolean(assessment?.timeLimitSeconds);
  const needsStart = !started && !assessment?.activeAttempt;
  const canAttempt =
    isSurvey ||
    (!passedAttempt &&
      !result?.attempt.passed &&
      (maxAttempts == null || attemptsUsed < maxAttempts));

  useEffect(() => {
    if (assessment?.activeAttempt) {
      setAttemptId(assessment.activeAttempt.id);
      setExpiresAt(assessment.activeAttempt.expiresAt ?? null);
      setStarted(true);
      if (assessment.questions?.length) setLiveQuestions(assessment.questions);
    }
  }, [assessment?.activeAttempt, assessment?.questions]);

  useEffect(() => {
    if (result?.attempt.id) {
      setReviewAttemptId(result.attempt.id);
    }
  }, [result?.attempt.id]);

  function resetForRetake() {
    setReviewAttemptId(null);
    setResult(null);
    setStarted(false);
    setAttemptId(undefined);
    setExpiresAt(null);
    setLiveQuestions(null);
    setAnswers({});
    setMultiAnswers({});
    setTextAnswers({});
    setBlankAnswers({});
    setMatchAnswers({});
    setExpired(false);
  }

  if (listLoading || detailLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (!assessment) {
    if (kind === "PRE" || isSurvey) return null;
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-medium">Course complete</p>
          <p className="text-muted-foreground text-sm">No assessment required for this course.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/certificates">View certificates</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (resolvedKind === "FINAL" && !lessonsComplete) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-8 text-center text-sm">
          Complete all lessons before taking the final assessment.
        </CardContent>
      </Card>
    );
  }

  if (result?.survey) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-medium">Thank you for your responses</p>
          <p className="text-muted-foreground text-sm">Your survey has been submitted.</p>
          <Button variant="outline" size="sm" onClick={resetForRetake}>
            Submit another response
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (reviewAttemptId && assessmentId && !isSurvey) {
    return (
      <div className="space-y-4">
        <AssessmentReviewPanel
          assessmentId={assessmentId}
          attemptId={reviewAttemptId}
          kind={resolvedKind === "PRE" || resolvedKind === "FINAL" ? resolvedKind : "FINAL"}
          canRetake={canAttempt && !result?.pendingReview}
          onRetake={resetForRetake}
        />
        {(attempts?.length ?? 0) > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Attempt history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {attempts?.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setReviewAttemptId(a.id)}
                  className={cn(
                    "hover:bg-muted/50 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    reviewAttemptId === a.id && "border-indigo bg-indigo/10",
                  )}
                >
                  <span>Attempt {a.attemptNumber}</span>
                  <span className="text-muted-foreground">
                    {a.gradingStatus === "PENDING_REVIEW"
                      ? "Pending review"
                      : a.score != null
                        ? `${a.score}%${a.passed ? " · Passed" : ""}`
                        : a.gradingStatus === "EXPIRED"
                          ? "Expired"
                          : "—"}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (!canAttempt && attempts?.length) {
    return (
      <div className="space-y-4">
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium">Maximum attempts reached</p>
            <Button variant="outline" size="sm" onClick={() => setReviewAttemptId(attempts[0].id)}>
              View last attempt
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (passedAttempt && !reviewAttemptId) {
    return (
      <div className="space-y-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="font-medium">
              {kind === "PRE" ? "Pre-assessment" : "Assessment"} passed — {passedAttempt.score ?? 0}%
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setReviewAttemptId(passedAttempt.id)}>
                View results
              </Button>
              {kind === "FINAL" && (
                <Button asChild size="sm">
                  <Link href="/certificates">View certificate</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        {(attempts?.length ?? 0) > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Attempt history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {attempts?.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setReviewAttemptId(a.id)}
                  className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                >
                  <span>Attempt {a.attemptNumber}</span>
                  <span className="text-muted-foreground">
                    {a.score != null ? `${a.score}%${a.passed ? " · Passed" : ""}` : "—"}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  async function handleTimeExpired() {
    if (!assessmentId || expired) return;
    setExpired(true);
    try {
      const data = await expire.mutateAsync({ enrollmentId });
      toast.error("Time is up for this attempt");
      setStarted(false);
      setAttemptId(undefined);
      setExpiresAt(null);
      setLiveQuestions(null);
      setAnswers({});
      setMultiAnswers({});
      setTextAnswers({});
      setBlankAnswers({});
      setMatchAnswers({});
      if (data.attempt?.id) setReviewAttemptId(data.attempt.id);
    } catch {
      toast.error("Could not close timed attempt — refresh and try again");
    }
  }

  async function handleStart() {
    if (!assessmentId) return;
    const data = await start.mutateAsync({ enrollmentId });
    setAttemptId(data.attempt.id);
    setExpiresAt(data.expiresAt);
    setLiveQuestions(data.questions);
    setStarted(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assessmentId) return;
    if (!attemptId) {
      toast.error("Start the assessment before submitting");
      return;
    }
    const payload = sortedQuestions.map((q) => {
      if (q.type === "SHORT_ANSWER" || q.type === "ESSAY") {
        return { questionId: q.id, text: textAnswers[q.id] ?? "" };
      }
      if (q.type === "FILL_BLANK") {
        const blanks = Array.isArray(q.metadata?.blanks)
          ? (q.metadata!.blanks as Array<{ id: string }>)
          : [];
        return {
          questionId: q.id,
          blanks: blanks.map((b) => ({
            blankId: b.id,
            text: blankAnswers[q.id]?.[b.id] ?? "",
          })),
        };
      }
      if (q.type === "MATCHING") {
        const leftItems = Array.isArray(q.metadata?.leftItems)
          ? (q.metadata!.leftItems as Array<{ id: string }>)
          : [];
        return {
          questionId: q.id,
          matches: leftItems.map((left) => ({
            leftId: left.id,
            rightId: matchAnswers[q.id]?.[left.id] ?? "",
          })),
        };
      }
      if (q.type === "MULTI_SELECT") {
        return { questionId: q.id, optionIds: multiAnswers[q.id] ?? [] };
      }
      return { questionId: q.id, optionId: answers[q.id] ?? "" };
    });
    if (
      !isSurvey &&
      payload.some((a) => {
        if ("text" in a && a.text?.trim()) return false;
        if ("optionId" in a && a.optionId) return false;
        if ("optionIds" in a && a.optionIds?.length) return false;
        if ("blanks" in a && a.blanks?.every((b) => b.text.trim())) return false;
        if ("matches" in a && a.matches?.every((m) => m.rightId)) return false;
        return true;
      })
    ) {
      toast.error("Answer every question before submitting");
      return;
    }
    const data = await submit.mutateAsync({
      enrollmentId,
      attemptId,
      answers: payload,
    });
    setResult(data);
    setStarted(false);
    setAttemptId(undefined);
    setExpiresAt(null);
    setLiveQuestions(null);
  }

  if (needsStart && !started) {
    return (
      <div className="space-y-4">
        {(attempts?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Previous attempts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {attempts?.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setReviewAttemptId(a.id)}
                  className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                >
                  <span>Attempt {a.attemptNumber}</span>
                  <span className="text-muted-foreground">
                    {a.gradingStatus === "PENDING_REVIEW"
                      ? "Pending review"
                      : a.score != null
                        ? `${a.score}%`
                        : a.gradingStatus === "EXPIRED"
                          ? "Expired"
                          : "—"}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{assessment.title}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {resolvedKind === "PRE"
                ? "Pre-assessment · "
                : resolvedKind === "SURVEY"
                  ? "Survey · "
                  : resolvedKind === "MODULE_QUIZ"
                    ? "Module quiz · "
                    : ""}
              {isSurvey
                ? `${assessment.questionCount ?? 0} question(s)`
                : timed
                  ? `Timed assessment · ${Math.floor((assessment.timeLimitSeconds ?? 0) / 60)} minutes`
                  : assessment.bankId
                    ? "Questions are drawn when you start"
                    : `${assessment.questionCount ?? 0} question(s) · start when ready`}
            </p>
          </CardHeader>
          <CardContent>
            <Button onClick={handleStart} disabled={start.isPending}>
              {start.isPending ? <Loader2 className="animate-spin" /> : isSurvey ? "Start survey" : "Start assessment"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (expired && !started) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="font-medium">Time expired</p>
          <p className="text-muted-foreground text-sm">This attempt was closed. You can start again if attempts remain.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setExpired(false);
            }}
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-luxury">
      <CardHeader>
        <CardTitle className="text-base">{assessment.title}</CardTitle>
        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
          <span>
            {resolvedKind === "PRE"
              ? "Pre-assessment · "
              : resolvedKind === "SURVEY"
                ? "Survey · "
                : resolvedKind === "MODULE_QUIZ"
                  ? "Module quiz · "
                  : ""}
            {!isSurvey && (
              <>
                Pass {assessment.passingScore}%
                {maxAttempts != null
                  ? ` · Attempt ${attemptsUsed + 1} of ${maxAttempts}`
                  : ` · Attempt ${attemptsUsed + 1}`}
              </>
            )}
          </span>
          {expiresAt && (
            <Countdown expiresAt={expiresAt} onExpired={() => void handleTimeExpired()} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {sortedQuestions.map((q, idx) => {
            const blankItems = Array.isArray(q.metadata?.blanks)
              ? (q.metadata!.blanks as Array<{ id: string }>)
              : [];
            const leftItems = Array.isArray(q.metadata?.leftItems)
              ? (q.metadata!.leftItems as Array<{ id: string; text: string }>)
              : [];
            const rightItems = Array.isArray(q.metadata?.rightItems)
              ? (q.metadata!.rightItems as Array<{ id: string; text: string }>)
              : [];
            return (
            <div key={q.id} className="space-y-3">
              <p className="font-medium">
                {idx + 1}. {q.prompt}
                {q.points != null && q.points !== 1 ? (
                  <span className="text-muted-foreground ml-2 text-sm font-normal">({q.points} pts)</span>
                ) : null}
              </p>
              {q.type === "SHORT_ANSWER" || q.type === "ESSAY" ? (
                <textarea
                  className="border-border min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
                  value={textAnswers[q.id] ?? ""}
                  onChange={(e) => setTextAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.type === "ESSAY" ? "Write your essay response" : "Your answer"}
                />
              ) : q.type === "FILL_BLANK" ? (
                <div className="space-y-2">
                  {blankItems.map((blank, blankIdx) => (
                    <Input
                      key={blank.id}
                      value={blankAnswers[q.id]?.[blank.id] ?? ""}
                      onChange={(e) =>
                        setBlankAnswers((prev) => ({
                          ...prev,
                          [q.id]: { ...(prev[q.id] ?? {}), [blank.id]: e.target.value },
                        }))
                      }
                      placeholder={`Blank ${blankIdx + 1}`}
                    />
                  ))}
                </div>
              ) : q.type === "MATCHING" ? (
                <div className="space-y-2">
                  {leftItems.map((left) => (
                    <div key={left.id} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                      <span className="rounded-lg border px-3 py-2 text-sm">{left.text}</span>
                      <select
                        className="border-border rounded-lg border px-3 py-2 text-sm"
                        value={matchAnswers[q.id]?.[left.id] ?? ""}
                        onChange={(e) =>
                          setMatchAnswers((prev) => ({
                            ...prev,
                            [q.id]: { ...(prev[q.id] ?? {}), [left.id]: e.target.value },
                          }))
                        }
                      >
                        <option value="">Select match</option>
                        {rightItems.map((right) => (
                          <option key={right.id} value={right.id}>
                            {right.text}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : q.type === "MULTI_SELECT" ? (
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const selected = multiAnswers[q.id]?.includes(opt.id) ?? false;
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm transition-colors",
                          selected && "border-indigo bg-indigo/10",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            setMultiAnswers((prev) => {
                              const current = prev[q.id] ?? [];
                              const next = selected
                                ? current.filter((id) => id !== opt.id)
                                : [...current, opt.id];
                              return { ...prev, [q.id]: next };
                            });
                          }}
                          className="accent-indigo"
                        />
                        {opt.text}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <label
                      key={opt.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm transition-colors",
                        answers[q.id] === opt.id && "border-indigo bg-indigo/10",
                      )}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.id}
                        checked={answers[q.id] === opt.id}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                        className="accent-indigo"
                      />
                      {opt.text}
                    </label>
                  ))}
                </div>
              )}
            </div>
            );
          })}
          <Button type="submit" disabled={submit.isPending || expire.isPending}>
            {submit.isPending ? <Loader2 className="animate-spin" /> : isSurvey ? "Submit responses" : "Submit assessment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
