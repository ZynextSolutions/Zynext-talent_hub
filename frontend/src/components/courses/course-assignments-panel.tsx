"use client";

import { Loader2, Users } from "lucide-react";
import { AssignCourseDialog } from "@/components/courses/assign-course-dialog";
import { EditAssignmentDialog } from "@/components/courses/edit-assignment-dialog";
import { useCourseAssignments, useUnassignCourse } from "@/hooks/useCourses";
import { useOrgTree } from "@/hooks/useOrgTree";
import { assignmentTargetSummary } from "@/lib/org-targets";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CourseAssignmentsPanelProps {
  courseId: string;
}

export function CourseAssignmentsPanel({ courseId }: CourseAssignmentsPanelProps) {
  const { data: assignments, isLoading } = useCourseAssignments(courseId);
  const { data: orgTree } = useOrgTree(true);
  const unassign = useUnassignCourse(courseId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Active assignments</h3>
          <p className="text-muted-foreground text-xs">
            Rules that auto-enroll learners when they join a target org node.
          </p>
        </div>
        <AssignCourseDialog
          courseId={courseId}
          trigger={
            <Button size="sm">
              <Users className="mr-2 h-4 w-4" />
              Assign course
            </Button>
          }
        />
      </div>

      {!assignments?.length ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <Users className="text-muted-foreground mx-auto h-8 w-8 opacity-50" />
          <p className="mt-3 text-sm font-medium">No assignments yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            Assign this course to an org unit, team, or person to enroll learners automatically.
          </p>
          <div className="mt-4">
            <AssignCourseDialog courseId={courseId} />
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Target</TableHead>
                <TableHead className="hidden sm:table-cell">Learners</TableHead>
                <TableHead className="hidden sm:table-cell">Due</TableHead>
                <TableHead className="hidden md:table-cell">Reminder</TableHead>
                <TableHead className="hidden md:table-cell">Recertify</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => {
                const summary = assignmentTargetSummary(orgTree, a.targetType, a.targetId);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{summary.shortLabel}</span>
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {summary.typeLabel}
                          </Badge>
                        </div>
                        {summary.path && (
                          <p className="text-muted-foreground truncate text-xs">{summary.path}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                      {summary.memberCount != null
                        ? `${summary.memberCount} in scope`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                      {a.dueAt ? formatDate(a.dueAt) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                      {a.reminderDaysBefore != null
                        ? `${a.reminderDaysBefore} days before`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                      {a.recertifyEveryDays ? `${a.recertifyEveryDays} days` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <EditAssignmentDialog courseId={courseId} assignment={a} />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={unassign.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                "Remove this assignment rule? Learners already enrolled keep their progress.",
                              )
                            ) {
                              unassign.mutate(a.id);
                            }
                          }}
                        >
                          {unassign.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Remove"
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
