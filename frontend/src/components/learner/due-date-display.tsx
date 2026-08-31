"use client";

import { AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { enrollmentDueLabel, type EnrollmentDueFields } from "@/lib/enrollment-due";
import { cn } from "@/lib/utils";

export function DueDateBadge({
  enrollment,
  className,
}: {
  enrollment: EnrollmentDueFields;
  className?: string;
}) {
  if (!enrollment.dueAt) return null;
  if (enrollment.isOverdue) {
    return (
      <Badge variant="destructive" className={cn("text-[10px]", className)}>
        Overdue
      </Badge>
    );
  }
  if (enrollment.isDueSoon) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400",
          className,
        )}
      >
        Due soon
      </Badge>
    );
  }
  return null;
}

export function DueDateLine({
  enrollment,
  className,
}: {
  enrollment: EnrollmentDueFields;
  className?: string;
}) {
  const label = enrollmentDueLabel(enrollment);
  if (!label) return null;

  return (
    <p className={cn("text-muted-foreground flex items-center gap-1.5 text-xs", className)}>
      {enrollment.isOverdue ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
      ) : (
        <Clock className="h-3.5 w-3.5 shrink-0" />
      )}
      {label}
    </p>
  );
}
