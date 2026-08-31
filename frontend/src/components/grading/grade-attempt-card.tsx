"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useGradeAttempt } from "@/hooks/useAssessments";
import type { AssessmentQuestion, PendingReviewAttempt } from "@/types";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  MCQ: "Multiple choice",
  TRUE_FALSE: "True / False",
  MULTI_SELECT: "Multi-select",
  SHORT_ANSWER: "Short answer",
};

function formatAnswer(
  question: AssessmentQuestion,
  answer: PendingReviewAttempt["answers"][number] | undefined,
): string {
  if (!answer) return "—";
  if (question.type === "SHORT_ANSWER") return answer.text?.trim() || "—";
  if (question.type === "MULTI_SELECT") {
    const ids = answer.optionIds ?? [];
    const labels = ids
      .map((id) => question.options.find((o) => o.id === id)?.text)
      .filter(Boolean);
    return labels.length ? labels.join(", ") : "—";
  }
  const opt = question.options.find((o) => o.id === answer.optionId);
  return opt?.text ?? "—";
}

interface GradeAttemptCardProps {
  attempt: PendingReviewAttempt;
  onGraded: () => void;
}

export function GradeAttemptCard({ attempt, onGraded }: GradeAttemptCardProps) {
  const grade = useGradeAttempt();
  const passingScore = attempt.assessment.passingScore;
  const [score, setScore] = useState(
    attempt.score != null ? String(attempt.score) : "",
  );
  const [feedback, setFeedback] = useState("");
  const [showAutoGraded, setShowAutoGraded] = useState(false);

  const numericScore = score === "" ? null : Number(score);
  const willPass = numericScore != null && numericScore >= passingScore;
  const sortedQuestions = attempt.questions.slice().sort((a, b) => a.order - b.order);
  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const manualQuestions = sortedQuestions.filter((q) => q.type === "SHORT_ANSWER");
  const autoQuestions = sortedQuestions.filter((q) => q.type !== "SHORT_ANSWER");

  async function handleSubmit() {
    if (numericScore == null || Number.isNaN(numericScore)) return;
    await grade.mutateAsync({
      attemptId: attempt.id,
      score: numericScore,
      passed: numericScore >= passingScore,
      instructorFeedback: feedback.trim() || undefined,
    });
    onGraded();
  }

  return (
    <Card className="shadow-luxury">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{attempt.assessment.title}</CardTitle>
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {attempt.user.firstName} {attempt.user.lastName} · {attempt.user.email}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">Attempt {attempt.attemptNumber}</Badge>
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          <span>Submitted {new Date(attempt.submittedAt).toLocaleString()}</span>
          <span>Passing: {passingScore}%</span>
          {attempt.score != null && <span>Auto portion: {attempt.score}%</span>}
          <Link href={`/courses/${attempt.assessment.courseId}`} className="text-primary hover:underline">
            View course
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {manualQuestions.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Needs manual review</h3>
            {manualQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {idx + 1}. {q.prompt}
                  </span>
                  <Badge variant="outline">{TYPE_LABELS[q.type ?? "SHORT_ANSWER"]}</Badge>
                </div>
                <p className="rounded-md border border-border bg-background px-3 py-2 text-sm whitespace-pre-wrap">
                  {formatAnswer(q, answerMap.get(q.id))}
                </p>
              </div>
            ))}
          </section>
        )}

        {autoQuestions.length > 0 && (
          <section className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8 px-2"
              onClick={() => setShowAutoGraded((v) => !v)}
            >
              {showAutoGraded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Auto-graded ({autoQuestions.length})
            </Button>
            {showAutoGraded &&
              autoQuestions.map((q, idx) => {
              const ans = answerMap.get(q.id);
              const selected = formatAnswer(q, ans);
              const correct =
                q.type === "MULTI_SELECT"
                  ? (q.correctOptionIds ?? []).slice().sort().join(",") ===
                    (ans?.optionIds ?? []).slice().sort().join(",")
                  : ans?.optionId === q.correctOptionId;
              return (
                <div key={q.id} className="rounded-lg border border-border p-2.5 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="line-clamp-2 font-medium">
                      {idx + 1}. {q.prompt}
                    </span>
                    {correct != null && (
                      correct ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )
                    )}
                  </div>
                  <p>
                    <span className="text-muted-foreground">Answer: </span>
                    {selected}
                  </p>
                </div>
              );
            })}
          </section>
        )}

        <section className="space-y-3 border-t border-border pt-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`score-${attempt.id}`}>Final score %</Label>
              <Input
                id={`score-${attempt.id}`}
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="0–100"
              />
              {numericScore != null && !Number.isNaN(numericScore) && (
                <p
                  className={cn(
                    "text-xs font-medium",
                    willPass ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {willPass ? "Will pass" : "Will not pass"} (needs {passingScore}%)
                </p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`feedback-${attempt.id}`}>Feedback for learner (optional)</Label>
              <textarea
                id={`feedback-${attempt.id}`}
                className="border-border min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Comments visible after grading…"
                maxLength={2000}
              />
            </div>
          </div>
          <Button
            disabled={
              grade.isPending ||
              score === "" ||
              numericScore == null ||
              Number.isNaN(numericScore) ||
              numericScore < 0 ||
              numericScore > 100
            }
            onClick={handleSubmit}
          >
            {grade.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              "Submit grade"
            )}
          </Button>
        </section>
      </CardContent>
    </Card>
  );
}
