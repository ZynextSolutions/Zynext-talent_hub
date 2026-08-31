"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DueDateBadge, DueDateLine } from "@/components/learner/due-date-display";
import type { Enrollment } from "@/types";

export function EnrollmentCourseCard({
  enrollment,
  actionLabel = "Continue",
}: {
  enrollment: Enrollment;
  actionLabel?: string;
}) {
  const title = enrollment.course?.title ?? "Course";

  return (
    <Card className="flex h-full flex-col shadow-luxury">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{title}</h3>
          <DueDateBadge enrollment={enrollment} className="shrink-0" />
        </div>

        {enrollment.progressPercent > 0 ? (
          <div className="space-y-1.5">
            <Progress value={enrollment.progressPercent} className="h-1.5" />
            <p className="text-muted-foreground text-xs tabular-nums">{enrollment.progressPercent}% complete</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">Not started yet</p>
        )}

        <DueDateLine enrollment={enrollment} />
      </CardContent>
      <CardFooter className="border-t border-border/60 p-4 pt-0">
        <Button size="sm" className="w-full" asChild>
          <Link href={`/learn/${enrollment.courseId}`}>{actionLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
