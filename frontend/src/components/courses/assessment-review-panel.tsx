"use client";

import Link from "next/link";
import { Award, CheckCircle2, Clock, Loader2, MessageSquare, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttemptReview } from "@/hooks/useAssessments";
import type { AttemptReviewItem } from "@/types";
import { cn } from "@/lib/utils";

interface AssessmentReviewPanelProps {
  assessmentId: string;
  attemptId: string;
  kind?: "PRE" | "FINAL";
  canRetake?: boolean;
  onRetake?: () => void;
  onBack?: () => void;
}

function formatLearnerAnswer(item: AttemptReviewItem): string {
  if (!item.learnerAnswer) return "No answer";
  if (item.type === "SHORT_ANSWER" || item.type === "ESSAY") {
    return item.learnerAnswer.text?.trim() || "No answer";
  }
  if (item.type === "FILL_BLANK") {
    const blanks = item.learnerAnswer.blanks ?? [];
    if (!blanks.length) return "No answer";
    return blanks.map((b) => b.text.trim() || "—").join(", ");
  }
  if (item.type === "MATCHING") {
    const leftItems = Array.isArray(item.metadata?.leftItems)
      ? (item.metadata!.leftItems as Array<{ id: string; text: string }>)
      : [];
    const rightItems = Array.isArray(item.metadata?.rightItems)
      ? (item.metadata!.rightItems as Array<{ id: string; text: string }>)
      : [];
    const matches = item.learnerAnswer.matches ?? [];
    if (!matches.length) return "No answer";
    return matches
      .map((m) => {
        const left = leftItems.find((l) => l.id === m.leftId)?.text ?? m.leftId;
        const right = rightItems.find((r) => r.id === m.rightId)?.text ?? "—";
        return `${left} → ${right}`;
      })
      .join("; ");
  }
  if (item.type === "MULTI_SELECT") {
    const ids = item.learnerAnswer.optionIds ?? [];
    if (!ids.length) return "No answer";
    return ids
      .map((id) => item.options.find((o) => o.id === id)?.text ?? id)
      .join(", ");
  }
  const opt = item.options.find((o) => o.id === item.learnerAnswer?.optionId);
  return opt?.text ?? "No answer";
}

function formatCorrectAnswer(item: AttemptReviewItem): string | null {
  if (item.type === "SHORT_ANSWER") return null;
  if (item.type === "MULTI_SELECT" && item.correctOptionIds?.length) {
    return item.correctOptionIds
      .map((id) => item.options.find((o) => o.id === id)?.text ?? id)
      .join(", ");
  }
  if (item.correctOptionId) {
    return item.options.find((o) => o.id === item.correctOptionId)?.text ?? null;
  }
  return null;
}

function ResultBadge({ correct }: { correct: boolean | null }) {
  if (correct === null) {
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        Pending review
      </Badge>
    );
  }
  if (correct) {
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        Correct
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />
      Incorrect
    </Badge>
  );
}

export function AssessmentReviewPanel({
  assessmentId,
  attemptId,
  kind = "FINAL",
  canRetake,
  onRetake,
  onBack,
}: AssessmentReviewPanelProps) {
  const { data: review, isLoading, isError } = useAttemptReview(assessmentId, attemptId);

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (isError || !review) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-8 text-center text-sm">
          Could not load attempt review.
        </CardContent>
      </Card>
    );
  }

  const { attempt, assessment, items, showAnswers } = review;
  const pending = attempt.gradingStatus === "PENDING_REVIEW";
  const expired = attempt.gradingStatus === "EXPIRED";

  return (
    <Card className={cn("shadow-luxury", attempt.passed && "border-emerald-500/30 bg-emerald-500/5")}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{assessment.title}</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Attempt {attempt.attemptNumber}
              {attempt.submittedAt
                ? ` · Submitted ${new Date(attempt.submittedAt).toLocaleString()}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pending && <Badge variant="secondary">Awaiting instructor</Badge>}
            {expired && <Badge variant="destructive">Time expired</Badge>}
            {attempt.passed && !pending && (
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                <Award className="h-3 w-3" />
                Passed
              </Badge>
            )}
            {!attempt.passed && !pending && attempt.score != null && (
              <Badge variant="destructive">Not passing</Badge>
            )}
          </div>
        </div>
        {attempt.score != null && (
          <p className="text-lg font-semibold">
            Score: {attempt.score}% <span className="text-muted-foreground font-normal text-sm">(pass {assessment.passingScore}%)</span>
          </p>
        )}
        {attempt.instructorFeedback && (
          <div className="bg-muted/50 mt-3 flex gap-2 rounded-lg border p-3 text-sm">
            <MessageSquare className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Instructor feedback</p>
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{attempt.instructorFeedback}</p>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {items.map((item, idx) => {
          const correctText = showAnswers ? formatCorrectAnswer(item) : null;
          return (
            <div key={item.questionId} className="space-y-2 border-b border-border pb-6 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">
                  {idx + 1}. {item.prompt}
                </p>
                <ResultBadge correct={item.correct} />
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Your answer: </span>
                  {formatLearnerAnswer(item)}
                </p>
                {showAnswers && correctText && (
                  <p>
                    <span className="text-muted-foreground">Correct answer: </span>
                    <span className="text-emerald-700 dark:text-emerald-400">{correctText}</span>
                  </p>
                )}
                {showAnswers && item.explanation && (
                  <p className="text-muted-foreground text-sm">{item.explanation}</p>
                )}
              </div>
              {showAnswers && item.type !== "SHORT_ANSWER" && item.type !== "ESSAY" && item.type !== "FILL_BLANK" && item.type !== "MATCHING" && (
                <div className="space-y-1">
                  {item.options.map((opt) => {
                    const selected =
                      item.learnerAnswer?.optionId === opt.id ||
                      item.learnerAnswer?.optionIds?.includes(opt.id);
                    const isCorrect =
                      opt.id === item.correctOptionId ||
                      item.correctOptionIds?.includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm",
                          selected && "border-indigo bg-indigo/10",
                          showAnswers && isCorrect && "border-emerald-500/50 bg-emerald-500/10",
                        )}
                      >
                        {opt.text}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2 pt-2">
          {canRetake && onRetake && (
            <Button onClick={onRetake}>Try again</Button>
          )}
          {attempt.passed && kind === "FINAL" && (
            <Button asChild variant={canRetake ? "outline" : "default"}>
              <Link href="/certificates">View certificate</Link>
            </Button>
          )}
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
