"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil } from "lucide-react";
import { AssessmentQuestionEditor } from "@/components/courses/assessment-question-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAssessment, useUpdateAssessment } from "@/hooks/useAssessments";
import { useQuestionBanks } from "@/hooks/useQuestionBanks";
import {
  apiQuestionsToDraft,
  draftsToApiPayload,
  emptyQuestion,
  validQuestionDrafts,
  type QuestionDraft,
} from "@/lib/assessment-question-draft";
import { ApiClientError } from "@/lib/api-client";
import type { Assessment } from "@/types";
import { toast } from "sonner";

interface EditAssessmentDialogProps {
  assessment: Assessment;
  courseId: string;
}

export function EditAssessmentDialog({ assessment, courseId }: EditAssessmentDialogProps) {
  const updateAssessment = useUpdateAssessment();
  const { data: banks, isLoading: banksLoading } = useQuestionBanks();
  const [open, setOpen] = useState(false);
  const { data: fullAssessment, isLoading: loadingDetail } = useAssessment(open ? assessment.id : undefined);

  const isBankBased = Boolean(assessment.bankId);
  const detail = fullAssessment ?? assessment;

  const [title, setTitle] = useState(assessment.title);
  const [passingScore, setPassingScore] = useState(String(assessment.passingScore));
  const [maxAttempts, setMaxAttempts] = useState(
    assessment.maxAttempts != null ? String(assessment.maxAttempts) : "",
  );
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    assessment.timeLimitSeconds ? String(Math.floor(assessment.timeLimitSeconds / 60)) : "",
  );
  const [bankId, setBankId] = useState(assessment.bankId ?? "");
  const [drawCount, setDrawCount] = useState(
    assessment.drawCount != null ? String(assessment.drawCount) : "10",
  );
  const [drawTags, setDrawTags] = useState((assessment.drawTags ?? []).join(", "));
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);

  const selectedBank = banks?.find((b) => b.id === bankId);
  const maxDraw = selectedBank?.questionCount ?? 0;

  useEffect(() => {
    if (!open) return;
    setTitle(detail.title);
    setPassingScore(String(detail.passingScore));
    setMaxAttempts(detail.maxAttempts != null ? String(detail.maxAttempts) : "");
    setTimeLimitMinutes(
      detail.timeLimitSeconds ? String(Math.floor(detail.timeLimitSeconds / 60)) : "",
    );
    setBankId(detail.bankId ?? "");
    setDrawCount(detail.drawCount != null ? String(detail.drawCount) : "10");
    setDrawTags((detail.drawTags ?? []).join(", "));
    if (detail.questions?.length) {
      setQuestions(apiQuestionsToDraft(detail.questions));
    } else if (!detail.bankId) {
      setQuestions([emptyQuestion()]);
    }
  }, [open, detail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload: Parameters<typeof updateAssessment.mutateAsync>[0] = {
      id: assessment.id,
      courseId,
      title: title.trim(),
      passingScore: Number(passingScore),
      maxAttempts: maxAttempts ? Number(maxAttempts) : null,
      timeLimitSeconds: timeLimitMinutes ? Number(timeLimitMinutes) * 60 : null,
    };

    if (isBankBased || bankId) {
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
      payload.bankId = bankId;
      payload.drawCount = draw;
      const tags = drawTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      payload.drawTags = tags;
    } else {
      const valid = validQuestionDrafts(questions);
      if (!valid.length) {
        toast.error("Add at least one valid question");
        return;
      }
      payload.questions = draftsToApiPayload(questions);
    }

    try {
      await updateAssessment.mutateAsync(payload);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update assessment");
    }
  }

  const loadingQuestions = open && !isBankBased && loadingDetail;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit assessment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
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
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Time limit (minutes)</Label>
              <Input
                type="number"
                min={1}
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(e.target.value)}
                placeholder="No limit"
              />
            </div>

            {isBankBased ? (
              <div className="space-y-4 rounded-lg border border-border p-4">
                <p className="text-muted-foreground text-sm">
                  Questions are drawn from a question bank on each attempt. Edit the bank for question content.
                </p>
                {banksLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : banks?.length ? (
                  <>
                    <div className="space-y-2">
                      <Label>Question bank</Label>
                      <Select value={bankId} onValueChange={setBankId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bank" />
                        </SelectTrigger>
                        <SelectContent>
                          {banks.map((bank) => (
                            <SelectItem key={bank.id} value={bank.id}>
                              {bank.name} ({bank.questionCount})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Draw count</Label>
                      <Input
                        type="number"
                        min={1}
                        max={maxDraw || undefined}
                        value={drawCount}
                        onChange={(e) => setDrawCount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Draw tags (optional)</Label>
                      <Input
                        value={drawTags}
                        onChange={(e) => setDrawTags(e.target.value)}
                        placeholder="safety, compliance"
                      />
                      <p className="text-muted-foreground text-xs">
                        Comma-separated tags to filter bank questions before random draw.
                      </p>
                    </div>
                    {bankId && (
                      <Button type="button" variant="link" className="h-auto p-0" asChild>
                        <Link href={`/question-banks/${bankId}`}>Edit questions in bank</Link>
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No question banks yet.{" "}
                    <Link href="/question-banks" className="text-indigo underline">
                      Create one
                    </Link>
                  </p>
                )}
              </div>
            ) : loadingQuestions ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-2">
                <Label>Questions</Label>
                <AssessmentQuestionEditor questions={questions} onChange={setQuestions} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateAssessment.isPending || loadingQuestions || !title.trim()}>
              {updateAssessment.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
