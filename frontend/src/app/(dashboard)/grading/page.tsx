"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GradeAttemptCard } from "@/components/grading/grade-attempt-card";
import { usePendingReviewAttempts } from "@/hooks/useAssessments";
import type { PendingReviewAttempt } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";

export default function GradingPage() {
  const { data: attempts, isLoading } = usePendingReviewAttempts();
  const [gradedIds, setGradedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(
    () => attempts?.filter((a) => !gradedIds.has(a.id)) ?? [],
    [attempts, gradedIds],
  );

  const selected = visible.find((a) => a.id === selectedId) ?? visible[0] ?? null;

  useEffect(() => {
    if (!visible.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visible.some((a) => a.id === selectedId)) {
      setSelectedId(visible[0]!.id);
    }
  }, [visible, selectedId]);

  function handleGraded(attemptId: string) {
    setGradedIds((prev) => new Set(prev).add(attemptId));
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Grading queue"
        description="Review short-answer submissions and set a final score."
        actions={
          visible.length > 0 ? (
            <Badge variant="secondary">{visible.length} pending</Badge>
          ) : undefined
        }
      />

      <div className="flex-1 px-6 py-4">
        {isLoading ? (
          <Skeleton className="h-64 w-full max-w-5xl" />
        ) : visible.length ? (
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
            <div className="rounded-xl border border-border bg-card shadow-luxury">
              <div className="border-b border-border px-3 py-2">
                <p className="text-sm font-medium">Queue</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8">Learner</TableHead>
                    <TableHead className="hidden h-8 sm:table-cell">Assessment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((attempt) => (
                    <QueueRow
                      key={attempt.id}
                      attempt={attempt}
                      active={selected?.id === attempt.id}
                      onSelect={() => setSelectedId(attempt.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="min-w-0">
              {selected ? (
                <GradeAttemptCard
                  key={selected.id}
                  attempt={selected}
                  onGraded={() => handleGraded(selected.id)}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
            <ClipboardCheck className="text-muted-foreground h-10 w-10" />
            <p className="font-medium">All caught up</p>
            <p className="text-muted-foreground text-sm">
              Attempts appear here when a learner submits an assessment with short-answer questions
              that need manual review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function QueueRow({
  attempt,
  active,
  onSelect,
}: {
  attempt: PendingReviewAttempt;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <TableRow
      className={cn("cursor-pointer", active && "bg-muted/50")}
      onClick={onSelect}
    >
      <TableCell className="py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {attempt.user.firstName} {attempt.user.lastName}
          </p>
          <p className="text-muted-foreground truncate text-xs">{formatDate(attempt.submittedAt)}</p>
          <p className="truncate text-xs sm:hidden">{attempt.assessment.title}</p>
        </div>
      </TableCell>
      <TableCell className="hidden max-w-[10rem] truncate py-2 text-xs sm:table-cell">
        {attempt.assessment.title}
      </TableCell>
    </TableRow>
  );
}
