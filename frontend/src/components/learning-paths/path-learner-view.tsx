"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  GitBranch,
  Loader2,
  Lock,
  PlayCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useEnrollLearningPath,
  usePathLearnerProgress,
} from "@/hooks/useLearningPaths";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { PathCourseLearnerState } from "@/types";

function stateLabel(state: PathCourseLearnerState) {
  switch (state) {
    case "COMPLETED":
      return "Completed";
    case "IN_PROGRESS":
      return "In progress";
    case "NOT_STARTED":
      return "Ready to start";
    default:
      return "Locked";
  }
}

function stateIcon(state: PathCourseLearnerState) {
  switch (state) {
    case "COMPLETED":
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />;
    case "IN_PROGRESS":
      return <PlayCircle className="h-5 w-5 shrink-0 text-indigo" />;
    case "NOT_STARTED":
      return <Circle className="text-muted-foreground h-5 w-5 shrink-0" />;
    default:
      return <Lock className="text-muted-foreground h-5 w-5 shrink-0" />;
  }
}

export function PathLearnerView({ pathId }: { pathId: string }) {
  const { user } = useAuth();
  const { data, isLoading, refetch } = usePathLearnerProgress(pathId);
  const enroll = useEnrollLearningPath(pathId);

  const pathEnrollment = data?.pathEnrollment;
  const courses = data?.courses ?? [];
  const path = data?.path;
  const isEnrolled = !!pathEnrollment;
  const isPublished = path?.status === "PUBLISHED";

  const activeCourse = courses.find(
    (course) => course.state === "IN_PROGRESS" || course.state === "NOT_STARTED",
  );

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title={path?.title ?? "Learning path"}
        description={path?.description ?? "Complete courses in order to finish this program."}
        actions={
          path ? (
            <Badge variant={path.status === "PUBLISHED" ? "default" : "secondary"}>{path.status}</Badge>
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-8">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !path ? (
          <p className="text-muted-foreground text-sm">Learning path not found.</p>
        ) : (
          <>
            <Card className="shadow-luxury">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo/10 text-indigo">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Your progress</p>
                    {isEnrolled ? (
                      <>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                          {pathEnrollment.progressPercent}%
                        </p>
                        <Progress value={pathEnrollment.progressPercent} className="mt-3 h-2" />
                        <p className="text-muted-foreground mt-2 text-sm">
                          {pathEnrollment.status === "COMPLETED"
                            ? "You completed this learning path."
                            : "Courses unlock as you complete each step."}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm">
                        Enroll to start the first course and unlock the sequence.
                      </p>
                    )}
                  </div>
                </div>

                {!isEnrolled && isPublished && user && (
                  <Button
                    disabled={enroll.isPending}
                    onClick={() =>
                      enroll.mutate(
                        { userId: user.id },
                        { onSuccess: () => void refetch() },
                      )
                    }
                  >
                    {enroll.isPending ? <Loader2 className="animate-spin" /> : "Enroll in path"}
                  </Button>
                )}

                {isEnrolled && activeCourse && activeCourse.state !== "LOCKED" && (
                  <Button asChild>
                    <Link href={`/learn/${activeCourse.courseId}`}>
                      {activeCourse.state === "NOT_STARTED" ? "Start next course" : "Continue learning"}
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-luxury">
              <CardHeader>
                <CardTitle className="text-base">Course sequence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {courses.length ? (
                  courses.map((course, idx) => {
                    const canOpen =
                      course.state === "NOT_STARTED" ||
                      course.state === "IN_PROGRESS" ||
                      course.state === "COMPLETED";

                    return (
                      <div
                        key={course.courseId}
                        className={cn(
                          "flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm",
                          course.state === "LOCKED" && "opacity-70",
                        )}
                      >
                        <span className="text-muted-foreground w-6 tabular-nums">{idx + 1}.</span>
                        {stateIcon(course.state)}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{course.title}</p>
                          <p className="text-muted-foreground text-xs">
                            {stateLabel(course.state)}
                            {course.required === false ? " · Optional" : ""}
                            {course.progressPercent > 0 && course.state !== "COMPLETED"
                              ? ` · ${course.progressPercent}%`
                              : ""}
                          </p>
                        </div>
                        {canOpen ? (
                          <Button size="sm" variant={course.state === "COMPLETED" ? "outline" : "default"} asChild>
                            <Link href={`/learn/${course.courseId}`}>
                              {course.state === "COMPLETED"
                                ? "Review"
                                : course.state === "NOT_STARTED"
                                  ? "Start"
                                  : "Continue"}
                            </Link>
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Locked
                          </Badge>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-sm">This path has no courses yet.</p>
                )}
              </CardContent>
            </Card>

            <Button variant="ghost" asChild>
              <Link href="/dashboard">Back to my learning</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
