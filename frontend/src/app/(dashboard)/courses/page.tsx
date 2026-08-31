"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, Clock, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CreateCourseDialog } from "@/components/courses/create-course-dialog";
import { DueDateBadge, DueDateLine } from "@/components/learner/due-date-display";
import { useAuth } from "@/hooks/useAuth";
import { useCourses } from "@/hooks/useCourses";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 24;
const ALL = "all";

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  ARCHIVED: "outline",
};

export default function CoursesPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("course:write");
  const canAssign = hasPermission("course:assign");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim();
      setQ((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useCourses({
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    status: status === ALL ? undefined : status,
  });

  const { data: myEnrollments } = useEnrollments({ pageSize: 100 });
  const enrollmentByCourseId = useMemo(
    () => new Map((myEnrollments?.items ?? []).map((row) => [row.courseId, row])),
    [myEnrollments?.items],
  );

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const description = canWrite
    ? "Create, publish, and manage learning content."
    : canAssign
      ? "Browse published courses and assign them to your team."
      : "Courses assigned to you.";

  const emptyMessage = canWrite
    ? "No courses yet. Create your first course to get started."
    : canAssign
      ? "No published courses yet."
      : "You are not enrolled in any courses yet.";

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader title="Courses" description={description} actions={<CreateCourseDialog />} />
      <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses"
            className="pl-8"
          />
        </div>
        {canWrite && (
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="grid flex-1 gap-4 px-6 py-6 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)
        ) : data?.items?.length ? (
          data.items.map((course) => {
            const enrollment = enrollmentByCourseId.get(course.id);
            const showDue =
              enrollment?.dueAt &&
              enrollment.status !== "COMPLETED" &&
              enrollment.status !== "REVOKED" &&
              enrollment.progressPercent < 100;

            return (
            <Card
              key={course.id}
              className="flex flex-col overflow-hidden shadow-luxury transition-shadow hover:shadow-luxury-lg"
            >
              <div className="relative h-32 bg-hero-gradient">
                {course.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover opacity-80"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BookOpen className="h-10 w-10 text-indigo/40" />
                  </div>
                )}
                <Badge
                  variant={statusColors[course.status] as "default" | "secondary" | "outline"}
                  className="absolute right-3 top-3"
                >
                  {course.status}
                </Badge>
                {showDue && enrollment ? (
                  <div className="absolute left-3 top-3">
                    <DueDateBadge enrollment={enrollment} />
                  </div>
                ) : null}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="line-clamp-2 text-base">{course.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pb-2">
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {course.description ?? "No description"}
                </p>
                {showDue && enrollment ? <DueDateLine enrollment={enrollment} className="mt-2" /> : null}
                {enrollment && enrollment.progressPercent > 0 ? (
                  <p className="text-muted-foreground mt-2 text-xs tabular-nums">
                    {enrollment.progressPercent}% complete
                  </p>
                ) : null}
                <div className="text-muted-foreground mt-3 flex flex-wrap gap-3 text-xs">
                  {course.lessonCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {course.lessonCount} lessons
                    </span>
                  )}
                  {course.durationMinutes != null && course.durationMinutes > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {course.durationMinutes} min
                    </span>
                  )}
                  {course.enrollmentCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {course.enrollmentCount}
                    </span>
                  )}
                </div>
              </CardContent>
              <CardFooter className="gap-2 border-t border-border/60 pt-4">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={`/courses/${course.id}`}>{canWrite ? "Manage" : "View"}</Link>
                </Button>
                {course.status === "PUBLISHED" && (
                  <Button size="sm" className="flex-1" asChild>
                    <Link href={`/learn/${course.id}`}>
                      {enrollment && enrollment.progressPercent > 0 ? "Continue" : canWrite || canAssign ? "Preview" : "Start"}
                    </Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
            );
          })
        ) : (
          <div className="text-muted-foreground col-span-full flex flex-col items-center justify-center py-16 text-sm">
            <BookOpen className="mb-4 h-12 w-12 opacity-40" />
            {emptyMessage}
          </div>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 px-6 pb-6">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground text-sm tabular-nums">
            {page} / {totalPages}
            {total ? ` · ${total}` : ""}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
